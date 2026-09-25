// TypeScript mirror of contracts/src/libraries/ClaspMath.sol and the vault's reward math.
// Every function uses bigint integer arithmetic with the same rounding as Solidity, so
// results match the contracts to the wei (see test/math.test.ts).

export const BPS = 10_000n;
/** `accRewardPerWeight` scale. */
export const ACC_SCALE = 10n ** 18n;
/** ClaspRouter fee on the ETH leg of every trade (2%). */
export const ROUTER_FEE_BPS = 200n;
export const SECONDS_PER_YEAR = 31_536_000n;

type Int = bigint | number;
const big = (x: Int): bigint => (typeof x === 'bigint' ? x : BigInt(x));

/** Lock economics frozen onto a vault. Field types match viem's decoding of the `Terms` tuple. */
export type Terms = {
  minLockSecs: number;
  maxLockSecs: number;
  streamSecs: number;
  lockerShareBps: number;
  penaltyBps: number;
  minPenaltyBps: number;
  tier1ShareBps: number;
  tier1BonusBps: number;
  tier2ShareBps: number;
  tier2BonusBps: number;
  tier3ShareBps: number;
  tier3BonusBps: number;
  minLockAmount: bigint;
};

/** Defaults the factory is deployed with (SPEC "Lock economics"). */
export const DEFAULT_TERMS: Terms = {
  minLockSecs: 4 * 3600,
  maxLockSecs: 365 * 86400,
  streamSecs: 3600,
  lockerShareBps: 9000,
  penaltyBps: 2500,
  minPenaltyBps: 500,
  tier1ShareBps: 10,
  tier1BonusBps: 1000,
  tier2ShareBps: 50,
  tier2BonusBps: 2500,
  tier3ShareBps: 100,
  tier3BonusBps: 5000,
  minLockAmount: 10n ** 18n,
};

/** Decoded `position(id)` tuple. */
export type Position = {
  owner: `0x${string}`;
  lockStart: number;
  lockEnd: number;
  multiplierBps: number;
  amount: bigint;
  weight: bigint;
  rewardDebt: bigint;
  rewardCredit: bigint;
  claimed: bigint;
};

/** Floor square root (OpenZeppelin `Math.sqrt`). */
export function isqrt(n: Int): bigint {
  const v = big(n);
  if (v < 0n) throw new RangeError('isqrt of negative');
  if (v < 2n) return v;
  let x = v;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + v / x) / 2n;
  }
  return x;
}

const ceilDiv = (a: bigint, b: bigint): bigint => (a === 0n ? 0n : (a - 1n) / b + 1n);

/**
 * Duration multiplier in bps: `10000 + isqrt(travelled * span) * 30000 / span`
 * (1.0x at `minSecs`, 4.0x at `maxSecs`, clamped outside the window).
 */
export function durationBps(secs: Int, minSecs: Int, maxSecs: Int): bigint {
  const s = big(secs);
  const lo = big(minSecs);
  if (s <= lo) return BPS;
  const span = big(maxSecs) - lo;
  const travelled = s - lo;
  if (travelled >= span) return 4n * BPS;
  return BPS + (isqrt(travelled * span) * 30_000n) / span;
}

/** Size bonus in bps for locking `amount` out of `supply` (`totalSupply()`). */
export function sizeBonusBps(amount: Int, supply: Int, terms: Terms = DEFAULT_TERMS): bigint {
  const a = big(amount);
  const s = big(supply);
  if (s === 0n) return 0n;
  const scaled = a * BPS;
  if (scaled >= s * big(terms.tier3ShareBps)) return big(terms.tier3BonusBps);
  if (scaled >= s * big(terms.tier2ShareBps)) return big(terms.tier2BonusBps);
  if (scaled >= s * big(terms.tier1ShareBps)) return big(terms.tier1BonusBps);
  return 0n;
}

/** `amount * durationBps * (10000 + sizeBonus) / 1e8`. */
export function weight(amount: Int, durBps: Int, bonusBps: Int): bigint {
  return (big(amount) * big(durBps) * (BPS + big(bonusBps))) / (BPS * BPS);
}

/** Combined display multiplier in bps: `durationBps * (10000 + sizeBonus) / 10000`. */
export function multiplierBps(durBps: Int, bonusBps: Int): bigint {
  return (big(durBps) * (BPS + big(bonusBps))) / BPS;
}

/** Same as `vault.previewMultiplier(amount, secs)` given the token's current `totalSupply`. */
export function previewLock(amount: Int, secs: Int, supply: Int, terms: Terms = DEFAULT_TERMS) {
  const dur = durationBps(secs, terms.minLockSecs, terms.maxLockSecs);
  const bonus = sizeBonusBps(amount, supply, terms);
  return {
    durationBps: dur,
    sizeBonusBps: bonus,
    multiplierBps: multiplierBps(dur, bonus),
    weight: weight(amount, dur, bonus),
  };
}

