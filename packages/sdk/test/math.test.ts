// Vectors are the values asserted against the Solidity library in
// contracts/test/ClaspMath.t.sol, so the TS mirror and the contracts agree to the wei.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TERMS,
  blendedTerm,
  durationBps,
  earlyExitBurn,
  isqrt,
  multiplierBps,
  previewIncrease,
  previewLock,
  sizeBonusBps,
  splitInflow,
  weight,
  type Position,
} from '../src/math.ts';

const MIN = DEFAULT_TERMS.minLockSecs;
const MAX = DEFAULT_TERMS.maxLockSecs;
const DAY = 86_400;
const E18 = 10n ** 18n;

test('duration multiplier curve points', () => {
  const points: [number, bigint][] = [
    [4 * 3600, 10_000n],
    [DAY, 11_433n],
    [7 * DAY, 14_105n],
    [30 * DAY, 18_578n],
    [90 * DAY, 24_886n],
    [180 * DAY, 31_062n],
    [365 * DAY, 40_000n],
    [0, 10_000n],
    [400 * DAY, 40_000n],
  ];
  for (const [secs, bps] of points) assert.equal(durationBps(secs, MIN, MAX), bps, `${secs}s`);
});

test('isqrt is the floor square root', () => {
  for (const n of [0n, 1n, 2n, 3n, 4n, 15n, 16n, 17n, 10n ** 36n, 10n ** 36n - 1n]) {
    const r = isqrt(n);
    assert.ok(r * r <= n && (r + 1n) * (r + 1n) > n, n.toString());
  }
});

test('size tiers', () => {
  const supply = 1_000_000_000n * E18;
  assert.equal(sizeBonusBps(supply / 1000n - 1n, supply), 0n);
  assert.equal(sizeBonusBps(supply / 1000n, supply), 1000n);
  assert.equal(sizeBonusBps(supply / 200n, supply), 2500n);
  assert.equal(sizeBonusBps(supply / 100n - 1n, supply), 2500n);
  assert.equal(sizeBonusBps(supply / 100n, supply), 5000n);
  assert.equal(sizeBonusBps(E18, 0n), 0n);
});

test('weight and multiplier', () => {
  assert.equal(weight(1000n * E18, 40_000n, 5000n), 6000n * E18);
  assert.equal(multiplierBps(40_000n, 5000n), 60_000n);
  assert.equal(multiplierBps(18_578n, 1000n), 20_435n);
  const p = previewLock(1_000_000_000n * E18 / 200n, 30 * DAY, 1_000_000_000n * E18);
  assert.equal(p.multiplierBps, (18_578n * 12_500n) / 10_000n);
  assert.equal(p.weight, weight(1_000_000_000n * E18 / 200n, 18_578n, 2500n));
});

test('early-exit penalty decay', () => {
  const amt = 1000n * E18;
  const term = 100 * DAY;
  assert.equal(earlyExitBurn(amt, term, term, 2500, 500), 250n * E18);
  assert.equal(earlyExitBurn(amt, term / 2, term, 2500, 500), 125n * E18);
  assert.equal(earlyExitBurn(amt, term / 5, term, 2500, 500), 50n * E18);
  assert.equal(earlyExitBurn(amt, term / 10, term, 2500, 500), 50n * E18);
  assert.equal(earlyExitBurn(amt, 1, term, 2500, 500), 50n * E18);
  assert.equal(earlyExitBurn(amt, 0, term, 2500, 500), 0n);
  assert.equal(earlyExitBurn(amt, 2 * term, term, 2500, 500), 250n * E18);
  // rounds up like the contract
  assert.equal(earlyExitBurn(3n, 1, 3, 2500, 0), 1n);
});

test('blended lockStart on top-up', () => {
  const t = blendedTerm(100n * E18, 100n * E18, 100 * DAY, 50 * DAY);
  assert.equal(t, (200n * E18 * 8_640_000n * 4_320_000n) / (100n * E18 * 4_320_000n + 100n * E18 * 8_640_000n));
  assert.equal(blendedTerm(5n * E18, 7n * E18, 30 * DAY, 30 * DAY), BigInt(30 * DAY));

  const start = 1_750_000_000;
  const pos: Position = {
    owner: '0x0000000000000000000000000000000000000001',
    lockStart: start,
    lockEnd: start + 100 * DAY,
    multiplierBps: 0,
    amount: 100n * E18,
    weight: 0n,
    rewardDebt: 0n,
    rewardCredit: 0n,
    claimed: 0n,
  };
  const inc = previewIncrease(pos, 100n * E18, start + 50 * DAY, 1_000_000_000n * E18);
  assert.equal(inc.lockStart, BigInt(start + 100 * DAY) - t);
  assert.equal(inc.weight, weight(200n * E18, durationBps(50 * DAY, MIN, MAX), 0n));
  assert.throws(() => previewIncrease(pos, E18, start + 100 * DAY - 4 * 3600 + 1, 1_000_000_000n * E18), RangeError);
  previewIncrease(pos, E18, start + 100 * DAY - 4 * 3600, 1_000_000_000n * E18);
});

test('inflow split', () => {
  assert.deepEqual(splitInflow(10n ** 18n), { toLockers: 9n * 10n ** 17n, toTreasury: 10n ** 17n });
  assert.deepEqual(splitInflow(7n), { toLockers: 6n, toTreasury: 1n });
});
