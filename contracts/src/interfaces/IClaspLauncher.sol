// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PonsSocials} from "./IPons.sol";

/// @notice Everything the creator chooses for a Clasp launch. The Pons fee recipient
/// and buyback flag are not choosable: the recipient is always the coin's vault and
/// buyback is always off.
struct LaunchParams {
    string name;
    string symbol;
    string logo;
    string description;
    PonsSocials socials;
    uint16 creatorTaxBps;
    bytes32 salt;
    bytes32 expectedEconomics;
    uint256 launchConfigId;
    uint256 devBuyEth;
    uint256 minTokensOut;
    uint16 lockPercent;
    uint32 lockSecs;
    /// @dev Must equal `keccak256(abi.encode(vault.terms()))` of the created vault, i.e.
    /// `ClaspFactory.defaultsHash()` when the transaction was signed.
    bytes32 expectedTermsHash;
    /// @dev Must equal the created vault's treasury (`ClaspFactory.treasury()` when signed).
    address expectedTreasury;
}

interface IClaspLauncher {
    event Launched(
        address indexed token,
        address indexed vault,
        address indexed creator,
        uint256 devBuyEth,
        uint256 lockedAmount,
        uint256 lockSecs
    );

    error WrongValue(uint256 supplied, uint256 expected);
    error InvalidLockPercent();
    error TransferFailed();
    error TermsMismatch();
    error TreasuryMismatch();

    function factory() external view returns (address);
    function ponsFactory() external view returns (address);

    /// @notice `msg.value` must equal `ponsFactory.launchFee() + p.devBuyEth`.
    function launch(LaunchParams calldata p)
        external
        payable
        returns (address token, address vault, uint256 lockId, uint256 tokensBought);
}
