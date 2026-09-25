// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Base, RevertingReceiver, defaultTerms} from "./utils/Base.sol";
import {ClaspVault} from "../src/ClaspVault.sol";
import {IClaspVault, Position} from "../src/interfaces/IClaspVault.sol";
import {ClaspMath, Terms} from "../src/libraries/ClaspMath.sol";
import {PonsGraduationPhase, PonsLaunchedToken} from "../src/interfaces/IPons.sol";
import {MockCurve, MockToken} from "./mocks/PonsMocks.sol";

/// @dev Owner that re-enters the vault from its receive hook.
contract ReentrantOwner {
    ClaspVault public vault;
    uint256 public id;
    bool public reentered;

    constructor(ClaspVault v) {
        vault = v;
    }

    function lock(uint256 amount, uint256 secs) external {
        ERC20(vault.token()).approve(address(vault), amount);
        id = vault.lock(amount, secs);
    }

    function claim() external {
        vault.claim(id);
    }

    receive() external payable {
        reentered = true;
        vault.claim(id); // reverts: nonReentrant
    }
}

/// @dev Burns 1% of every transfer, to check balance-delta accounting.
contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee", "FEE") {
        _mint(msg.sender, 1_000_000_000e18);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 cut = value / 100;
            super._update(from, address(0), cut);
            value -= cut;
        }
        super._update(from, to, value);
    }
}

