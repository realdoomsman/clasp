import { addresses, ponsFactoryAbi, ponsTokenAbi } from "@clasp/sdk";
import { getAddress, isAddressEqual, parseEventLogs, zeroAddress, type Address, type Hash } from "viem";
import { publicClient } from "./chain.ts";
import { attributeCreator, clasp, claspDeployed, claspFactoryAbi, claspLauncherAbi, claspRouterAbi, claspVaultAbi } from "./clasp.ts";
import type postgres from "postgres";
import { sql } from "./db.ts";
import { cleanText, ponsRecipientEvents, safeUrl, socialUrl } from "./pons.ts";
import { chunk, mapLimit, plain } from "./util.ts";

/**
 * Turns one confirmed block range into rows. Every write is keyed by where
 * the log sits in the chain (tx hash, log index) or derived from rows that
 * are, so replaying a range after a crash is a no-op, and the cursor moves in
 * the same transaction as the rows it covers.
 */

export const CURSOR = "main";
/** Public RPCs cap the address list of one eth_getLogs call. */
const VAULT_ADDRESS_CHUNK = 500;

/** vault → token for every Clasp vault the indexer knows. */
export type VaultIndex = Map<Address, Address>;

export async function loadCursor(): Promise<bigint | null> {
  const [row] = await sql<{ block: string }[]>`SELECT block FROM indexer_cursor WHERE name = ${CURSOR}`;
  return row ? BigInt(row.block) : null;
}

export async function loadVaults(): Promise<VaultIndex> {
  const rows = await sql<{ vault: Address; token: Address }[]>`SELECT vault, token FROM coins`;
  return new Map(rows.map((r) => [r.vault, r.token]));
}

const KIND: Record<string, string> = {
  Locked: "lock",
  Increased: "increase",
  Extended: "extend",
  Claimed: "claim",
  Unlocked: "unlock",
  FeesArrived: "fees",
  TreasuryClaimed: "treasury",
  Owed: "owed",
  OwedWithdrawn: "owed_withdrawn",
};

interface EventRow {
  tx_hash: Hash;
  log_index: number;
  block_number: string;
  block_time: Date;
  vault: Address;
  token: Address;
  kind: string;
  position_id: string | null;
  owner: Address | null;
  amount: string;
  data: postgres.Parameter;
}

interface CoinRow {
  token: Address;
  vault: Address;
  registered_by: Address;
  creator: Address | null;
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string;
  logo: string | null;
  description: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
  farcaster: string | null;
  curve: Address | null;
  creator_tax_bps: number;
  pool_fee: number | null;
  tick_spacing: number | null;
  phase: number;
  fee_recipient: Address | null;
  treasury: Address | null;
  terms: postgres.Parameter;
  created_block: string;
  created_at: Date;
  metadata_at: Date;
}

interface Located {
  blockNumber: bigint | null;
  logIndex: number | null;
  transactionHash: Hash | null;
}

const order = (a: Located, b: Located) =>
  a.blockNumber === b.blockNumber ? (a.logIndex ?? 0) - (b.logIndex ?? 0) : a.blockNumber! < b.blockNumber! ? -1 : 1;

const blockTimeCache = new Map<bigint, Date>();

async function blockTimes(numbers: Iterable<bigint>): Promise<Map<bigint, Date>> {
  const missing = [...new Set(numbers)].filter((n) => !blockTimeCache.has(n));
  await mapLimit(missing, 8, async (blockNumber) => {
    const block = await publicClient.getBlock({ blockNumber });
    blockTimeCache.set(blockNumber, new Date(Number(block.timestamp) * 1000));
  });
  // The cache only has to span one range; keep it from growing without bound.
  if (blockTimeCache.size > 50_000) blockTimeCache.clear();
  return blockTimeCache;
}

/**
 * Everything the coin page shows that the coin itself declares. Only http(s)
 * URLs are kept; nothing here is fetched, so a hostile logo URL can at worst
 * be a broken image in a visitor's browser.
 */
