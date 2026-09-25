// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Terms} from "../libraries/ClaspMath.sol";

interface IClaspFactory {
    event VaultCreated(address indexed token, address indexed vault, address creator, Terms terms);
    event DefaultsUpdated(Terms terms);
    event TreasuryUpdated(address treasury);
    event Paused(bool paused);

    error IsPaused();
    error VaultExists();
    error NotPonsLaunch();
    error NotEthPaired();
    error BuybackEnabled();
    error InvalidTerms();
    error ZeroAddress();
    error TermsMismatch();

    function ponsFactory() external view returns (address);
    function feeEscrow() external view returns (address);
    function memeHook() external view returns (address);
    function treasury() external view returns (address);
    function paused() external view returns (bool);
    function defaults() external view returns (Terms memory);
    /// @notice `keccak256(abi.encode(defaults()))`; equals `keccak256(abi.encode(vault.terms()))`
    /// of a vault created now. Pass it to `createVault` / `ClaspLauncher.launch` to pin the terms.
    function defaultsHash() external view returns (bytes32);

    /// @param expectedTermsHash reverts `TermsMismatch` unless it equals `defaultsHash()`;
    /// `bytes32(0)` skips the check.
    function createVault(address token, bytes32 expectedTermsHash) external returns (address vault);
    function predictVault(address token) external view returns (address);
    function vaultOf(address token) external view returns (address);
    function allVaults(uint256 index) external view returns (address);
    function vaultCount() external view returns (uint256);

    /// @dev Read by a vault's constructor during `createVault`; zeroed otherwise.
    function vaultParams() external view returns (address token, address treasury, Terms memory terms);

    function setDefaults(Terms calldata terms) external;
    function setTreasury(address treasury) external;
    function setPaused(bool paused) external;
}
