import { addresses, ponsCurveAbi, ponsFactoryAbi, ponsFeeEscrowAbi, ponsTokenAbi } from "@clasp/sdk";
import { getAddress, zeroAddress, type Address } from "viem";
import type { Logger } from "pino";
import { publicClient } from "./chain.ts";
import { attributeCreator, clasp, claspLauncherAbi, claspVaultAbi } from "./clasp.ts";
import { sql } from "./db.ts";
import {
  MULTICALL3,
  Phase,
  curveFeeShareAbi,
  multicall3Abi,
  poolIdOf,
  poolManagerAbi,
  poolSlot0Key,
  priceFromReserves,
  priceFromSlot0,
  type LaunchedToken,
} from "./pons.ts";
import { chunk } from "./util.ts";

/**
 * Periodic ground truth. Events say what happened; this pass reads what *is*
 * — vault accounting, the coin's Pons launch record, any pending admin
 * redirect, and the market price — so a missed or misread event can never
 * leave the site showing a stale number for more than one pass.
 *
 * Reads go out through Multicall3: one pass over every vault costs a couple
 * of RPC requests per chunk, not one per number.
 */

const COINS_PER_CHUNK = 100;

const BPS = 10_000n;

/**
 * Wei per whole token, plus creator fees the curve still holds for the vault.
 * On the curve the price is the reserve ratio, and fees accrue there until
 * swept (the vault's harvest sweeps them); once swept the price is the ratio
 * the v4 pool will be seeded at; in the pool it is slot0 and every fee goes
 * straight to the escrow.
 */
async function marketOf(launch: LaunchedToken): Promise<{ priceWei: bigint | null; curveFees: bigint }> {
  switch (launch.phase) {
    case Phase.NotGraduated: {
      const curve = <F extends "getReserves" | "quoteFeeBalance" | "creatorTaxBalance">(functionName: F) =>
        publicClient.readContract({ address: launch.curve, abi: ponsCurveAbi, functionName });
      const [[quote, tokens], quoteFees, creatorTax, protocolShareBps] = await Promise.all([
        curve("getReserves"),
        curve("quoteFeeBalance"),
        curve("creatorTaxBalance"),
        publicClient.readContract({ address: launch.curve, abi: curveFeeShareAbi, functionName: "protocolFeeShareBps" }),
      ]);
      const creatorShare = quoteFees - (quoteFees * BigInt(protocolShareBps)) / BPS;
      return { priceWei: priceFromReserves(quote, tokens), curveFees: creatorShare + creatorTax };
    }
    case Phase.Swept:
      return { priceWei: priceFromReserves(launch.sweptQuote, launch.sweptTokens), curveFees: 0n };
    case Phase.PoolCreated: {
      const slot0 = await publicClient.readContract({
        address: addresses.uniswapV4PoolManager,
        abi: poolManagerAbi,
        functionName: "extsload",
        args: [poolSlot0Key(poolIdOf(launch))],
      });
      return { priceWei: priceFromSlot0(slot0), curveFees: 0n };
    }
    default:
      return { priceWei: null, curveFees: 0n };
  }
}