/**
 * Tokens burned by an early exit: `max(minPenaltyBps, penaltyBps * remaining / term)` of
 * `amount`, rounded up. Zero once matured.
 */
export function earlyExitBurn(amount: Int, remaining: Int, term: Int, penaltyBps: Int, minPenaltyBps: Int): bigint {
  const a = big(amount);
  let r = big(remaining);
  const t = big(term);
  if (r === 0n || a === 0n) return 0n;
  if (r > t) r = t;
  let burn = ceilDiv(a * big(penaltyBps) * r, t * BPS);
  const floorBurn = ceilDiv(a * big(minPenaltyBps), BPS);
  if (burn < floorBurn) burn = floorBurn;
  if (burn > a) burn = a;
  return burn;
}

/** Early-exit burn for a decoded position at unix time `now` (seconds). */
export function positionEarlyExitBurn(p: Position, now: Int, terms: Terms = DEFAULT_TERMS): bigint {
  const t = big(now);
  const end = big(p.lockEnd);
  if (t >= end) return 0n;
  return earlyExitBurn(p.amount, end - t, end - big(p.lockStart), terms.penaltyBps, terms.minPenaltyBps);
}

/**
 * Blended term after a top-up so the added tokens carry a fresh lock's penalty:
 * `(A+B)/T' = A/T + B/R`  =>  `T' = (A+B)·T·R / (A·R + B·T)`, rounded down.
 */
export function blendedTerm(amount: Int, added: Int, term: Int, remaining: Int): bigint {
  const a = big(amount);
  const b = big(added);
  const t = big(term);
  const r = big(remaining);
  return ((a + b) * t * r) / (a * r + b * t);
}

/** Same as `vault.previewIncrease(id, added)`: repriced to the term left, lockStart blended. */
export function previewIncrease(p: Position, added: Int, now: Int, supply: Int, terms: Terms = DEFAULT_TERMS) {
  const end = big(p.lockEnd);
  const remaining = end - big(now);
  if (remaining <= 0n) throw new RangeError('position matured');
  // vault.increase reverts InvalidDuration when less than minLockSecs is left
  if (remaining < big(terms.minLockSecs)) throw new RangeError('less than the minimum lock left; extend first');
  const next = previewLock(p.amount + big(added), remaining, supply, terms);
  const lockStart = end - blendedTerm(p.amount, added, end - big(p.lockStart), remaining);
  return { ...next, lockStart };
}

/** Whole-wei rewards of a position given the vault's `accRewardPerWeight()`. */
export function pendingRewards(p: Position, accRewardPerWeight: Int): bigint {
  return (p.rewardCredit + p.weight * big(accRewardPerWeight) - p.rewardDebt) / ACC_SCALE;
}

/** Clasp fee the router takes from `ethAmount` (buy: ETH in; sell: market ETH out). */
export function routerFee(ethAmount: Int): bigint {
  return (big(ethAmount) * ROUTER_FEE_BPS) / BPS;
}

/** Splits an inflow the way a vault does: lockers get `lockerShareBps`, rounded down. */
export function splitInflow(amount: Int, lockerShareBps: Int = DEFAULT_TERMS.lockerShareBps) {
  const a = big(amount);
  const toLockers = (a * big(lockerShareBps)) / BPS;
  return { toLockers, toTreasury: a - toLockers };
}

/**
 * Annualised APR (in bps) earned by all lockers: the lockers' share of `feesWei` that
 * arrived over `windowSecs`, annualised, divided by the ETH value of the locked tokens.
 */
export function lockerAprBps(args: {
  feesWei: Int;
  windowSecs: Int;
  lockedValueWei: Int;
  lockerShareBps?: Int;
}): bigint {
  const value = big(args.lockedValueWei);
  const window = big(args.windowSecs);
  if (value === 0n || window === 0n) return 0n;
  const share = big(args.lockerShareBps ?? DEFAULT_TERMS.lockerShareBps);
  return (big(args.feesWei) * share * SECONDS_PER_YEAR) / (window * value);
}

/**
 * Annualised APR (in bps) of one position: its `weight / totalWeight` share of the
 * lockers' annualised fees, divided by the ETH value of its tokens.
 */
export function positionAprBps(args: {
  feesWei: Int;
  windowSecs: Int;
  weight: Int;
  totalWeight: Int;
  positionValueWei: Int;
  lockerShareBps?: Int;
}): bigint {
  const total = big(args.totalWeight);
  const value = big(args.positionValueWei);
  const window = big(args.windowSecs);
  if (total === 0n || value === 0n || window === 0n) return 0n;
  const share = big(args.lockerShareBps ?? DEFAULT_TERMS.lockerShareBps);
  return (big(args.feesWei) * share * SECONDS_PER_YEAR * big(args.weight)) / (window * total * value);
}
