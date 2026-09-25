import { lockerAprBps } from "@clasp/sdk";
import { getAddress, isAddress, type Address } from "viem";
import { z } from "zod";
import type { CoinSummary } from "../types.ts";

export const addressSchema = z
  .string()
  .refine((v) => isAddress(v, { strict: false }), "not an address")
  .transform((v) => getAddress(v));

export const AddressParams = z.object({ address: addressSchema });
export const TokenParams = z.object({ token: addressSchema });

export const Paging = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

/**
 * Columns every coin view selects: the coin row plus the 7-day lockers'
 * share of fees (what APR is computed from), open-lock owner count and the
 * ETH value of the locked tokens. Used as `FROM coins c ${coinJoins}`.
 */
export const COIN_SELECT = `
  c.*,
  COALESCE(f.to_lockers, 0)::text AS to_lockers_7d,
  COALESCE(h.lockers, 0)::int AS lockers,
  CASE WHEN c.price_wei IS NULL THEN NULL ELSE trunc(c.total_locked * c.price_wei / 1e18) END::text AS locked_value
`;

export const COIN_JOINS = `
  LEFT JOIN (
    SELECT vault, sum((data->>'toLockers')::numeric) AS to_lockers
    FROM events
    WHERE kind = 'fees' AND block_time > now() - interval '7 days'
    GROUP BY vault
  ) f ON f.vault = c.vault
  LEFT JOIN (
    SELECT vault, count(DISTINCT owner) AS lockers
    FROM positions
    WHERE open
    GROUP BY vault
  ) h ON h.vault = c.vault
`;

export interface CoinRecord {
  token: Address;
  vault: Address;
  registered_by: Address;
  creator: Address | null;
  name: string;
  symbol: string;
  total_supply: string;
  logo: string | null;
  description: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
  farcaster: string | null;
  creator_tax_bps: number;
  phase: number;
  fee_recipient: Address | null;
  redirect_to: Address | null;
  redirect_effective_at: string | null;
  redirect_expires_at: string | null;
  treasury: Address | null;
  terms: Record<string, string>;
  created_at: Date;
  total_locked: string;
  total_weight: string;
  vault_balance: string;
  escrow_balance: string;
  curve_fees: string;
  undistributed: string;
  stream_end: string;
  acc_reward_per_weight: string;
  treasury_owed: string;
  lifetime_inflow: string;
  lifetime_rewards: string;
  price_wei: string | null;
  market_cap_wei: string | null;
  to_lockers_7d: string;
  lockers: number;
  locked_value: string | null;
}

const WEEK_SECS = 7n * 24n * 60n * 60n;

/**
 * Lockers' 7-day take, annualised, over the ETH value of what is locked, as
 * a percent (the SDK's `lockerAprBps`, fed the lockers' share directly).
 * Null without a price or with nothing locked: a made-up number is worse
 * than none.
 */
export function aprPercent(toLockers7d: string, lockedValue: string | null): number | null {
  if (lockedValue === null || BigInt(lockedValue) === 0n) return null;
  const bps = lockerAprBps({
    feesWei: BigInt(toLockers7d),
    windowSecs: WEEK_SECS,
    lockedValueWei: BigInt(lockedValue),
    lockerShareBps: 10_000n,
  });
  return Number(bps) / 100;
}

export function toSummary(c: CoinRecord): CoinSummary {
  return {
    token: c.token,
    vault: c.vault,
    name: c.name,
    symbol: c.symbol,
    image: c.logo,
    creator: c.creator ?? c.registered_by,
    priceEth: c.price_wei,
    marketCapEth: c.market_cap_wei,
    totalSupply: c.total_supply,
    totalLocked: c.total_locked,
    totalWeight: c.total_weight,
    lockers: c.lockers,
    paidToLockers: c.lifetime_rewards,
    apr: aprPercent(c.to_lockers_7d, c.locked_value),
    graduated: c.phase !== 0,
    createdAt: Math.floor(c.created_at.getTime() / 1000),
  };
}
