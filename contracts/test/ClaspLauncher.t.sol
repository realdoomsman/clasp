// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Base, defaultTerms} from "./utils/Base.sol";
import {Terms} from "../src/libraries/ClaspMath.sol";
import {ClaspLauncher} from "../src/ClaspLauncher.sol";
import {ClaspVault} from "../src/ClaspVault.sol";
import {IClaspLauncher, LaunchParams} from "../src/interfaces/IClaspLauncher.sol";
import {IClaspVault, Position} from "../src/interfaces/IClaspVault.sol";
import {IClaspFactory} from "../src/interfaces/IClaspFactory.sol";
import {PonsSocials, PonsLaunchedToken} from "../src/interfaces/IPons.sol";
import {MockCurve} from "./mocks/PonsMocks.sol";

contract ClaspLauncherTest is Base {
    ClaspLauncher internal launcher;
    uint256 internal constant FEE = 0.0005 ether;

    function setUp() public override {
        super.setUp();
        launcher = new ClaspLauncher(address(factory));
        vm.deal(alice, 10 ether);
    }

    function test_launch() public {
        LaunchParams memory p = _params(1 ether, 60, 30 days);
        vm.prank(alice);
        (address t, address v, uint256 lockId, uint256 bought) = launcher.launch{value: FEE + 1 ether}(p);

        PonsLaunchedToken memory lt = pons.getLaunchedToken(t);
        assertEq(lt.creatorFeeRecipient, v, "vault is the Pons fee recipient");
        assertFalse(lt.buybackEnabled);
        assertEq(lt.pairToken, address(0));
        assertEq(MockCurve(payable(lt.curve)).deployer(), v, "curve pays the vault");
        assertEq(factory.vaultOf(t), v);
        assertTrue(ClaspVault(payable(v)).isFeeRecipient());

        uint256 locked = (bought * 60) / 100;
        Position memory pos = ClaspVault(payable(v)).position(lockId);
        assertEq(pos.owner, alice);
        assertEq(pos.amount, locked);
        assertEq(pos.lockEnd, vm.getBlockTimestamp() + 30 days);
        assertEq(IERC20(t).balanceOf(alice), bought - locked);
        assertEq(IERC20(t).balanceOf(address(launcher)), 0);
        assertEq(address(launcher).balance, 0);
        assertEq(alice.balance, 9 ether - FEE);
        // the dev buy's creator fees accrue to the vault
        assertEq(ClaspVault(payable(v)).harvest(), (0.01 ether * 7000) / 10_000 + 0.01 ether);
    }

    function test_launch_lockAll() public {
        LaunchParams memory p = _params(1 ether, 100, 7 days);
        vm.prank(alice);
        (address t, address v,, uint256 bought) = launcher.launch{value: FEE + 1 ether}(p);
        assertEq(IERC20(t).balanceOf(alice), 0);
        assertEq(ClaspVault(payable(v)).totalLocked(), bought);
    }

    function test_launch_eventFields() public {
        LaunchParams memory p = _params(1 ether, 50, 7 days);
        p.salt = bytes32(uint256(7));
        // predict: MockCurve pricing is deterministic, so compute bought via a dry run
        uint256 snap = vm.snapshotState();
        vm.prank(alice);
        (address t0, address v0,, uint256 bought0) = launcher.launch{value: FEE + 1 ether}(p);
        vm.revertToState(snap);

        vm.expectEmit(address(launcher));
        emit IClaspLauncher.Launched(t0, v0, alice, 1 ether, (bought0 * 50) / 100, 7 days);
        vm.prank(alice);
        launcher.launch{value: FEE + 1 ether}(p);
    }

    function test_launch_noDevBuy() public {
        LaunchParams memory p = _params(0, 50, 7 days);
        vm.prank(alice);
        (address t, address v, uint256 lockId, uint256 bought) = launcher.launch{value: FEE}(p);
        assertEq(bought, 0);
        assertEq(lockId, 0);
        assertEq(IERC20(t).balanceOf(alice), 0);
        assertEq(ClaspVault(payable(v)).positionCount(), 0);
    }

    function test_launch_noLock() public {
        LaunchParams memory p = _params(1 ether, 0, 0);
        vm.prank(alice);
        (address t,, uint256 lockId, uint256 bought) = launcher.launch{value: FEE + 1 ether}(p);
        assertEq(lockId, 0);
        assertEq(IERC20(t).balanceOf(alice), bought);
    }

    function test_launch_clampedDevBuyRefunds() public {
        vm.deal(alice, 100 ether);
        LaunchParams memory p = _params(50 ether, 10, 30 days);
        vm.prank(alice);
        (, address v,, uint256 bought) = launcher.launch{value: FEE + 50 ether}(p);
        assertGt(bought, 0);
        MockCurve c = MockCurve(payable(pons.getLaunchedToken(ClaspVault(payable(v)).token()).curve));
        assertEq(alice.balance, 100 ether - FEE - c.trackedQuote(), "unspent dev-buy ETH refunded");
        assertEq(address(launcher).balance, 0);
    }

    function test_launch_reverts() public {
        LaunchParams memory p = _params(1 ether, 50, 30 days);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IClaspLauncher.WrongValue.selector, 1 ether, FEE + 1 ether));
        launcher.launch{value: 1 ether}(p);
        p.lockPercent = 101;
        vm.expectRevert(IClaspLauncher.InvalidLockPercent.selector);
        launcher.launch{value: FEE + 1 ether}(p);
        p.lockPercent = 50;
        p.lockSecs = 1 hours;
        vm.expectRevert(IClaspVault.InvalidDuration.selector);
        launcher.launch{value: FEE + 1 ether}(p);
        vm.stopPrank();

        vm.prank(owner);
        factory.setPaused(true);
        p.lockSecs = 30 days;
        vm.prank(alice);
        vm.expectRevert(IClaspFactory.IsPaused.selector);
        launcher.launch{value: FEE + 1 ether}(p);
    }

    function test_launch_saltNamespacedPerCreator() public {
        LaunchParams memory p = _params(0, 0, 0);
        vm.prank(alice);
        (address ta,,,) = launcher.launch{value: FEE}(p);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        (address tb,,,) = launcher.launch{value: FEE}(p);
        assertTrue(ta != tb, "same user salt, different creators, different coins");
    }

    /// The factory owner changes defaults / treasury between signing and inclusion (e.g. a
    /// front-run): the launch reverts instead of handing the fee recipient to that vault.
    function test_launch_refusesChangedTermsOrTreasury() public {
        LaunchParams memory p = _params(0.1 ether, 50, 30 days);

        Terms memory t = defaultTerms();
        t.lockerShareBps = 8000;
        vm.prank(owner);
        factory.setDefaults(t);
        vm.prank(alice);
        vm.expectRevert(IClaspLauncher.TermsMismatch.selector);
        launcher.launch{value: FEE + 0.1 ether}(p);

        vm.prank(owner);
        factory.setDefaults(defaultTerms());
        vm.prank(owner);
        factory.setTreasury(bob);
        vm.prank(alice);
        vm.expectRevert(IClaspLauncher.TreasuryMismatch.selector);
        launcher.launch{value: FEE + 0.1 ether}(p);

        p.expectedTermsHash = bytes32(0);
        vm.prank(alice);
        vm.expectRevert(IClaspLauncher.TermsMismatch.selector);
        launcher.launch{value: FEE + 0.1 ether}(p);

        // re-signed against the current values it succeeds
        p = _params(0.1 ether, 50, 30 days);
        vm.prank(alice);
        (, address v,,) = launcher.launch{value: FEE + 0.1 ether}(p);
        assertEq(ClaspVault(payable(v)).treasury(), bob);
    }

    function _params(uint256 devBuy, uint16 lockPercent, uint32 lockSecs) internal view returns (LaunchParams memory) {
        return LaunchParams({
            name: "Launch",
            symbol: "LNCH",
            logo: "ipfs://logo",
            description: "d",
            socials: PonsSocials("x", "", "", "", ""),
            creatorTaxBps: 100,
            salt: bytes32(uint256(42)),
            expectedEconomics: bytes32(0),
            launchConfigId: 0,
            devBuyEth: devBuy,
            minTokensOut: 0,
            lockPercent: lockPercent,
            lockSecs: lockSecs,
            expectedTermsHash: factory.defaultsHash(),
            expectedTreasury: factory.treasury()
        });
    }
}
