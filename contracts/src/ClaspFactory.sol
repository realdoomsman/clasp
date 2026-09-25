// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

import {IClaspFactory} from "./interfaces/IClaspFactory.sol";
import {IPonsV2LaunchFactory, PonsLaunchedToken} from "./interfaces/IPons.sol";
import {Terms} from "./libraries/ClaspMath.sol";
import {ClaspVault} from "./ClaspVault.sol";

/// @title ClaspFactory
/// @notice Deploys one `ClaspVault` per Pons v2 coin with CREATE2 (salt = token), so a
/// coin's vault address is known before the vault exists. The owner can only change
/// the defaults and treasury used by *future* vaults and pause `createVault`; it has no
/// access to any vault's tokens or ETH, and existing vaults never read the factory again.
contract ClaspFactory is IClaspFactory, Ownable2Step {
    uint256 internal constant BPS = 10_000;
    /// @notice Upper bound on the treasury's share of inflows for any future vault.
    uint256 public constant MAX_TREASURY_BPS = 2_000;
    /// @notice Upper bound on the early-exit penalty for any future vault.
    uint256 public constant MAX_PENALTY_BPS = 5_000;
    /// @notice Upper bound on any size bonus.
    uint256 public constant MAX_BONUS_BPS = 10_000;
    uint256 public constant MAX_STREAM_SECS = 7 days;
    uint256 public constant MAX_LOCK_SECS = 5 * 365 days;
    /// @notice Upper bound on the minimum lock duration (a longer floor could price out lockers).
    uint256 public constant MAX_MIN_LOCK_SECS = 7 days;
    /// @notice Upper bound on the minimum lock amount (a larger floor could make locking impossible).
    uint256 public constant MAX_MIN_LOCK_AMOUNT = 1_000e18;

    address public immutable ponsFactory;
    address public immutable feeEscrow;
    address public immutable memeHook;
    /// @notice keccak256 of the vault creation code (constant, no constructor args).
    bytes32 public immutable vaultInitCodeHash;

    address public treasury;
    bool public paused;
    Terms internal _defaults;

    mapping(address token => address vault) public vaultOf;
    address[] public allVaults;

    // Parameters for the vault being constructed; zero outside `createVault`.
    address internal _pendingToken;
    address internal _pendingTreasury;
    Terms internal _pendingTerms;

    constructor(address owner_, address treasury_, address ponsFactory_, Terms memory defaults_) Ownable(owner_) {
        if (ponsFactory_ == address(0)) revert ZeroAddress();
        ponsFactory = ponsFactory_;
        feeEscrow = IPonsV2LaunchFactory(ponsFactory_).feeEscrow();
        memeHook = IPonsV2LaunchFactory(ponsFactory_).memeHook();
        if (feeEscrow == address(0) || memeHook == address(0)) revert ZeroAddress();
        vaultInitCodeHash = keccak256(type(ClaspVault).creationCode);
        _setTreasury(treasury_);
        _setDefaults(defaults_);
    }

    // =============================================================== vaults

    /// @inheritdoc IClaspFactory
    function createVault(address token, bytes32 expectedTermsHash) external returns (address vault) {
        if (paused) revert IsPaused();
        if (vaultOf[token] != address(0)) revert VaultExists();
        PonsLaunchedToken memory lt = IPonsV2LaunchFactory(ponsFactory).getLaunchedToken(token);
        if (!lt.exists || lt.token != token) revert NotPonsLaunch();
        if (lt.pairToken != address(0)) revert NotEthPaired();
        if (lt.buybackEnabled) revert BuybackEnabled();

        Terms memory t = _defaults;
        if (expectedTermsHash != bytes32(0) && keccak256(abi.encode(t)) != expectedTermsHash) revert TermsMismatch();
        _pendingToken = token;
        _pendingTreasury = treasury;
        _pendingTerms = t;
        vault = address(new ClaspVault{salt: _salt(token)}());
        delete _pendingToken;
        delete _pendingTreasury;
        delete _pendingTerms;

        vaultOf[token] = vault;
        allVaults.push(vault);
        emit VaultCreated(token, vault, msg.sender, t);
    }

    /// @inheritdoc IClaspFactory
    function vaultParams() external view returns (address token, address treasury_, Terms memory terms) {
        return (_pendingToken, _pendingTreasury, _pendingTerms);
    }

    /// @inheritdoc IClaspFactory
    function predictVault(address token) external view returns (address) {
        return Create2.computeAddress(_salt(token), vaultInitCodeHash);
    }

    /// @inheritdoc IClaspFactory
    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    /// @inheritdoc IClaspFactory
    function defaults() external view returns (Terms memory) {
        return _defaults;
    }

    /// @inheritdoc IClaspFactory
    function defaultsHash() external view returns (bytes32) {
        return keccak256(abi.encode(_defaults));
    }

    // =============================================================== owner

    /// @inheritdoc IClaspFactory
    function setDefaults(Terms calldata t) external onlyOwner {
        _setDefaults(t);
    }

    /// @inheritdoc IClaspFactory
    function setTreasury(address treasury_) external onlyOwner {
        _setTreasury(treasury_);
    }

    /// @inheritdoc IClaspFactory
    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit Paused(paused_);
    }

    // =============================================================== internals

    function _salt(address token) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(token)));
    }

    function _setTreasury(address treasury_) internal {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function _setDefaults(Terms memory t) internal {
        if (t.minLockSecs == 0 || t.minLockSecs >= t.maxLockSecs || t.maxLockSecs > MAX_LOCK_SECS) {
            revert InvalidTerms();
        }
        if (t.minLockSecs > MAX_MIN_LOCK_SECS) revert InvalidTerms();
        // The shortest lock must outlast one stream window, so no lock can mature before the
        // arrival it joined for has finished streaming.
        if (t.streamSecs == 0 || t.streamSecs > MAX_STREAM_SECS || t.minLockSecs < t.streamSecs) {
            revert InvalidTerms();
        }
        if (t.lockerShareBps > BPS || BPS - t.lockerShareBps > MAX_TREASURY_BPS) revert InvalidTerms();
        if (t.penaltyBps > MAX_PENALTY_BPS || t.minPenaltyBps > t.penaltyBps) revert InvalidTerms();
        if (
            t.tier1ShareBps == 0 || t.tier1ShareBps > t.tier2ShareBps || t.tier2ShareBps > t.tier3ShareBps
                || t.tier3ShareBps > BPS
        ) revert InvalidTerms();
        if (t.tier1BonusBps > t.tier2BonusBps || t.tier2BonusBps > t.tier3BonusBps || t.tier3BonusBps > MAX_BONUS_BPS) {
            revert InvalidTerms();
        }
        if (t.minLockAmount == 0 || t.minLockAmount > MAX_MIN_LOCK_AMOUNT) revert InvalidTerms();
        _defaults = t;
        emit DefaultsUpdated(t);
    }
}
