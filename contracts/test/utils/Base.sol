// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {ClaspFactory} from "../../src/ClaspFactory.sol";
import {ClaspVault} from "../../src/ClaspVault.sol";
import {Terms} from "../../src/libraries/ClaspMath.sol";
import {PonsLaunchedToken, PonsGraduationPhase} from "../../src/interfaces/IPons.sol";
import {MockPonsFactory, MockToken, MockEscrow, MockHook, MockCurve} from "../mocks/PonsMocks.sol";

/// @dev Contract that rejects ETH, to exercise the `owed[]` fallback.
contract RevertingReceiver {
    bool public accept;

    function setAccept(bool a) external {
        accept = a;
    }

    receive() external payable {
        require(accept, "no ETH");
    }

    function exec(address target, bytes calldata data) external returns (bytes memory) {
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }
}

function defaultTerms() pure returns (Terms memory) {
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

abstract contract Base is Test {
    uint256 internal constant SUPPLY = 1_000_000_000e18;
    /// @dev `accRewardPerWeight` rounds down by < 1 unit per release, i.e. lockers can be
    /// short by < totalWeight / 1e18 wei per release. Assertions allow this much.
    uint256 internal constant DUST = 1e6;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    MockPonsFactory internal pons;
    MockEscrow internal escrow;
    MockHook internal hook;
    MockToken internal token;
    ClaspFactory internal factory;
    ClaspVault internal vault;

    function setUp() public virtual {
        vm.warp(1_750_000_000);
        pons = new MockPonsFactory();
        escrow = pons.escrow();
        hook = pons.hook();
        token = new MockToken("Coin", "COIN");
        token.mint(address(this), SUPPLY);
        _register(address(token), creator, address(0), false);
        factory = new ClaspFactory(owner, treasury, address(pons), defaultTerms());
        vault = ClaspVault(payable(factory.createVault(address(token), bytes32(0))));
        vm.prank(creator);
        pons.transferCreatorFeeRecipient(address(token), address(vault));
    }

    function _register(address t, address recipient, address pairToken, bool buyback) internal {
        pons.setLaunched(
            t,
            PonsLaunchedToken({
                token: t,
                curve: address(0),
                deployer: recipient,
                creatorFeeRecipient: recipient,
                pairToken: pairToken,
                graduationThreshold: 4.2 ether,
                poolFee: 0,
                tickSpacing: 200,
                creatorTaxBps: 100,
                buybackEnabled: buyback,
                phase: PonsGraduationPhase.NotGraduated,
                sweptQuote: 0,
                sweptTokens: 0,
                sweptAt: 0,
                exists: true
            })
        );
    }

    function _fund(address who, uint256 amount) internal {
        token.transfer(who, amount);
        vm.prank(who);
        token.approve(address(vault), type(uint256).max);
    }

    function _lock(address who, uint256 amount, uint256 secs) internal returns (uint256 id) {
        _fund(who, amount);
        vm.prank(who);
        id = vault.lock(amount, secs);
    }

    /// @dev Sends ETH to the vault like the router does, then syncs.
    function _arrive(uint256 amount) internal {
        vm.deal(address(this), address(this).balance + amount);
        (bool ok,) = address(vault).call{value: amount}("");
        require(ok);
        vault.sync();
    }
}
