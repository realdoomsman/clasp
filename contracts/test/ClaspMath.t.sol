// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ClaspMath, Terms} from "../src/libraries/ClaspMath.sol";
import {defaultTerms} from "./utils/Base.sol";

contract ClaspMathTest is Test {
    uint256 constant MIN = 4 hours;
    uint256 constant MAX = 365 days;

    function test_multiplierCurvePoints() public pure {
        assertEq(ClaspMath.durationBps(4 hours, MIN, MAX), 10_000, "4h = 1.0x");
        assertEq(ClaspMath.durationBps(1 days, MIN, MAX), 11_433, "1d");
        assertEq(ClaspMath.durationBps(7 days, MIN, MAX), 14_105, "7d");
        assertEq(ClaspMath.durationBps(30 days, MIN, MAX), 18_578, "30d");
        assertEq(ClaspMath.durationBps(90 days, MIN, MAX), 24_886, "90d");
        assertEq(ClaspMath.durationBps(180 days, MIN, MAX), 31_062, "180d");
        assertEq(ClaspMath.durationBps(365 days, MIN, MAX), 40_000, "365d = 4.0x");
    }

    function test_multiplierClampsOutsideWindow() public pure {
        assertEq(ClaspMath.durationBps(0, MIN, MAX), 10_000);
        assertEq(ClaspMath.durationBps(1 hours, MIN, MAX), 10_000);
        assertEq(ClaspMath.durationBps(400 days, MIN, MAX), 40_000);
    }

    function testFuzz_multiplierMonotonicAndBounded(uint256 a, uint256 b) public pure {
        a = bound(a, 0, 2 * MAX);
        b = bound(b, a, 2 * MAX);
        uint256 ma = ClaspMath.durationBps(a, MIN, MAX);
        uint256 mb = ClaspMath.durationBps(b, MIN, MAX);
        assertLe(ma, mb);
        assertGe(ma, 10_000);
        assertLe(mb, 40_000);
    }

    function test_sizeTiers() public pure {
        Terms memory t = defaultTerms();
        uint256 supply = 1_000_000_000e18;
        assertEq(ClaspMath.sizeBonusBps(supply / 1000 - 1, supply, t), 0, "just under 0.1%");
        assertEq(ClaspMath.sizeBonusBps(supply / 1000, supply, t), 1000, "0.1% -> +10%");
        assertEq(ClaspMath.sizeBonusBps(supply / 200 - 1, supply, t), 1000);
        assertEq(ClaspMath.sizeBonusBps(supply / 200, supply, t), 2500, "0.5% -> +25%");
        assertEq(ClaspMath.sizeBonusBps(supply / 100 - 1, supply, t), 2500);
        assertEq(ClaspMath.sizeBonusBps(supply / 100, supply, t), 5000, "1% -> +50%");
        assertEq(ClaspMath.sizeBonusBps(supply, supply, t), 5000);
        assertEq(ClaspMath.sizeBonusBps(1e18, 0, t), 0, "zero supply");
    }

    function test_weightAndMultiplier() public pure {
        // 1000 tokens, 365d (4.0x), +50% => 6.0x
        assertEq(ClaspMath.weight(1000e18, 40_000, 5000), 6000e18);
        assertEq(ClaspMath.multiplierBps(40_000, 5000), 60_000);
        // 1 token at 1.0x, no bonus
        assertEq(ClaspMath.weight(1e18, 10_000, 0), 1e18);
        // 30d with +10%
        assertEq(ClaspMath.weight(100e18, 18_578, 1000), (100e18 * 18_578 * 11_000) / 1e8);
        assertEq(ClaspMath.multiplierBps(18_578, 1000), 20_435);
    }

    function test_penaltyDecay() public pure {
        uint256 amt = 1000e18;
        uint256 term = 100 days;
        // full remaining: 25%
        assertEq(ClaspMath.earlyExitBurn(amt, term, term, 2500, 500), 250e18);
        // half remaining: 12.5%
        assertEq(ClaspMath.earlyExitBurn(amt, term / 2, term, 2500, 500), 125e18);
        // 20% remaining: exactly the 5% floor
        assertEq(ClaspMath.earlyExitBurn(amt, term / 5, term, 2500, 500), 50e18);
        // 10% remaining: 2.5% < floor -> 5%
        assertEq(ClaspMath.earlyExitBurn(amt, term / 10, term, 2500, 500), 50e18);
        // 1 second remaining: still the floor
        assertEq(ClaspMath.earlyExitBurn(amt, 1, term, 2500, 500), 50e18);
        // matured: nothing
        assertEq(ClaspMath.earlyExitBurn(amt, 0, term, 2500, 500), 0);
        // remaining can't exceed term
        assertEq(ClaspMath.earlyExitBurn(amt, 2 * term, term, 2500, 500), 250e18);
        // max 50%
        assertEq(ClaspMath.earlyExitBurn(amt, term, term, 5000, 500), 500e18);
    }

    function testFuzz_penaltyDecaysMonotonically(uint256 amt, uint256 term, uint256 r1, uint256 r2) public pure {
        amt = bound(amt, 1, 1e30);
        term = bound(term, 1, 365 days);
        r1 = bound(r1, 1, term);
        r2 = bound(r2, r1, term);
        uint256 b1 = ClaspMath.earlyExitBurn(amt, r1, term, 2500, 500);
        uint256 b2 = ClaspMath.earlyExitBurn(amt, r2, term, 2500, 500);
        assertLe(b1, b2, "less time left, less burn");
        assertGe(b1, (amt * 500) / 10_000, "floor");
        assertLe(b2, (amt * 2500 + 9999) / 10_000, "cap");
    }

    /// @dev SPEC: `(A+B)/T' = A/T + B/R` — after a top-up the position's penalty equals the
    /// old tokens' penalty plus a fresh lock's full penalty on the added tokens.
    function testFuzz_blendedLockStartProperty(uint256 a, uint256 b, uint256 term, uint256 remaining) public pure {
        a = bound(a, 1e18, 1e30);
        b = bound(b, 1, 1e30);
        term = bound(term, 4 hours, 365 days);
        remaining = bound(remaining, 1, term);
        uint256 newTerm = ClaspMath.blendedTerm(a, b, term, remaining);
        assertGe(newTerm, remaining, "T' >= R");
        assertLe(newTerm, term, "T' <= T");

        // penalty "mass" at a 100% rate: (A+B)·R/T' must equal A·R/T + B (the old tokens'
        // remaining penalty plus a fresh lock's full penalty on the added tokens). T' is
        // floored, which can only raise the penalty, by less than one part in T'.
        uint256 blended = ((a + b) * remaining * 1e18) / newTerm;
        uint256 separate = (a * remaining * 1e18) / term + b * 1e18;
        assertGe(blended + 1, separate, "never below the separate penalties");
        assertLe(blended, separate + blended / (newTerm + 1) + 2, "above them only by rounding");
    }

    function test_blendedTermExamples() public pure {
        // A=100 locked 100d, 50d left, add B=100: T' = 200·100·50/(100·50+100·100) = 66.66d
        uint256 t = ClaspMath.blendedTerm(100e18, 100e18, 100 days, 50 days);
        assertEq(t, (200e18 * uint256(100 days) * 50 days) / (100e18 * uint256(50 days) + 100e18 * uint256(100 days)));
        // Fresh position (R = T) stays unchanged
        assertEq(ClaspMath.blendedTerm(5e18, 7e18, 30 days, 30 days), 30 days);
    }
}