contract ClaspVaultTest is Base {
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // ------------------------------------------------------------------ config

    function test_config() public view {
        assertEq(vault.token(), address(token));
        assertEq(vault.treasury(), treasury);
        assertEq(vault.factory(), address(factory));
        assertEq(vault.ponsFactory(), address(pons));
        assertEq(vault.feeEscrow(), address(escrow));
        assertEq(abi.encode(vault.terms()), abi.encode(defaultTerms()));
        assertTrue(vault.isFeeRecipient());
        assertEq(vault.positionCount(), 0);
    }

    // ------------------------------------------------------------------ lock

    function test_lock() public {
        _fund(alice, 100e18);
        uint256 expectedWeight = ClaspMath.weight(100e18, 18_578, 0);
        vm.expectEmit(address(vault));
        emit IClaspVault.Locked(1, alice, 100e18, 30 days, 18_578, expectedWeight, vm.getBlockTimestamp() + 30 days);
        vm.prank(alice);
        uint256 id = vault.lock(100e18, 30 days);

        assertEq(id, 1);
        Position memory p = vault.position(id);
        assertEq(p.owner, alice);
        assertEq(p.lockStart, vm.getBlockTimestamp());
        assertEq(p.lockEnd, vm.getBlockTimestamp() + 30 days);
        assertEq(p.multiplierBps, 18_578);
        assertEq(p.amount, 100e18);
        assertEq(p.weight, expectedWeight);
        assertEq(vault.totalWeight(), expectedWeight);
        assertEq(vault.totalLocked(), 100e18);
        assertEq(token.balanceOf(address(vault)), 100e18);
        assertEq(vault.positionsOf(alice).length, 1);
        assertEq(vault.positionCount(), 1);
    }

    function test_lock_sizeBonus() public {
        uint256 id = _lock(alice, SUPPLY / 100, 365 days);
        assertEq(vault.position(id).multiplierBps, 60_000, "4.0x * 1.5");
        assertEq(vault.position(id).weight, (SUPPLY / 100) * 6);
    }

    function test_lock_reverts() public {
        _fund(alice, 10e18);
        vm.startPrank(alice);
        vm.expectRevert(IClaspVault.InvalidDuration.selector);
        vault.lock(2e18, 4 hours - 1);
        vm.expectRevert(IClaspVault.InvalidDuration.selector);
        vault.lock(2e18, 365 days + 1);
        vm.expectRevert(IClaspVault.AmountTooSmall.selector);
        vault.lock(1e18 - 1, 1 days);
        vm.expectRevert(ClaspVault.InvalidOwner.selector);
        vault.lockFor(address(0), 2e18, 1 days);
        vm.expectRevert(ClaspVault.InvalidOwner.selector);
        vault.lockFor(address(vault), 2e18, 1 days);
        vm.stopPrank();
        // boundaries are inclusive
        vm.prank(alice);
        vault.lock(1e18, 4 hours);
        vm.prank(alice);
        vault.lock(1e18, 365 days);
    }

    function test_lockFor() public {
        _fund(carol, 50e18);
        vm.prank(carol);
        uint256 id = vault.lockFor(alice, 50e18, 7 days);
        assertEq(vault.position(id).owner, alice);
        assertEq(token.balanceOf(carol), 0);
        assertEq(vault.positionsOf(alice).length, 1);
        assertEq(vault.positionsOf(carol).length, 0);
    }

    function test_lock_measuresReceivedByBalanceDelta() public {
        FeeOnTransferToken fot = new FeeOnTransferToken();
        _register(address(fot), creator, address(0), false);
        ClaspVault v = ClaspVault(payable(factory.createVault(address(fot), bytes32(0))));
        fot.approve(address(v), type(uint256).max);
        uint256 id = v.lock(100e18, 1 days);
        assertEq(v.position(id).amount, 99e18);
        assertEq(v.totalLocked(), 99e18);
        assertEq(fot.balanceOf(address(v)), 99e18);
    }

    // ------------------------------------------------------------------ increase

    function test_increase() public {
        uint256 id = _lock(alice, 100e18, 100 days);
        uint256 start = vm.getBlockTimestamp();
        vm.warp(start + 50 days);
        _fund(alice, 100e18);

        (uint256 pm, uint256 pw, uint256 pls) = vault.previewIncrease(id, 100e18);
        uint256 newTerm = ClaspMath.blendedTerm(100e18, 100e18, 100 days, 50 days);
        uint256 dur = ClaspMath.durationBps(50 days, 4 hours, 365 days);
        uint256 w = ClaspMath.weight(200e18, dur, 0);

        vm.expectEmit(address(vault));
        emit IClaspVault.Increased(id, 100e18, w, start + 100 days - newTerm);
        vm.prank(alice);
        vault.increase(id, 100e18);

        Position memory p = vault.position(id);
        assertEq(p.amount, 200e18);
        assertEq(p.weight, w, "repriced to the 50 days left");
        assertEq(p.lockEnd, start + 100 days, "end unchanged");
        assertEq(p.lockStart, start + 100 days - newTerm);
        assertEq(vault.totalWeight(), w);
        assertEq(vault.totalLocked(), 200e18);
        assertEq(pm, p.multiplierBps);
        assertEq(pw, p.weight);
        assertEq(pls, p.lockStart);
    }

    function test_increase_penaltyMatchesSeparateLocks() public {
        uint256 id = _lock(alice, 100e18, 100 days);
        skip(60 days);
        _fund(alice, 300e18);
        vm.prank(alice);
        vault.increase(id, 300e18);
        (uint256 burn,,) = vault.previewEarlyUnlock(id);
        // old tokens: 25% * 40/100 = 10% of 100 = 10; new tokens: fresh 25% of 300 = 75
        assertApproxEqRel(burn, 85e18, 1e12);
        assertGe(burn, 85e18);
    }

    function test_increase_keepsAccruedRewards() public {
        uint256 id = _lock(alice, 100e18, 30 days);
        _arrive(1 ether);
        skip(1 hours);
        uint256 before = vault.pending(id);
        assertApproxEqAbs(before, 0.9 ether, DUST);
        _fund(alice, 100e18);
        vm.prank(alice);
        vault.increase(id, 100e18);
        assertEq(vault.pending(id), before);
        vm.prank(alice);
        assertEq(vault.claim(id), before);
    }

    /// A top-up must stay locked at least `minLockSecs`, like a fresh lock: a near-mature
    /// position cannot take a large top-up for a few seconds.
    function test_increase_requiresMinLockRemaining() public {
        uint256 id = _lock(alice, 1e18, 1 days);
        _fund(alice, 1_000_000e18);

        skip(1 days - 4 hours); // exactly the minimum left: allowed
        vault.previewIncrease(id, 1e18);
        vm.prank(alice);
        vault.increase(id, 1e18);

        skip(1); // one second less than the minimum
        vm.expectRevert(IClaspVault.InvalidDuration.selector);
        vault.previewIncrease(id, 1_000_000e18 - 1e18);
        vm.prank(alice);
        vm.expectRevert(IClaspVault.InvalidDuration.selector);
        vault.increase(id, 1_000_000e18 - 1e18);

        skip(4 hours - 61); // 60 s left: the sniping case from the review
        vm.prank(alice);
        vm.expectRevert(IClaspVault.InvalidDuration.selector);
        vault.increase(id, 1_000_000e18 - 1e18);

        // extending first re-opens top-ups
        vm.prank(alice);
        vault.extend(id, 4 hours);
        vm.prank(alice);
        vault.increase(id, 1_000_000e18 - 1e18);
        assertEq(vault.position(id).amount, 1_000_001e18, "1 + 1 + (1_000_000 - 1) tokens");
    }

    function test_increase_reverts() public {
        uint256 id = _lock(alice, 100e18, 1 days);
        _fund(bob, 10e18);
        vm.prank(bob);
        vm.expectRevert(IClaspVault.NotOwner.selector);
        vault.increase(id, 10e18);
        vm.prank(alice);
        vm.expectRevert(IClaspVault.AmountTooSmall.selector);
        vault.increase(id, 0);
        vm.prank(alice);
        vm.expectRevert(IClaspVault.UnknownPosition.selector);
        vault.increase(99, 1e18);
        skip(1 days);
        vm.prank(alice);
        vm.expectRevert(IClaspVault.AlreadyMatured.selector);
        vault.increase(id, 1e18);
        vm.expectRevert(IClaspVault.AlreadyMatured.selector);
        vault.previewIncrease(id, 1e18);
    }

    // ------------------------------------------------------------------ extend

    function test_extend() public {
        uint256 id = _lock(alice, 100e18, 30 days);
        skip(10 days);
        uint256 w = ClaspMath.weight(100e18, 24_886, 0);
        vm.expectEmit(address(vault));
        emit IClaspVault.Extended(id, vm.getBlockTimestamp() + 90 days, 24_886, w);
        vm.prank(alice);
        vault.extend(id, 90 days);
        Position memory p = vault.position(id);
        assertEq(p.lockStart, vm.getBlockTimestamp(), "restarts the lock");
        assertEq(p.lockEnd, vm.getBlockTimestamp() + 90 days);
        assertEq(p.weight, w);
        assertEq(vault.totalWeight(), w);
    }

    function test_extend_afterMaturity() public {
        uint256 id = _lock(alice, 100e18, 1 days);
        skip(5 days);
        vm.prank(alice);
        vault.extend(id, 4 hours);
        assertEq(vault.position(id).lockEnd, vm.getBlockTimestamp() + 4 hours);
    }

    function test_extend_reverts() public {
        uint256 id = _lock(alice, 100e18, 30 days);
        vm.prank(alice);
        vm.expectRevert(IClaspVault.ExtendMustIncreaseEnd.selector);
        vault.extend(id, 30 days);
        vm.prank(alice);
        vm.expectRevert(IClaspVault.ExtendMustIncreaseEnd.selector);
        vault.extend(id, 29 days);
        vm.prank(alice);
        vm.expectRevert(IClaspVault.InvalidDuration.selector);
        vault.extend(id, 366 days);
        vm.prank(bob);
        vm.expectRevert(IClaspVault.NotOwner.selector);
        vault.extend(id, 60 days);
    }

    // ------------------------------------------------------------------ inflow & stream

    function test_feesArrived_split() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        vm.expectEmit(address(vault));
        emit IClaspVault.FeesArrived(1 ether, 0.9 ether, 0.1 ether);
        assertEq(vault.sync(), 1 ether);
        assertEq(vault.lifetimeInflow(), 1 ether);
        assertEq(vault.undistributed(), 0.9 ether);
        assertEq(vault.treasuryOwed(), 0.1 ether);
        assertEq(vault.streamEnd(), vm.getBlockTimestamp() + 1 hours);
        assertEq(vault.sync(), 0, "nothing new");
    }

    function test_stream_releasesLinearly() public {
        uint256 id = _lock(alice, 100e18, 30 days);
        _arrive(1 ether);
        assertEq(vault.pending(id), 0, "nothing released in the arrival block");
        skip(15 minutes);
        assertApproxEqAbs(vault.pending(id), 0.225 ether, DUST);
        assertApproxEqAbs(vault.undistributed(), 0.675 ether, DUST);
        skip(45 minutes);
        assertApproxEqAbs(vault.pending(id), 0.9 ether, DUST);
        assertEq(vault.undistributed(), 0);
        skip(10 days);
        assertApproxEqAbs(vault.pending(id), 0.9 ether, DUST, "no more after the stream ends");
    }

    function test_stream_weightAddedAfterReleaseEarnsNothing() public {
        uint256 a = _lock(alice, 100e18, 30 days);
        _arrive(1 ether);
        skip(1 hours);
        uint256 b = _lock(bob, 1_000e18, 365 days);
        skip(30 days);
        assertEq(vault.pending(b), 0, "arrived and released before Bob locked");
        assertApproxEqAbs(vault.pending(a), 0.9 ether, DUST);
    }

    function test_stream_weightAddedMidStreamEarnsOnlyTheRemainder() public {
        uint256 a = _lock(alice, 100e18, 30 days);
        _arrive(1 ether);
        skip(30 minutes);
        uint256 b = _lock(bob, 100e18, 30 days); // same weight as Alice
        skip(1 hours);
        assertApproxEqAbs(vault.pending(a), 0.675 ether, DUST, "all of the first half + half of the second");
        assertApproxEqAbs(vault.pending(b), 0.225 ether, DUST, "half of the second half only");
    }

    function test_stream_sameBlockSniperCannotExtractIt() public {
        _lock(alice, 100e18, 30 days);
        _arrive(10 ether);
        // sniper locks a huge position right after the arrival, in the same block
        uint256 s = _lock(bob, SUPPLY / 10, 4 hours);
        assertEq(vault.pending(s), 0);
        // leaving immediately forfeits everything and burns principal
        (uint256 burn,, uint256 forfeited) = vault.previewEarlyUnlock(s);
        assertEq(forfeited, 0);
        assertEq(burn, (SUPPLY / 10) / 4, "25% of principal");
        uint256 ethBefore = bob.balance;
        vm.prank(bob);
        vault.earlyUnlock(s);
        assertEq(bob.balance, ethBefore, "no ETH extracted");
    }

    function test_newArrivalRestartsWindowForRemainder() public {
        uint256 id = _lock(alice, 100e18, 30 days);
        _arrive(1 ether);
        skip(30 minutes);
        _arrive(1 ether); // 0.45 left + 0.9 new streams over the next hour
        assertApproxEqAbs(vault.pending(id), 0.45 ether, DUST);
        assertApproxEqAbs(vault.undistributed(), 1.35 ether, DUST);
        skip(1 hours);
        assertApproxEqAbs(vault.pending(id), 1.8 ether, DUST);
    }

    function test_zeroWeight_releasesToTreasury() public {
        _arrive(1 ether);
        assertEq(vault.treasuryOwed(), 0.1 ether);
        skip(1 hours);
        assertEq(vault.treasuryOwed(), 1 ether);
        assertEq(vault.undistributed(), 0);
        vm.expectEmit(address(vault));
        emit IClaspVault.TreasuryClaimed(1 ether);
        assertEq(vault.claimTreasury(), 1 ether);
        assertEq(treasury.balance, 1 ether);
        assertEq(address(vault).balance, 0);
        assertEq(vault.claimTreasury(), 0);
    }

    function test_zeroWeight_partialThenLocker() public {
        _arrive(1 ether);
        skip(30 minutes);
        uint256 id = _lock(alice, 100e18, 30 days);
        skip(1 hours);
        assertApproxEqAbs(vault.treasuryOwed(), 0.55 ether, DUST);
        assertApproxEqAbs(vault.pending(id), 0.45 ether, DUST);
    }

    function test_rewardsProportionalToWeight() public {
        uint256 a = _lock(alice, 100e18, 365 days); // 4.0x
        uint256 b = _lock(bob, 100e18, 4 hours); // 1.0x
        _arrive(5 ether);
        skip(1 hours);
        assertApproxEqAbs(vault.pending(a), 3.6 ether, DUST);
        assertApproxEqAbs(vault.pending(b), 0.9 ether, DUST);
    }

    // ------------------------------------------------------------------ claim

    function test_claim() public {
        uint256 id = _lock(alice, 100e18, 30 days);
        _arrive(1 ether);
        skip(2 hours);
        uint256 p = vault.pending(id);
        vm.expectEmit(address(vault));
        emit IClaspVault.Claimed(id, alice, p);
        vm.prank(alice);
        assertEq(vault.claim(id), p);
        assertEq(alice.balance, p);
        assertEq(vault.pending(id), 0);
        assertEq(vault.position(id).claimed, p);
        assertEq(vault.lifetimeRewards(), p);
        vm.prank(alice);
        assertEq(vault.claim(id), 0, "nothing left");
    }

    function test_claim_reverts() public {
        uint256 id = _lock(alice, 100e18, 30 days);
        vm.prank(bob);
        vm.expectRevert(IClaspVault.NotOwner.selector);
        vault.claim(id);
        vm.expectRevert(IClaspVault.UnknownPosition.selector);
        vault.claim(0);
    }

    function test_claimAll() public {
        uint256 a1 = _lock(alice, 100e18, 30 days);
        uint256 a2 = _lock(alice, 300e18, 30 days);
        uint256 b1 = _lock(bob, 100e18, 30 days);
        _arrive(1 ether);
        skip(1 hours);
        uint256[] memory ids = new uint256[](2);
        ids[0] = a1;
        ids[1] = a2;
        uint256 expected = vault.pending(a1) + vault.pending(a2);
        vm.prank(alice);
        assertEq(vault.claimAll(ids), expected);
        assertEq(alice.balance, expected);
        assertApproxEqAbs(expected, 0.72 ether, DUST);

        ids[1] = b1;
        vm.prank(alice);
        vm.expectRevert(IClaspVault.NotOwner.selector);
        vault.claimAll(ids);
    }

    // ------------------------------------------------------------------ unlock

    function test_unlock_maturedByAnyonePaysOwner() public {
        uint256 id = _lock(alice, 100e18, 4 hours);
        _arrive(1 ether);
        skip(4 hours);
        uint256 reward = vault.pending(id);
        assertGt(reward, 0);

        vm.expectEmit(address(vault));
        emit IClaspVault.Claimed(id, alice, reward);
        vm.expectEmit(address(vault));
        emit IClaspVault.Unlocked(id, alice, 100e18, 0, 0, false);
        vm.prank(bob);
        vault.unlock(id);

        assertEq(token.balanceOf(alice), 100e18);
        assertEq(alice.balance, reward);
        assertEq(token.balanceOf(bob), 0);
        assertEq(bob.balance, 0);
        assertEq(vault.totalWeight(), 0);
        assertEq(vault.totalLocked(), 0);
        assertEq(vault.positionsOf(alice).length, 0);
        Position memory p = vault.position(id);
        assertEq(p.owner, alice, "history kept");
        assertEq(p.amount, 0);
        assertEq(p.claimed, reward);
    }

    function test_unlock_reverts() public {
        uint256 id = _lock(alice, 100e18, 1 days);
        skip(1 days - 1);
        vm.expectRevert(IClaspVault.NotMatured.selector);
        vault.unlock(id);
        skip(1);
        vault.unlock(id);
        vm.expectRevert(IClaspVault.UnknownPosition.selector);
        vault.unlock(id);
    }

    function test_positionsOf_swapAndPop() public {
        uint256 a1 = _lock(alice, 10e18, 4 hours);
        uint256 a2 = _lock(alice, 10e18, 1 days);
        uint256 a3 = _lock(alice, 10e18, 2 days);
        skip(4 hours);
        vault.unlock(a1);
        uint256[] memory ids = vault.positionsOf(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], a3);
        assertEq(ids[1], a2);
        skip(2 days);
        vault.unlock(a2);
        vault.unlock(a3);
        assertEq(vault.positionsOf(alice).length, 0);
    }

    // ------------------------------------------------------------------ early unlock

    function test_earlyUnlock() public {
        uint256 a = _lock(alice, 1000e18, 100 days);
        uint256 b = _lock(bob, 1000e18, 100 days);
        _arrive(1 ether);
        skip(50 days);
        uint256 forfeited = vault.pending(a);
        uint256 bobBefore = vault.pending(b);
        (uint256 burn, uint256 returned, uint256 pf) = vault.previewEarlyUnlock(a);
        assertEq(burn, 125e18, "25% * 50/100");
        assertEq(returned, 875e18);
        assertEq(pf, forfeited);

        vm.expectEmit(address(vault));
        emit IClaspVault.Unlocked(a, alice, 875e18, 125e18, forfeited, true);
        vm.prank(alice);
        vault.earlyUnlock(a);

        assertEq(token.balanceOf(alice), 875e18);
        assertEq(token.balanceOf(DEAD), 125e18);
        assertEq(alice.balance, 0);
        assertEq(vault.pending(b), bobBefore, "forfeit is streamed, not instant");
        assertApproxEqAbs(vault.undistributed(), forfeited, DUST);
        skip(1 hours);
        assertApproxEqAbs(vault.pending(b), bobBefore + forfeited, DUST);
    }

    function test_earlyUnlock_floor() public {
        uint256 a = _lock(alice, 1000e18, 100 days);
        skip(99 days);
        vm.prank(alice);
        vault.earlyUnlock(a);
        assertEq(token.balanceOf(DEAD), 50e18, "5% floor");
    }

    function test_earlyUnlock_lastLockerForfeitGoesToTreasury() public {
        uint256 a = _lock(alice, 1000e18, 100 days);
        _arrive(1 ether);
        skip(1 hours);
        vm.prank(alice);
        vault.earlyUnlock(a);
        skip(1 hours);
        assertApproxEqAbs(vault.treasuryOwed(), 1 ether, DUST);
    }

    function test_earlyUnlock_reverts() public {
        uint256 a = _lock(alice, 1000e18, 1 days);
        vm.prank(bob);
        vm.expectRevert(IClaspVault.NotOwner.selector);
        vault.earlyUnlock(a);
        skip(1 days);
        vm.prank(alice);
        vm.expectRevert(IClaspVault.AlreadyMatured.selector);
        vault.earlyUnlock(a);
        (uint256 burn, uint256 returned, uint256 f) = vault.previewEarlyUnlock(a);
        assertEq(burn, 0);
        assertEq(returned, 1000e18);
        assertEq(f, 0);
    }

    // ------------------------------------------------------------------ reverting recipients

    function test_claim_revertingOwnerIsCreditedToOwed() public {
        RevertingReceiver r = new RevertingReceiver();
        token.transfer(address(r), 100e18);
        r.exec(address(token), abi.encodeCall(token.approve, (address(vault), 100e18)));
        uint256 id = abi.decode(r.exec(address(vault), abi.encodeCall(vault.lock, (100e18, 30 days))), (uint256));
        uint256 b = _lock(bob, 100e18, 30 days);
        _arrive(1 ether);
        skip(1 hours);

        uint256 p = vault.pending(id);
        vm.expectEmit(address(vault));
        emit IClaspVault.Owed(address(r), p);
        r.exec(address(vault), abi.encodeCall(vault.claim, (id)));
        assertEq(vault.owed(address(r)), p);
        assertEq(vault.totalOwed(), p);

        // Bob is unaffected
        vm.prank(bob);
        vault.claim(b);
        assertApproxEqAbs(bob.balance, 0.45 ether, DUST);

        // withdraw to another address
        vm.expectEmit(address(vault));
        emit IClaspVault.OwedWithdrawn(address(r), carol, p);
        r.exec(address(vault), abi.encodeCall(vault.withdrawOwed, (carol)));
        assertEq(carol.balance, p);
        assertEq(vault.owed(address(r)), 0);
        assertEq(vault.totalOwed(), 0);
    }

    function test_unlock_revertingOwnerDoesNotBlockKeeper() public {
        RevertingReceiver r = new RevertingReceiver();
        token.transfer(address(r), 100e18);
        r.exec(address(token), abi.encodeCall(token.approve, (address(vault), 100e18)));
        uint256 id = abi.decode(r.exec(address(vault), abi.encodeCall(vault.lock, (100e18, 4 hours))), (uint256));
        _arrive(1 ether);
        skip(4 hours);
        vm.prank(bob);
        vault.unlock(id);
        assertEq(token.balanceOf(address(r)), 100e18);
        assertApproxEqAbs(vault.owed(address(r)), 0.9 ether, DUST);
    }

    function test_claimTreasury_revertingTreasury() public {
        RevertingReceiver r = new RevertingReceiver();
        vm.prank(owner);
        factory.setTreasury(address(r));
        MockToken t2 = new MockToken("T2", "T2");
        _register(address(t2), creator, address(0), false);
        ClaspVault v = ClaspVault(payable(factory.createVault(address(t2), bytes32(0))));
        vm.deal(address(v), 1 ether);
        v.sync();
        skip(1 hours); // no lockers: the whole stream releases to the treasury
        v.claimTreasury();
        assertEq(v.owed(address(r)), 1 ether);
        r.setAccept(true);
        r.exec(address(v), abi.encodeCall(v.withdrawOwed, (address(r))));
        assertEq(address(r).balance, 1 ether);
    }

    function test_withdrawOwed_reverts() public {
        vm.prank(alice);
        vm.expectRevert(IClaspVault.NothingOwed.selector);
        vault.withdrawOwed(alice);
        vm.prank(alice);
        vm.expectRevert(IClaspVault.ZeroAddress.selector);
        vault.withdrawOwed(address(0));

        RevertingReceiver r = new RevertingReceiver();
        vm.prank(owner);
        factory.setTreasury(address(r));
        MockToken t2 = new MockToken("T2", "T2");
        _register(address(t2), creator, address(0), false);
        ClaspVault v = ClaspVault(payable(factory.createVault(address(t2), bytes32(0))));
        vm.deal(address(v), 1 ether);
        v.claimTreasury();
        assertEq(v.owed(address(r)), 0.1 ether, "only the treasury share is due in the arrival block");
        vm.expectRevert(IClaspVault.TransferFailed.selector);
        r.exec(address(v), abi.encodeCall(v.withdrawOwed, (address(r))));
    }

    function test_reentrancyFromReceiveCannotDoubleClaim() public {
        ReentrantOwner ro = new ReentrantOwner(vault);
        token.transfer(address(ro), 100e18);
        ro.lock(100e18, 30 days);
        _arrive(1 ether);
        skip(1 hours);
        uint256 p = vault.pending(ro.id());
        ro.claim();
        // the re-entrant call reverted inside receive, so the payout failed and was owed
        assertEq(vault.owed(address(ro)), p);
        assertEq(address(ro).balance, 0);
        assertEq(vault.pending(ro.id()), 0);
    }

    // ------------------------------------------------------------------ harvest

    function test_harvest_claimsEscrow() public {
        _lock(alice, 100e18, 30 days);
        vm.deal(address(this), 2 ether);
        escrow.credit{value: 2 ether}(address(vault));
        vm.expectEmit(address(vault));
        emit IClaspVault.FeesArrived(2 ether, 1.8 ether, 0.2 ether);
        assertEq(vault.harvest(), 2 ether);
        assertEq(escrow.balanceOf(address(vault)), 0);
        assertEq(address(vault).balance, 2 ether);
        assertEq(vault.harvest(), 0, "empty escrow does not revert");
    }

    function test_harvest_countsPriorArrivalsToo() public {
        vm.deal(address(this), 3 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        escrow.credit{value: 2 ether}(address(vault));
        assertEq(vault.harvest(), 3 ether);
        assertEq(vault.lifetimeInflow(), 3 ether);
    }

    function test_harvest_sweepsCurveFeesPreGraduation() public {
        (, MockCurve c, ClaspVault v) = _curveCoin();
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        c.buy{value: 1 ether}(1 ether, 0, alice);
        // 1% fee (70% creator) + 1% creator tax, accrued on the curve
        uint256 expected = (0.01 ether * 7000) / 10_000 + 0.01 ether;
        assertEq(v.harvest(), expected);
        assertEq(c.quoteFeeBalance(), 0);
        assertEq(address(v).balance, expected);
    }

    function test_harvest_graduatedSweepsHookBestEffort() public {
        pons.setPhase(address(token), PonsGraduationPhase.PoolCreated);
        bytes32 poolId = keccak256(abi.encode(address(0), address(token), uint24(0), int24(200), address(hook)));
        hook.setPool(poolId, address(vault));
        vm.deal(address(this), 3 ether);
        hook.accrue{value: 1 ether}(poolId);
        assertEq(vault.harvest(), 1 ether);

        // when Pons requires its operator, the sweep is skipped but the escrow is still claimed
        hook.accrue{value: 1 ether}(poolId);
        hook.setRequireOperator(true);
        escrow.credit{value: 1 ether}(address(vault));
        assertEq(vault.harvest(), 1 ether);
        assertEq(hook.pendingEth(poolId), 1 ether);
    }

    function test_harvest_disablesBuybackWhenRecipient() public {
        pons.setBuybackFlag(address(token), true);
        vault.harvest();
        assertFalse(pons.getLaunchedToken(address(token)).buybackEnabled);
    }

    function test_harvest_notRecipientOnlyClaimsOwnEscrow() public {
        MockToken t2 = new MockToken("T2", "T2");
        _register(address(t2), creator, address(0), false);
        ClaspVault v = ClaspVault(payable(factory.createVault(address(t2), bytes32(0))));
        assertFalse(v.isFeeRecipient());
        vm.deal(address(this), 1 ether);
        escrow.credit{value: 1 ether}(address(v));
        assertEq(v.harvest(), 1 ether);
    }

    // ------------------------------------------------------------------ accounting guard

    function test_unrecordedOutflowReverts() public {
        _arrive(1 ether);
        vm.deal(address(vault), 0.5 ether); // impossible on-chain; simulates a bug
        vm.expectRevert(IClaspVault.UnrecordedOutflow.selector);
        vault.sync();
    }

    function test_previewMultiplier() public view {
        (uint256 m, uint256 w) = vault.previewMultiplier(SUPPLY / 200, 30 days);
        assertEq(m, uint256(18_578 * 12_500) / 10_000);
        assertEq(w, ClaspMath.weight(SUPPLY / 200, 18_578, 2500));
    }

    // ------------------------------------------------------------------ helpers

    function _curveCoin() internal returns (MockToken t, MockCurve c, ClaspVault v) {
        t = new MockToken("C", "C");
        c = new MockCurve(address(pons), escrow, creator, 1.68 ether, 100, 100);
        t.mint(address(c), SUPPLY);
        c.initialize(address(t), (SUPPLY * 1.68 ether) / (1.68 ether + 4.2 ether));
        _register(address(t), creator, address(0), false);
        PonsLaunchedToken memory lt = pons.getLaunchedToken(address(t));
        lt.curve = address(c);
        pons.setLaunched(address(t), lt);
        v = ClaspVault(payable(factory.createVault(address(t), bytes32(0))));
        vm.prank(creator);
        pons.transferCreatorFeeRecipient(address(t), address(v));
    }

    receive() external payable {}
}
