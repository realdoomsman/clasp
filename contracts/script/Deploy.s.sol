// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";

import {ClaspFactory} from "../src/ClaspFactory.sol";
import {ClaspRouter} from "../src/ClaspRouter.sol";
import {ClaspLauncher} from "../src/ClaspLauncher.sol";
import {Terms} from "../src/libraries/ClaspMath.sol";

/// @notice Deploys ClaspFactory (SPEC default terms), ClaspRouter and ClaspLauncher.
///
/// Env:
///   CLASP_OWNER     factory owner (Ownable2Step; can only change future-vault defaults,
///                   the treasury for future vaults, and pause createVault)
///   CLASP_TREASURY  treasury receiving the 10% share of future vaults
///   PONS_FACTORY    optional, defaults to the Robinhood Chain PonsV2LaunchFactory
///
/// Dry run against a local anvil fork (never broadcast to mainnet from here):
///   anvil --fork-url https://rpc.mainnet.chain.robinhood.com
///   CLASP_OWNER=0x… CLASP_TREASURY=0x… forge script script/Deploy.s.sol \
///     --rpc-url http://127.0.0.1:8545 --broadcast --private-key <anvil key>
///
/// After a real deployment, copy the three addresses and the factory's L2 deployment
/// block (from the receipt / broadcast json — `block.number` inside the EVM on Robinhood
/// Chain is the L1 block) into packages/sdk/src/addresses.ts.
contract Deploy is Script {
    address internal constant PONS_FACTORY = 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e;
    uint256 internal constant ROBINHOOD_CHAIN_ID = 4663;

    function run() external returns (ClaspFactory factory, ClaspRouter router, ClaspLauncher launcher) {
        require(block.chainid == ROBINHOOD_CHAIN_ID, "Deploy: not Robinhood Chain (or a fork of it)");
        address owner = vm.envAddress("CLASP_OWNER");
        address treasury = vm.envAddress("CLASP_TREASURY");
        address pons = vm.envOr("PONS_FACTORY", PONS_FACTORY);
        require(pons.code.length != 0, "Deploy: Pons factory has no code");

        vm.startBroadcast();
        factory = new ClaspFactory(owner, treasury, pons, defaultTerms());
        router = new ClaspRouter(address(factory));
        launcher = new ClaspLauncher(address(factory));
        vm.stopBroadcast();

        console2.log("ClaspFactory ", address(factory));
        console2.log("ClaspRouter  ", address(router));
        console2.log("ClaspLauncher", address(launcher));
        console2.log("owner        ", owner);
        console2.log("treasury     ", treasury);
    }

    /// @dev SPEC "Lock economics" defaults.
    function defaultTerms() public pure returns (Terms memory) {
        return Terms({
            minLockSecs: 4 hours,
            maxLockSecs: 365 days,
            streamSecs: 1 hours,
            lockerShareBps: 9000,
            penaltyBps: 2500,
            minPenaltyBps: 500,
            tier1ShareBps: 10,
            tier1BonusBps: 1000,
            tier2ShareBps: 50,
            tier2BonusBps: 2500,
            tier3ShareBps: 100,
            tier3BonusBps: 5000,
            minLockAmount: 1e18
        });
    }
}
