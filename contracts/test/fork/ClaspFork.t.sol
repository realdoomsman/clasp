// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ForkBase, IPonsCurveViews, IPonsFactoryExtra, IPonsHookExtra} from "./ForkBase.sol";
import {ClaspVault} from "../../src/ClaspVault.sol";
import {IClaspRouter} from "../../src/interfaces/IClaspRouter.sol";
import {IClaspVault, Position} from "../../src/interfaces/IClaspVault.sol";
import {IPonsV2MemeHook, PonsLaunchedToken, PonsGraduationPhase} from "../../src/interfaces/IPons.sol";
import {ClaspMath} from "../../src/libraries/ClaspMath.sol";

contract ClaspForkTest is ForkBase {
    /// Launch through ClaspLauncher on the real Pons factory, trade through the router on
    /// the curve, lock, harvest the Pons creator fees, claim, early-unlock.
    function test_fork_launchTradeLockHarvestClaimExit() public {
        (address token, ClaspVault vault, uint256 creatorLock, uint256 bought) =
            _launch(0.2 ether, 50, 30 days, keccak256("clasp-fork-1"));

        // launched on Pons with the vault as creator fee recipient and buyback off
        PonsLaunchedToken memory lt = pons.getLaunchedToken(token);
        assertTrue(lt.exists);
        assertEq(lt.creatorFeeRecipient, address(vault));
        assertEq(lt.pairToken, address(0));
        assertFalse(lt.buybackEnabled);
        assertEq(uint8(lt.phase), uint8(PonsGraduationPhase.NotGraduated));
        assertEq(IPonsCurveViews(lt.curve).deployer(), address(vault), "curve pays creator fees to the vault");
        assertTrue(vault.isFeeRecipient());
        assertEq(factory.vaultOf(token), address(vault));
        assertEq(factory.predictVault(token), address(vault));

        // founding lock: 50% of the untaxed dev buy
        Position memory cp = vault.position(creatorLock);
        assertEq(cp.owner, creator);
        assertEq(cp.amount, bought / 2);
        assertEq(IERC20(token).balanceOf(creator), bought - bought / 2);

        // let the 3-second Pons snipe window pass
        skip(IPonsCurveViews(lt.curve).snipeTaxSeconds() + 1);

        // buy through the router: 2% lands in the vault, quote is exact
        uint256 vaultBefore = address(vault).balance;
        (uint256 q, uint256 qFee) = router.quoteBuy(token, 0.5 ether);
        vm.prank(trader);
        uint256 out = router.buy{value: 0.5 ether}(token, q, _deadline());
        assertEq(out, q, "curve quote exact");
        assertEq(qFee, 0.01 ether);
        assertEq(address(vault).balance - vaultBefore, 0.01 ether, "2% of the buy");
        assertEq(IERC20(token).balanceOf(trader), out);

        // sell a third through the router
        (uint256 qs, uint256 qsFee) = router.quoteSell(token, out / 3);
        vaultBefore = address(vault).balance;
        uint256 ethBefore = trader.balance;
        uint256 ethOut = _sell(trader, token, out / 3);
        assertEq(ethOut, qs);
        assertEq(trader.balance - ethBefore, ethOut);
        assertEq(address(vault).balance - vaultBefore, qsFee, "2% of the sell");

        // trader locks the rest for 90 days
        uint256 rest = IERC20(token).balanceOf(trader);
        vm.startPrank(trader);
        IERC20(token).approve(address(vault), rest);
        uint256 traderLock = vault.lock(rest, 90 days);
        vm.stopPrank();

        // more trading
        _buy(trader2, token, 1 ether);
        _sell(trader2, token, IERC20(token).balanceOf(trader2) / 2);

        // harvest: the vault sweeps its curve fees into the Pons escrow and claims them
        IPonsCurveViews curve = IPonsCurveViews(lt.curve);
        uint256 qfb = curve.quoteFeeBalance();
        uint256 ctb = curve.creatorTaxBalance();
        uint256 expectedCreatorFees = qfb - (qfb * curve.protocolFeeShareBps()) / 10_000 + ctb;
        assertGt(expectedCreatorFees, 0);
        uint256 inflowBefore = vault.lifetimeInflow();
        vm.prank(keeper);
        uint256 arrived = vault.harvest();
        assertEq(arrived, expectedCreatorFees, "all pending Pons creator fees pulled in");
        assertEq(curve.quoteFeeBalance(), 0);
        assertEq(escrow.balanceOf(address(vault)), 0);
        assertEq(vault.lifetimeInflow() - inflowBefore, expectedCreatorFees);
        emit log_named_decimal_uint("Pons creator fees harvested (ETH)", arrived, 18);
        emit log_named_decimal_uint("Clasp router fees (ETH)", inflowBefore, 18);

        // stream, then claim
        skip(1 hours);
        uint256 cPending = vault.pending(creatorLock);
        uint256 tPending = vault.pending(traderLock);
        assertGt(cPending, 0);
        assertGt(tPending, 0);
        uint256 creatorEth = creator.balance;
        vm.prank(creator);
        assertEq(vault.claim(creatorLock), cPending);
        assertEq(creator.balance - creatorEth, cPending);

        // accounting: the vault holds at least everything it owes
        uint256 liabilities = vault.pending(traderLock) + vault.undistributed() + vault.treasuryOwed() + vault.totalOwed();
        assertLe(liabilities, address(vault).balance);

        // treasury gets its 10%
        uint256 t = vault.claimTreasury();
        assertGt(t, 0);
        assertEq(treasury.balance, t);

        // early unlock burns to 0x…dEaD and forfeits unclaimed rewards into the stream
        uint256 deadBefore = IERC20(token).balanceOf(DEAD);
        (uint256 burn, uint256 returned, uint256 forfeited) = vault.previewEarlyUnlock(traderLock);
        assertEq(forfeited, tPending);
        uint256 tokBefore = IERC20(token).balanceOf(trader);
        vm.prank(trader);
        vault.earlyUnlock(traderLock);
        assertEq(IERC20(token).balanceOf(DEAD) - deadBefore, burn);
        assertEq(IERC20(token).balanceOf(trader) - tokBefore, returned);
        // 1 hour of the 90-day term has passed: 25% x (90d - 1h) / 90d, rounded up
        assertEq(burn, ClaspMath.earlyExitBurn(rest, 90 days - 1 hours, 90 days, 2500, 500));
        assertApproxEqRel(burn, rest / 4, 1e15);

        // matured founding lock: anyone unlocks, the creator receives
        skip(30 days);
        uint256 creatorTok = IERC20(token).balanceOf(creator);
        vm.prank(keeper);
        vault.unlock(creatorLock);
        assertEq(IERC20(token).balanceOf(creator) - creatorTok, bought / 2);
        assertEq(IERC20(token).balanceOf(keeper), 0);
    }

    /// Buy a fresh coin through graduation, seed its v4 pool, then trade through the
    /// router's v4 path and pull the post-graduation fees.
    function test_fork_graduationAndV4Trading() public {
        (address token, ClaspVault vault,,) = _launch(0, 0, 0, keccak256("clasp-fork-2"));
        PonsLaunchedToken memory lt = pons.getLaunchedToken(token);
        skip(IPonsCurveViews(lt.curve).snipeTaxSeconds() + 1);

        // an oversized buy fills the curve, is refunded the rest, and triggers graduation
        uint256 ethBefore = trader.balance;
        uint256 out = _buy(trader, token, 6 ether);
        uint256 spent = ethBefore - trader.balance;
        assertGt(out, 0);
        assertLt(spent, 6 ether, "clamped fill refunded");
        emit log_named_decimal_uint("ETH spent on the graduating buy", spent, 18);
        lt = pons.getLaunchedToken(token);
        assertEq(uint8(lt.phase), uint8(PonsGraduationPhase.Swept), "auto-graduated to Swept");

        // between sweep and pool creation the coin is not tradeable
        vm.prank(trader);
        vm.expectRevert(IClaspRouter.NotTradeable.selector);
        router.buy{value: 0.1 ether}(token, 0, _deadline());

        // graduation swept the curve fees to the vault in the escrow
        uint256 swept = escrow.balanceOf(address(vault));
        assertGt(swept, 0);
        assertEq(vault.harvest(), swept);

        IPonsFactoryExtra(PONS_FACTORY).createGraduatedPool(token);
        lt = pons.getLaunchedToken(token);
        assertEq(uint8(lt.phase), uint8(PonsGraduationPhase.PoolCreated));
        bytes32 poolId = _poolId(token);
        (bool registered,,,, address hookCreator,,,,,,,,) = IPonsV2MemeHook(PONS_HOOK).launches(poolId);
        assertTrue(registered, "router/vault PoolKey matches the Pons pool");
        assertEq(hookCreator, address(vault));

        _assertV4RoundTrip(token, vault);
        _assertOperatorSweepThenHarvest(token, vault, poolId);
    }

    /// Attach an existing, graduated coin (Pyre): its current fee recipient hands the Pons
    /// creator fees to a fresh vault; trade it through the router; harvest.
    function test_fork_attachExistingCoinPyre() public {
        PonsLaunchedToken memory lt = pons.getLaunchedToken(PYRE);
        assertTrue(lt.exists);
        assertEq(lt.pairToken, address(0));
        assertFalse(lt.buybackEnabled);
        assertEq(uint8(lt.phase), uint8(PonsGraduationPhase.PoolCreated));

        ClaspVault vault = ClaspVault(payable(factory.createVault(PYRE, factory.defaultsHash())));
        assertFalse(vault.isFeeRecipient(), "registered before the recipient moves");

        vm.prank(lt.creatorFeeRecipient);
        pons.transferCreatorFeeRecipient(PYRE, address(vault));
        assertTrue(vault.isFeeRecipient());
        bytes32 poolId = _poolId(PYRE);
        (bool registered,,,, address hookCreator,,,,,,,,) = IPonsV2MemeHook(PONS_HOOK).launches(poolId);
        assertTrue(registered);
        assertEq(hookCreator, address(vault), "post-graduation creator fees now go to the vault");

        // lock some Pyre bought through the router
        uint256 bought = _buy(trader, PYRE, 0.3 ether);
        vm.startPrank(trader);
        IERC20(PYRE).approve(address(vault), bought);
        uint256 id = vault.lock(bought, 30 days);
        vm.stopPrank();

        _assertV4RoundTrip(PYRE, vault);
        _assertOperatorSweepThenHarvest(PYRE, vault, poolId);

        skip(1 hours);
        uint256 p = vault.pending(id);
        assertGt(p, 0);
        uint256 before = trader.balance;
        vm.prank(trader);
        vault.claim(id);
        assertEq(trader.balance - before, p);
    }

    // ------------------------------------------------------------------ helpers

    function _assertV4RoundTrip(address token, ClaspVault vault) internal {
        // buy
        (uint256 q, uint256 qFee) = router.quoteBuy(token, 0.2 ether);
        uint256 vaultBefore = address(vault).balance;
        uint256 balBefore = IERC20(token).balanceOf(trader2);
        vm.prank(trader2);
        uint256 out = router.buy{value: 0.2 ether}(token, (q * 99) / 100, _deadline());
        assertEq(IERC20(token).balanceOf(trader2) - balBefore, out);
        assertEq(address(vault).balance - vaultBefore, qFee, "2% of a v4 buy");
        assertApproxEqRel(out, q, 1e15, "v4 buy quote within 0.1%");
        emit log_named_uint("v4 buy: quoted tokens", q);
        emit log_named_uint("v4 buy: received tokens", out);

        // sell
        (uint256 qs, uint256 qsFee) = router.quoteSell(token, out);
        vaultBefore = address(vault).balance;
        uint256 ethBefore = trader2.balance;
        uint256 ethOut = _sell(trader2, token, out);
        assertEq(trader2.balance - ethBefore, ethOut);
        uint256 gotFee = address(vault).balance - vaultBefore;
        assertEq(gotFee, ((ethOut + gotFee) * 200) / 10_000, "2% of a v4 sell");
        assertApproxEqRel(ethOut, qs, 1e15, "v4 sell quote within 0.1%");
        assertApproxEqRel(gotFee, qsFee, 1e15);
        assertEq(address(router).balance, 0);
        assertEq(IERC20(token).balanceOf(address(router)), 0);

        // slippage protection on the v4 path
        (q,) = router.quoteBuy(token, 0.1 ether);
        vm.prank(trader2);
        vm.expectRevert();
        router.buy{value: 0.1 ether}(token, q * 2, _deadline());
    }

    /// Post-graduation, buys leave the hook's fee in the memecoin, which only the Pons
    /// operator can convert. `harvest` tries the creator sweep (ignored if it fails) and
    /// claims whatever the escrow holds; after the operator sweeps, harvest pulls it in.
    function _assertOperatorSweepThenHarvest(address token, ClaspVault vault, bytes32 poolId) internal {
        IPonsHookExtra hook = IPonsHookExtra(PONS_HOOK);
        uint256 memePending = hook.pendingFees(poolId, token) + hook.pendingCreatorTax(poolId, token);
        uint256 ethPending = hook.pendingFees(poolId, address(0)) + hook.pendingCreatorTax(poolId, address(0));
        emit log_named_uint("hook pending memecoin fees", memePending);
        emit log_named_decimal_uint("hook pending ETH fees", ethPending, 18);
        assertGt(memePending + ethPending, 0);

        vm.prank(keeper);
        vault.harvest(); // creator sweep reverts inside Pons while memecoin fees are pending; harvest does not

        uint256 escrowBefore = escrow.balanceOf(address(vault));
        vm.prank(hook.feeSweepOperator());
        IPonsV2MemeHook(PONS_HOOK).sweepPoolFees(poolId, 1, 0);
        uint256 credited = escrow.balanceOf(address(vault)) - escrowBefore;
        assertGt(credited, 0, "operator sweep credits the vault");

        uint256 inflowBefore = vault.lifetimeInflow();
        vm.prank(keeper);
        uint256 arrived = vault.harvest();
        assertEq(arrived, escrowBefore + credited);
        assertEq(vault.lifetimeInflow() - inflowBefore, arrived);
        assertEq(escrow.balanceOf(address(vault)), 0);
        emit log_named_decimal_uint("post-graduation creator fees harvested (ETH)", arrived, 18);
    }
}