async function readCoin(token: Address, vault: Address) {
  const view = <F extends "totalLocked" | "totalWeight" | "undistributed" | "streamEnd" | "accRewardPerWeight" | "treasuryOwed" | "lifetimeInflow" | "lifetimeRewards">(
    functionName: F,
  ) => publicClient.readContract({ address: vault, abi: claspVaultAbi, functionName });

  const [
    totalLocked,
    totalWeight,
    undistributed,
    streamEnd,
    accRewardPerWeight,
    treasuryOwed,
    lifetimeInflow,
    lifetimeRewards,
    balance,
    escrowBalance,
    totalSupply,
    launch,
    pending,
  ] = await Promise.all([
    view("totalLocked"),
    view("totalWeight"),
    view("undistributed"),
    view("streamEnd"),
    view("accRewardPerWeight"),
    view("treasuryOwed"),
    view("lifetimeInflow"),
    view("lifetimeRewards"),
    publicClient.readContract({ address: MULTICALL3, abi: multicall3Abi, functionName: "getEthBalance", args: [vault] }),
    publicClient.readContract({ address: addresses.ponsFeeEscrow, abi: ponsFeeEscrowAbi, functionName: "balanceOf", args: [vault] }),
    publicClient.readContract({ address: token, abi: ponsTokenAbi, functionName: "totalSupply" }),
    publicClient.readContract({ address: addresses.ponsFactory, abi: ponsFactoryAbi, functionName: "getLaunchedToken", args: [token] }),
    publicClient.readContract({
      address: addresses.ponsFactory,
      abi: ponsFactoryAbi,
      functionName: "pendingCreatorFeeRecipient",
      args: [token],
    }),
  ]);
  const { priceWei, curveFees } = await marketOf(launch).catch(() => ({ priceWei: null, curveFees: 0n }));
  const [redirectTo, effectiveAt, expiresAt] = pending;
  const hasRedirect = redirectTo !== zeroAddress;

  return {
    token,
    total_locked: totalLocked.toString(),
    total_weight: totalWeight.toString(),
    undistributed: undistributed.toString(),
    stream_end: streamEnd.toString(),
    acc_reward_per_weight: accRewardPerWeight.toString(),
    treasury_owed: treasuryOwed.toString(),
    lifetime_inflow: lifetimeInflow.toString(),
    lifetime_rewards: lifetimeRewards.toString(),
    vault_balance: balance.toString(),
    escrow_balance: escrowBalance.toString(),
    curve_fees: curveFees.toString(),
    total_supply: totalSupply.toString(),
    fee_recipient: launch.creatorFeeRecipient,
    phase: launch.phase,
    creator_tax_bps: launch.creatorTaxBps,
    redirect_to: hasRedirect ? redirectTo : null,
    redirect_effective_at: hasRedirect ? effectiveAt.toString() : null,
    redirect_expires_at: hasRedirect ? expiresAt.toString() : null,
    price_wei: priceWei?.toString() ?? null,
    market_cap_wei: priceWei === null ? null : ((priceWei * totalSupply) / 10n ** 18n).toString(),
  };
}

/** Tokens already looked up by the backfill in this process, found or not. */
const creatorChecked = new Set<Address>();

/**
 * Rows written before launcher events were indexed credit the launcher
 * contract (it is both the Pons deployer and the createVault caller of a coin
 * it launched). Its `Launched` event sits in the vault-creation block, so one
 * single-block getLogs per such coin finds the real creator.
 */
async function backfillCreators(log: Logger): Promise<void> {
  if (clasp.launcher === zeroAddress) return;
  const rows = await sql<{ token: Address; creator: Address | null; registered_by: Address; created_block: string }[]>`
    SELECT token, creator, registered_by, created_block FROM coins
    WHERE creator IS NULL OR creator = ${clasp.launcher} OR registered_by = ${clasp.launcher}
  `;
  for (const row of rows) {
    if (creatorChecked.has(row.token)) continue;
    const block = BigInt(row.created_block);
    const [event] = await publicClient.getLogs({
      address: clasp.launcher,
      event: claspLauncherAbi.find((item) => item.type === "event" && item.name === "Launched")!,
      args: { token: row.token },
      fromBlock: block,
      toBlock: block,
      strict: true,
    });
    creatorChecked.add(row.token);
    const creator = attributeCreator({
      launchedCreator: event ? getAddress(event.args.creator) : null,
      ponsDeployer: row.creator,
      registeredBy: row.registered_by,
      launcher: clasp.launcher,
    });
    if (creator !== row.creator) {
      await sql`UPDATE coins SET creator = ${creator} WHERE token = ${row.token}`;
      log.info({ token: row.token, from: row.creator, to: creator }, "creator backfilled");
    }
  }
}

export async function reconcile(log: Logger): Promise<void> {
  await backfillCreators(log).catch((err) => log.warn({ err }, "creator backfill failed"));
  const coins = await sql<{ token: Address; vault: Address }[]>`SELECT token, vault FROM coins ORDER BY created_block`;
  let failed = 0;
  for (const group of chunk(coins, COINS_PER_CHUNK)) {
    const results = await Promise.allSettled(group.map((c) => readCoin(c.token, c.vault)));
    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        failed++;
        log.warn({ token: group[i].token, err: result.reason }, "reconcile read failed");
        continue;
      }
      const { token, ...columns } = result.value;
      await sql`UPDATE coins SET ${sql(columns)}, reconciled_at = now() WHERE token = ${token}`;
    }
  }
  log.debug({ coins: coins.length, failed }, "reconciled");
}
