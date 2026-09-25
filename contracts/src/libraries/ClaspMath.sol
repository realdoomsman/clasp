// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Lock economics frozen onto each vault at creation. All `Bps` fields are
/// basis points (1/10000). Tier shares are the lock's share of `totalSupply()`.
struct Terms {
    uint32 minLockSecs;
    uint32 maxLockSecs;
    uint32 streamSecs;
    uint16 lockerShareBps;
    uint16 penaltyBps;
    uint16 minPenaltyBps;
    uint16 tier1ShareBps;
    uint16 tier1BonusBps;
    uint16 tier2ShareBps;
    uint16 tier2BonusBps;
    uint16 tier3ShareBps;
    uint16 tier3BonusBps;
    uint128 minLockAmount;
}

/// @notice Pure math shared by the vault and mirrored 1:1 in `@clasp/sdk` (math.ts).
library ClaspMath {
    uint256 internal constant BPS = 10_000;

    /// @notice Duration multiplier in bps: `10000 + isqrt(travelled * span) * 30000 / span`,
    /// i.e. 1.0x at `minLockSecs` rising along a square root to 4.0x at `maxLockSecs`.
    /// Durations outside the window are clamped to it.
    function durationBps(uint256 secs, uint256 minSecs, uint256 maxSecs) internal pure returns (uint256) {
        if (secs <= minSecs) return BPS;
        uint256 span = maxSecs - minSecs;
        uint256 travelled = secs - minSecs;
        if (travelled >= span) return 4 * BPS;
        return BPS + (Math.sqrt(travelled * span) * 30_000) / span;
    }

    /// @notice Size bonus in bps for locking `amount` out of `supply`.
    function sizeBonusBps(uint256 amount, uint256 supply, Terms memory t) internal pure returns (uint256) {
        if (supply == 0) return 0;
        uint256 scaled = amount * BPS;
        if (scaled >= supply * t.tier3ShareBps) return t.tier3BonusBps;
        if (scaled >= supply * t.tier2ShareBps) return t.tier2BonusBps;
        if (scaled >= supply * t.tier1ShareBps) return t.tier1BonusBps;
        return 0;
    }

    /// @notice `amount * durationBps * (10000 + sizeBonus) / 1e8`.
    function weight(uint256 amount, uint256 durBps, uint256 bonusBps) internal pure returns (uint256) {
        return Math.mulDiv(amount, durBps * (BPS + bonusBps), BPS * BPS);
    }

    /// @notice Combined multiplier in bps, for display: `durationBps * (10000 + sizeBonus) / 10000`.
    function multiplierBps(uint256 durBps, uint256 bonusBps) internal pure returns (uint256) {
        return (durBps * (BPS + bonusBps)) / BPS;
    }

    /// @notice Tokens burned by an early exit: `max(minPenaltyBps, penaltyBps * remaining / term)`
    /// of `amount`, rounded up. Zero once matured.
    function earlyExitBurn(
        uint256 amount,
        uint256 remaining,
        uint256 term,
        uint256 penaltyBps_,
        uint256 minPenaltyBps_
    ) internal pure returns (uint256 burn) {
        if (remaining == 0 || amount == 0) return 0;
        if (remaining > term) remaining = term;
        burn = Math.mulDiv(amount, penaltyBps_ * remaining, term * BPS, Math.Rounding.Ceil);
        uint256 floorBurn = Math.mulDiv(amount, minPenaltyBps_, BPS, Math.Rounding.Ceil);
        if (burn < floorBurn) burn = floorBurn;
        if (burn > amount) burn = amount;
    }

    /// @notice Blended term after topping up `added` onto `amount` locked for `term`
    /// with `remaining` seconds left, so the added tokens carry a fresh lock's penalty:
    /// `(A+B)/T' = A/T + B/R`  =>  `T' = (A+B)·T·R / (A·R + B·T)`, rounded down (a
    /// shorter term means a larger penalty, never a smaller one).
    function blendedTerm(uint256 amount, uint256 added, uint256 term, uint256 remaining)
        internal
        pure
        returns (uint256)
    {
        return Math.mulDiv(amount + added, term * remaining, amount * remaining + added * term);
    }
}
