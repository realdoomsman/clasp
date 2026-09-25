// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Base} from "./utils/Base.sol";
import {ClaspRouter} from "../src/ClaspRouter.sol";
import {ClaspVault} from "../src/ClaspVault.sol";
import {IClaspRouter} from "../src/interfaces/IClaspRouter.sol";
import {IClaspVault} from "../src/interfaces/IClaspVault.sol";
import {PonsTokenParams, PonsSocials, PonsGraduationPhase} from "../src/interfaces/IPons.sol";
import {MockCurve} from "./mocks/PonsMocks.sol";

contract ClaspRouterTest is Base {
    ClaspRouter internal router;
    address internal coin;
    MockCurve internal curve;
    ClaspVault internal coinVault;

    function setUp() public override {
        super.setUp();
        router = new ClaspRouter(address(factory));
        vm.deal(creator, 1 ether);
        vm.prank(creator);
        (address t, address c) = pons.launchToken{value: 0.0005 ether}(_params(creator), 0, address(0));
        coin = t;
        curve = MockCurve(payable(c));
        coinVault = ClaspVault(payable(factory.createVault(coin, bytes32(0))));
        vm.prank(creator);
        pons.transferCreatorFeeRecipient(coin, address(coinVault));
        vm.deal(alice, 100 ether);
    }

    function test_immutables() public view {
        assertEq(router.factory(), address(factory));
        assertEq(router.ponsFactory(), address(pons));
        assertEq(router.memeHook(), address(hook));
        assertEq(router.poolManager(), address(0x4444));
        assertEq(router.FEE_BPS(), 200);
    }

    function test_buy() public {
        (uint256 quoted, uint256 quotedFee) = router.quoteBuy(coin, 1 ether);
        assertEq(quotedFee, 0.02 ether);

        vm.expectEmit(address(router));
        emit IClaspRouter.Trade(coin, alice, true, 1 ether, quoted, 0.02 ether);
        vm.prank(alice);
        uint256 out = router.buy{value: 1 ether}(coin, quoted, vm.getBlockTimestamp());

        assertEq(out, quoted, "quote is exact pre-graduation");
        assertEq(IERC20(coin).balanceOf(alice), out);
        assertEq(address(coinVault).balance, 0.02 ether, "2% landed in the vault");
        assertEq(coinVault.lifetimeInflow(), 0.02 ether, "router synced the vault");
        assertEq(address(router).balance, 0);
        assertEq(alice.balance, 99 ether);
    }

    function test_sell() public {
        vm.prank(alice);
        uint256 bought = router.buy{value: 1 ether}(coin, 0, vm.getBlockTimestamp());
        uint256 half = bought / 2;
        (uint256 quoted, uint256 quotedFee) = router.quoteSell(coin, half);

        vm.startPrank(alice);
        IERC20(coin).approve(address(router), half);
        uint256 ethBefore = alice.balance;
        vm.expectEmit(address(router));
        emit IClaspRouter.Trade(coin, alice, false, quoted + quotedFee, half, quotedFee);
        uint256 out = router.sell(coin, half, quoted, vm.getBlockTimestamp());
        vm.stopPrank();

        assertEq(out, quoted);
        assertEq(alice.balance - ethBefore, out);
        assertEq(quotedFee, ((out + quotedFee) * 200) / 10_000);
        assertEq(address(coinVault).balance, 0.02 ether + quotedFee);
        assertEq(IERC20(coin).balanceOf(address(router)), 0);
        assertEq(address(router).balance, 0);
    }

    function test_buy_clampedAtGraduationRefundsAndReprices() public {
        vm.deal(alice, 100 ether);
        uint256 sellable = curve.sellableTokens();
        vm.prank(alice);
        uint256 out = router.buy{value: 50 ether}(coin, 0, vm.getBlockTimestamp());
        assertEq(out, sellable, "filled up to the reserved allocation");
        uint256 spentOnCurve = curve.trackedQuote();
        uint256 fee = (spentOnCurve * 200) / 9800;
        assertEq(address(coinVault).balance, fee, "fee charged on what was spent");
        assertEq(alice.balance, 100 ether - spentOnCurve - fee, "unspent ETH and unused fee refunded");
        assertEq(address(router).balance, 0);
        assertTrue(curve.readyToGraduate());

        vm.prank(alice);
        vm.expectRevert(bytes("CurveGraduated"));
        router.buy{value: 1 ether}(coin, 0, vm.getBlockTimestamp());
        vm.expectRevert(IClaspRouter.NotTradeable.selector);
        router.quoteBuy(coin, 1 ether);
    }

    function test_reverts() public {
        vm.startPrank(alice);
        vm.expectRevert(IClaspRouter.Expired.selector);
        router.buy{value: 1 ether}(coin, 0, vm.getBlockTimestamp() - 1);
        vm.expectRevert(IClaspRouter.Expired.selector);
        router.sell(coin, 1, 0, vm.getBlockTimestamp() - 1);
        vm.expectRevert(IClaspRouter.ZeroAmount.selector);
        router.buy{value: 0}(coin, 0, vm.getBlockTimestamp());
        vm.expectRevert(IClaspRouter.ZeroAmount.selector);
        router.sell(coin, 0, 0, vm.getBlockTimestamp());
        vm.expectRevert(IClaspRouter.NoVault.selector);
        router.buy{value: 1 ether}(address(0xdead), 0, vm.getBlockTimestamp());
        vm.expectRevert(IClaspRouter.NoVault.selector);
        router.sell(address(0xdead), 1, 0, vm.getBlockTimestamp());
        // curve slippage bubbles up
        (uint256 q,) = router.quoteBuy(coin, 1 ether);
        vm.expectRevert(bytes("SlippageExceeded"));
        router.buy{value: 1 ether}(coin, q + 1, vm.getBlockTimestamp());
        // router slippage on sells
        uint256 bought = router.buy{value: 1 ether}(coin, 0, vm.getBlockTimestamp());
        IERC20(coin).approve(address(router), bought);
        (uint256 e,) = router.quoteSell(coin, bought);
        vm.expectRevert(abi.encodeWithSelector(IClaspRouter.Slippage.selector, e, e + 1));
        router.sell(coin, bought, e + 1, vm.getBlockTimestamp());
        vm.stopPrank();
    }

    function test_notTradeablePhases() public {
        vm.prank(alice);
        uint256 bought = router.buy{value: 1 ether}(coin, 0, vm.getBlockTimestamp());
        vm.prank(alice);
        IERC20(coin).approve(address(router), bought);
        PonsGraduationPhase[2] memory phases = [PonsGraduationPhase.Swept, PonsGraduationPhase.Rescued];
        for (uint256 i; i < 2; ++i) {
            pons.setPhase(coin, phases[i]);
            vm.startPrank(alice);
            vm.expectRevert(IClaspRouter.NotTradeable.selector);
            router.buy{value: 1 ether}(coin, 0, vm.getBlockTimestamp());
            vm.expectRevert(IClaspRouter.NotTradeable.selector);
            router.sell(coin, bought, 0, vm.getBlockTimestamp());
            vm.stopPrank();
            vm.expectRevert(IClaspRouter.NotTradeable.selector);
            router.quoteBuy(coin, 1 ether);
            vm.expectRevert(IClaspRouter.NotTradeable.selector);
            router.quoteSell(coin, 1e18);
        }
    }

    function test_unlockCallback_onlyPoolManager() public {
        vm.expectRevert(IClaspRouter.NotPoolManager.selector);
        router.unlockCallback("");
    }

    function test_feesStreamToLockersInVault() public {
        vm.deal(bob, 10 ether);
        vm.startPrank(bob);
        uint256 bought = router.buy{value: 1 ether}(coin, 0, vm.getBlockTimestamp());
        IERC20(coin).approve(address(coinVault), bought);
        uint256 id = coinVault.lock(bought, 30 days);
        vm.stopPrank();
        vm.prank(alice);
        router.buy{value: 2 ether}(coin, 0, vm.getBlockTimestamp());
        skip(1 hours);
        // Bob locked in the same block both fees arrived, before any of the stream was
        // released, so as the only weight he receives the lockers' 90% of both 2% fees.
        // (weight here is ~1e27, so the not-yet-distributed rounding carry is up to ~1e9 wei)
        assertApproxEqRel(coinVault.pending(id), 0.054 ether, 1e11);
        assertApproxEqRel(coinVault.treasuryOwed(), 0.006 ether, 1e11);
    }

    function _params(address recipient) internal pure returns (PonsTokenParams memory) {
        return PonsTokenParams({
            name: "Coin",
            symbol: "C",
            logo: "",
            description: "",
            socials: PonsSocials("", "", "", "", ""),
            creatorFeeRecipient: recipient,
            creatorTaxBps: 100,
            buybackEnabled: false,
            expectedEconomics: bytes32(0),
            salt: bytes32(uint256(1))
        });
    }
}
