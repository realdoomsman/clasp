// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IClaspLauncher, LaunchParams} from "./interfaces/IClaspLauncher.sol";
import {IClaspFactory} from "./interfaces/IClaspFactory.sol";
import {IClaspVault} from "./interfaces/IClaspVault.sol";
import {IPonsV2LaunchFactory, IPonsV2BondingCurve, PonsTokenParams} from "./interfaces/IPons.sol";

/// @title ClaspLauncher
/// @notice Launches a coin on Pons v2 and joins it to Clasp in one transaction:
/// 1. `PonsV2LaunchFactory.launchToken` (ETH pair, buyback off, this contract as the
///    initial creator fee recipient — the vault address depends on the token address,
///    which in turn depends on the recipient, so it cannot be set at launch directly);
/// 2. `ClaspFactory.createVault(token)`, then require the vault's terms hash and treasury
///    to equal `p.expectedTermsHash` / `p.expectedTreasury` (reverts otherwise);
/// 3. `transferCreatorFeeRecipient(token, vault)` — before any trade, so every creator
///    fee of the coin accrues to the vault;
/// 4. the creator's dev buy on the curve (untaxed: this contract is the launch's
///    snipe-tax-exempt deployer; no Clasp fee is charged on the dev buy);
/// 5. `vault.lockFor(creator, lockPercent% of the tokens bought, lockSecs)`;
/// 6. the remaining tokens and any unspent ETH go to the creator.
/// Holds nothing between transactions.
contract ClaspLauncher is IClaspLauncher, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable factory;
    address public immutable ponsFactory;

    constructor(address factory_) {
        factory = factory_;
        ponsFactory = IClaspFactory(factory_).ponsFactory();
    }

    /// @dev Receives a clamped dev buy's refund from the curve.
    receive() external payable {}

    /// @inheritdoc IClaspLauncher
    function launch(LaunchParams calldata p)
        external
        payable
        nonReentrant
        returns (address token, address vault, uint256 lockId, uint256 tokensBought)
    {
        if (p.lockPercent > 100) revert InvalidLockPercent();
        IPonsV2LaunchFactory pons = IPonsV2LaunchFactory(ponsFactory);
        uint256 launchFee = pons.launchFee();
        if (msg.value != launchFee + p.devBuyEth) revert WrongValue(msg.value, launchFee + p.devBuyEth);
        uint256 ethBefore = address(this).balance - msg.value;

        address curve;
        (token, curve) = pons.launchToken{value: launchFee}(
            PonsTokenParams({
                name: p.name,
                symbol: p.symbol,
                logo: p.logo,
                description: p.description,
                socials: p.socials,
                creatorFeeRecipient: address(this),
                creatorTaxBps: p.creatorTaxBps,
                buybackEnabled: false,
                expectedEconomics: p.expectedEconomics,
                salt: keccak256(abi.encode(msg.sender, p.salt))
            }),
            p.launchConfigId,
            address(0)
        );

        vault = IClaspFactory(factory).createVault(token, bytes32(0));
        // The factory owner can change defaults and treasury for future vaults at any time;
        // hand the Pons fee recipient over only to a vault on the terms the creator signed.
        if (keccak256(abi.encode(IClaspVault(vault).terms())) != p.expectedTermsHash) revert TermsMismatch();
        if (IClaspVault(vault).treasury() != p.expectedTreasury) revert TreasuryMismatch();
        pons.transferCreatorFeeRecipient(token, vault);

        if (p.devBuyEth != 0) {
            tokensBought = IPonsV2BondingCurve(curve).buy{value: p.devBuyEth}(p.devBuyEth, p.minTokensOut, address(this));
        }

        uint256 lockAmount = (tokensBought * p.lockPercent) / 100;
        if (lockAmount != 0) {
            IERC20(token).forceApprove(vault, lockAmount);
            lockId = IClaspVault(vault).lockFor(msg.sender, lockAmount, p.lockSecs);
        }
        uint256 rest = IERC20(token).balanceOf(address(this));
        if (rest != 0) IERC20(token).safeTransfer(msg.sender, rest);

        uint256 refund = address(this).balance - ethBefore;
        if (refund != 0) {
            (bool ok,) = msg.sender.call{value: refund}("");
            if (!ok) revert TransferFailed();
        }
        emit Launched(token, vault, msg.sender, p.devBuyEth - refund, lockAmount, lockAmount != 0 ? p.lockSecs : 0);
    }
}