async function describeCoin(token: Address, vault: Address): Promise<Omit<CoinRow, "registered_by" | "terms" | "created_block" | "created_at">> {
  const tokenRead = <F extends "name" | "symbol" | "decimals" | "totalSupply" | "getTokenInfo">(functionName: F) =>
    publicClient.readContract({ address: token, abi: ponsTokenAbi, functionName });
  const [name, symbol, decimals, totalSupply, info, launch, treasury] = await Promise.all([
    tokenRead("name").catch(() => ""),
    tokenRead("symbol").catch(() => ""),
    tokenRead("decimals").catch(() => 18),
    tokenRead("totalSupply").catch(() => 0n),
    tokenRead("getTokenInfo").catch(() => null),
    publicClient
      .readContract({ address: addresses.ponsFactory, abi: ponsFactoryAbi, functionName: "getLaunchedToken", args: [token] })
      .catch(() => null),
    publicClient.readContract({ address: vault, abi: claspVaultAbi, functionName: "treasury" }).catch(() => null),
  ]);
  const [deployer, logo, description, socials] = info ?? [null, "", "", null];
  return {
    token,
    vault,
    creator: deployer ?? launch?.deployer ?? null,
    name: cleanText(name, 64),
    symbol: cleanText(symbol, 32),
    decimals: Number(decimals),
    total_supply: totalSupply.toString(),
    logo: safeUrl(logo),
    description: description ? cleanText(description, 2_000) : null,
    website: safeUrl(socials?.website),
    twitter: socials ? socialUrl("twitter", socials.twitter) : null,
    telegram: socials ? socialUrl("telegram", socials.telegram) : null,
    discord: safeUrl(socials?.discord),
    farcaster: safeUrl(socials?.farcaster),
    curve: launch?.curve ?? null,
    creator_tax_bps: launch?.creatorTaxBps ?? 0,
    pool_fee: launch?.poolFee ?? null,
    tick_spacing: launch?.tickSpacing ?? null,
    phase: launch?.phase ?? 0,
    fee_recipient: launch?.creatorFeeRecipient ?? null,
    treasury: treasury as Address | null,
    metadata_at: new Date(),
  };
}

export interface IngestSummary {
  vaultsCreated: number;
  vaultEvents: number;
  trades: number;
  ponsEvents: number;
  launches: number;
}

export async function ingestRange(fromBlock: bigint, toBlock: bigint, vaults: VaultIndex): Promise<IngestSummary> {
  // 1. Our own factory, router and launcher in one call.
  const coreAddresses = claspDeployed ? [clasp.factory, clasp.router, clasp.launcher].filter((a) => a !== zeroAddress) : [];
  const coreLogs = coreAddresses.length ? await publicClient.getLogs({ address: coreAddresses, fromBlock, toBlock }) : [];
  const factoryEvents = parseEventLogs({
    abi: claspFactoryAbi,
    logs: coreLogs.filter((l) => isAddressEqual(l.address, clasp.factory)),
  });
  const trades = parseEventLogs({
    abi: claspRouterAbi,
    eventName: "Trade",
    logs: coreLogs.filter((l) => clasp.router !== zeroAddress && isAddressEqual(l.address, clasp.router)),
  });
  // Launched and VaultCreated come from the same launch transaction, so they
  // always land in the same range; matched by token, not by log order.
  const launched = parseEventLogs({
    abi: claspLauncherAbi,
    eventName: "Launched",
    logs: coreLogs.filter((l) => clasp.launcher !== zeroAddress && isAddressEqual(l.address, clasp.launcher)),
  });
  const launchedCreator = new Map(launched.map((e) => [getAddress(e.args.token), getAddress(e.args.creator)]));

  // 2. Vaults created in this range join the scan of this same range, since
  // a coin's first lock can land in the block its vault is created.
  const created = factoryEvents.flatMap((e) => (e.eventName === "VaultCreated" ? [e] : []));
  const scanVaults: VaultIndex = new Map(vaults);
  for (const e of created) scanVaults.set(getAddress(e.args.vault), getAddress(e.args.token));

  const vaultLogs = (
    await Promise.all(
      chunk([...scanVaults.keys()], VAULT_ADDRESS_CHUNK).map((address) =>
        publicClient.getLogs({ address, fromBlock, toBlock }),
      ),
    )
  ).flat();
  const vaultEvents = parseEventLogs({ abi: claspVaultAbi, logs: vaultLogs }).sort(order);

  // 3. Pons factory: proposals, cancellations and changes of the creator fee
  // recipient, kept only for Clasp coins. Rare, so one unfiltered-by-token call.
  const tokens = new Set(scanVaults.values());
  const ponsEvents = tokens.size
    ? (
        await publicClient.getLogs({ address: addresses.ponsFactory, events: ponsRecipientEvents, fromBlock, toBlock, strict: true })
      )
        .filter((l) => tokens.has(getAddress(l.args.token)))
        .sort(order)
    : [];

  const summary: IngestSummary = {
    vaultsCreated: created.length,
    vaultEvents: vaultEvents.length,
    trades: trades.length,
    ponsEvents: ponsEvents.length,
    launches: launched.length,
  };
  if (!created.length && !vaultEvents.length && !trades.length && !ponsEvents.length && !launched.length) {
    await sql`
      INSERT INTO indexer_cursor (name, block) VALUES (${CURSOR}, ${toBlock.toString()})
      ON CONFLICT (name) DO UPDATE SET block = EXCLUDED.block, updated_at = now()
    `;
    return summary;
  }

  const times = await blockTimes(
    [...created, ...vaultEvents, ...trades, ...ponsEvents].map((l) => l.blockNumber),
  );
  const timeOf = (l: Located) => times.get(l.blockNumber!)!;

  const coinRows: CoinRow[] = await mapLimit(created, 4, async (e) => {
    const token = getAddress(e.args.token);
    const coin = await describeCoin(token, getAddress(e.args.vault));
    const registeredBy = getAddress(e.args.creator);
    return {
      ...coin,
      creator: attributeCreator({
        launchedCreator: launchedCreator.get(token) ?? null,
        ponsDeployer: coin.creator,
        registeredBy,
        launcher: clasp.launcher,
      }),
      registered_by: registeredBy,
      terms: sql.json(plain(e.args.terms)),
      created_block: e.blockNumber.toString(),
      created_at: timeOf(e),
    };
  });

  const eventRows: EventRow[] = vaultEvents.map((e) => {
    const { id, owner, recipient, amount, ...rest } = e.args as Record<string, unknown>;
    const vault = getAddress(e.address);
    const who = (owner ?? recipient) as Address | undefined;
    return {
      tx_hash: e.transactionHash,
      log_index: e.logIndex,
      block_number: e.blockNumber.toString(),
      block_time: timeOf(e),
      vault,
      token: scanVaults.get(vault)!,
      kind: KIND[e.eventName] ?? e.eventName,
      position_id: id === undefined ? null : String(id),
      owner: who ? getAddress(who) : null,
      amount: amount === undefined ? "0" : String(amount),
      data: sql.json(plain(rest)),
    };
  });

  // Position state: opened from Locked, closed by Unlocked (terminal), and in
  // between refreshed from the vault's own view, so the row never depends on
  // re-deriving the contract's repricing arithmetic off chain.
  const opened = vaultEvents.flatMap((e) => (e.eventName === "Locked" ? [e] : []));
  const closed = vaultEvents.flatMap((e) => (e.eventName === "Unlocked" ? [e] : []));
  const touched = new Map<string, { vault: Address; id: bigint }>();
  for (const e of vaultEvents) {
    if (!("id" in e.args)) continue;
    const vault = getAddress(e.address);
    touched.set(`${vault}:${e.args.id}`, { vault, id: e.args.id });
  }
  const closedKeys = new Set(closed.map((e) => `${getAddress(e.address)}:${e.args.id}`));
  const live = [...touched.entries()].filter(([key]) => !closedKeys.has(key)).map(([, p]) => p);
  const liveState = await Promise.all(
    live.map(async (p) => ({
      ...p,
      state: await publicClient.readContract({ address: p.vault, abi: claspVaultAbi, functionName: "position", args: [p.id] }),
    })),
  );

  await sql.begin(async (tx) => {
    if (coinRows.length) {
      await tx`INSERT INTO coins ${tx(coinRows)} ON CONFLICT (token) DO NOTHING`;
    }
    // Also covers a coin row already present (e.g. a replayed range written
    // before the launcher was known): the launcher's creator always wins.
    for (const [token, creator] of launchedCreator) {
      await tx`UPDATE coins SET creator = ${creator} WHERE token = ${token}`;
    }

    for (const e of opened) {
      const vault = getAddress(e.address);
      await tx`
        INSERT INTO positions (vault, id, token, owner, amount, weight, multiplier_bps, lock_start, lock_end, opened_block, updated_block)
        VALUES (
          ${vault}, ${e.args.id.toString()}, ${scanVaults.get(vault)!}, ${getAddress(e.args.owner)},
          ${e.args.amount.toString()}, ${e.args.weight.toString()}, ${Number(e.args.multiplierBps)},
          ${Math.floor(timeOf(e).getTime() / 1000)}, ${e.args.lockEnd.toString()},
          ${e.blockNumber.toString()}, ${e.blockNumber.toString()}
        )
        ON CONFLICT (vault, id) DO NOTHING
      `;
    }

    if (eventRows.length) {
      await tx`INSERT INTO events ${tx(eventRows)} ON CONFLICT (tx_hash, log_index) DO NOTHING`;
      // Increased / Extended carry no owner; take it from the position.
      await tx`
        UPDATE events e SET owner = p.owner
        FROM positions p
        WHERE e.owner IS NULL AND e.position_id IS NOT NULL
          AND e.vault = p.vault AND e.position_id = p.id
          AND e.block_number BETWEEN ${fromBlock.toString()} AND ${toBlock.toString()}
      `;
    }

    for (const { vault, id, state } of liveState) {
      // A position that has since been deleted on chain reads back zeroed;
      // its Unlocked event closes it when the indexer reaches that block.
      if (state.owner === zeroAddress || state.amount === 0n) continue;
      await tx`
        UPDATE positions SET
          amount = ${state.amount.toString()},
          weight = ${state.weight.toString()},
          multiplier_bps = ${Number(state.multiplierBps)},
          lock_start = ${state.lockStart.toString()},
          lock_end = ${state.lockEnd.toString()},
          updated_block = ${toBlock.toString()}
        WHERE vault = ${vault} AND id = ${id.toString()} AND open
      `;
    }

    for (const e of closed) {
      await tx`
        UPDATE positions SET
          open = false,
          burned = ${e.args.burned.toString()},
          forfeited = ${e.args.forfeited.toString()},
          early = ${e.args.early},
          updated_block = ${e.blockNumber.toString()}
        WHERE vault = ${getAddress(e.address)} AND id = ${e.args.id.toString()}
      `;
    }

    if (touched.size) {
      const keys = [...touched.values()].map((p) => `${p.vault}:${p.id}`);
      await tx`
        UPDATE positions p SET claimed = COALESCE((
          SELECT sum(e.amount) FROM events e
          WHERE e.kind = 'claim' AND e.vault = p.vault AND e.position_id = p.id
        ), 0)
        WHERE (p.vault || ':' || p.id::text) = ANY(${keys})
      `;
    }

    if (trades.length) {
      await tx`
        INSERT INTO trades ${tx(
          trades.map((t) => ({
            tx_hash: t.transactionHash,
            log_index: t.logIndex,
            block_number: t.blockNumber.toString(),
            block_time: timeOf(t),
            token: getAddress(t.args.token),
            trader: getAddress(t.args.trader),
            is_buy: t.args.isBuy,
            eth_amount: t.args.ethAmount.toString(),
            token_amount: t.args.tokenAmount.toString(),
            fee: t.args.fee.toString(),
          })),
        )}
        ON CONFLICT (tx_hash, log_index) DO NOTHING
      `;
    }

    // Applied strictly in chain order: each one transitions the coin's state.
    for (const e of ponsEvents) {
      const token = getAddress(e.args.token);
      const at = { block_number: e.blockNumber.toString(), block_time: timeOf(e) };
      if (e.eventName === "CreatorFeeRecipientChangeProposed") {
        // A new proposal replaces any earlier one and restarts the clock.
        await tx`
          UPDATE admin_redirects SET status = 'cancelled', resolved_block = ${at.block_number}
          WHERE token = ${token} AND status = 'pending'
            AND (block_number, log_index) < (${at.block_number}, ${e.logIndex})
        `;
        await tx`
          INSERT INTO admin_redirects ${tx({
            tx_hash: e.transactionHash,
            log_index: e.logIndex,
            ...at,
            token,
            current_recipient: getAddress(e.args.currentRecipient),
            new_recipient: getAddress(e.args.proposedRecipient),
            effective_at: e.args.effectiveAt.toString(),
            expires_at: e.args.expiresAt.toString(),
          })}
          ON CONFLICT (tx_hash, log_index) DO NOTHING
        `;
        await tx`
          UPDATE coins SET
            redirect_to = ${getAddress(e.args.proposedRecipient)},
            redirect_effective_at = ${e.args.effectiveAt.toString()},
            redirect_expires_at = ${e.args.expiresAt.toString()}
          WHERE token = ${token}
        `;
      } else if (e.eventName === "CreatorFeeRecipientChangeCancelled") {
        await tx`
          UPDATE admin_redirects SET status = 'cancelled', resolved_block = ${at.block_number}
          WHERE token = ${token} AND status = 'pending'
            AND (block_number, log_index) < (${at.block_number}, ${e.logIndex})
        `;
        await tx`UPDATE coins SET redirect_to = NULL, redirect_effective_at = NULL, redirect_expires_at = NULL WHERE token = ${token}`;
      } else {
        const next = getAddress(e.args.newRecipient);
        await tx`
          INSERT INTO fee_recipient_changes ${tx({
            tx_hash: e.transactionHash,
            log_index: e.logIndex,
            ...at,
            token,
            previous_recipient: getAddress(e.args.previousRecipient),
            new_recipient: next,
          })}
          ON CONFLICT (tx_hash, log_index) DO NOTHING
        `;
        await tx`UPDATE coins SET fee_recipient = ${next} WHERE token = ${token}`;
        // Executing a matured proposal deletes it and emits this event. A
        // creator's own transfer to the same address before the timelock
        // cannot be an execution, hence the effective_at bound.
        const blockSecs = Math.floor(at.block_time.getTime() / 1000);
        await tx`
          UPDATE admin_redirects SET status = 'executed', resolved_block = ${at.block_number}
          WHERE token = ${token} AND status = 'pending' AND new_recipient = ${next}
            AND effective_at <= ${blockSecs}
        `;
        await tx`
          UPDATE coins SET redirect_to = NULL, redirect_effective_at = NULL, redirect_expires_at = NULL
          WHERE token = ${token} AND redirect_to = ${next} AND redirect_effective_at <= ${blockSecs}
        `;
      }
    }

    await tx`
      INSERT INTO indexer_cursor (name, block) VALUES (${CURSOR}, ${toBlock.toString()})
      ON CONFLICT (name) DO UPDATE SET block = EXCLUDED.block, updated_at = now()
    `;
  });

  for (const row of coinRows) vaults.set(row.vault, row.token);
  return summary;
}
