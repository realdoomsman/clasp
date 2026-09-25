import { BaseError, ContractFunctionRevertedError, createWalletClient, http, type Address, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Logger } from "pino";
import { chain, publicClient } from "./chain.ts";
import { claspVaultAbi } from "./clasp.ts";
import { sql } from "./db.ts";
import { env } from "./env.ts";

/**
 * The keeper does the permissionless chores nobody is paid to do: pull Pons
 * creator fees into vaults, release matured locks, and forward the treasury's
 * share. Every one of these is callable by anyone, pays only the rightful
 * party, and cannot move funds anywhere else, so the key held here can at
 * worst waste its own gas.
 *
 * It runs inside the indexer, after each reconcile pass, on the state that
 * pass just read. Sends are strictly sequential (one receipt before the next
 * send) so the nonce never races, and each is simulated first so a call that
 * would revert costs nothing.
 */

const HOUR_MS = 60 * 60 * 1000;
const RECEIPT_TIMEOUT_MS = 90_000;
/** Harvest backoff after a failed or empty harvest: doubles up to an hour. */
const HARVEST_BASE_DELAY_MS = 60_000;
const HARVEST_MAX_DELAY_MS = HOUR_MS;
/**
 * Gas limit = estimate × 1.5. Vault calls release the reward stream up to
 * block.timestamp and harvest makes best-effort Pons calls, so their cost at
 * inclusion differs from the estimate taken a block earlier; a bare estimate
 * was seen to run out of gas on a fork. Unused gas is not charged.
 */
const GAS_HEADROOM_PCT = 150n;

type Chore = { action: "harvest" | "claimTreasury" } | { action: "unlock"; id: bigint };

function reason(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) return revert.data?.errorName ?? revert.shortMessage;
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}

export interface Keeper {
  address: Address;
  /** One pass of every chore; never throws. */
  tick(): Promise<void>;
}

export function createKeeper(privateKey: `0x${string}`, parent: Logger): Keeper {
  const log = parent.child({ component: "keeper" });
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({
    account,
    chain,
    transport: http(env.rpcUrl, { retryCount: 3, retryDelay: 400, timeout: 30_000 }),
  });

  const harvestBackoff = new Map<Address, { nextAt: number; delayMs: number }>();
  /**
   * Positions whose unlock would revert or burn abnormal gas, keyed vault:id.
   * Skipped until `nextAt`; the delay doubles on every failure (1 h → 24 h),
   * so a hostile owner costs one eth_call a day, not the queue's budget.
   */
  const unlockBackoff = new Map<string, { nextAt: number; delayMs: number }>();
  /** Vault served last; the next tick's round-robin starts after it. */
  let unlockCursor: Address | null = null;
  let lastRefusalLogged = 0;

  async function hasGas(): Promise<boolean> {
    const balance = await publicClient.getBalance({ address: account.address });
    if (balance >= env.keeperMinBalanceWei) return true;
    // Matured locks keep their full reward weight until someone unlocks them,
    // so a starved keeper dilutes every active locker: alert, once an hour,
    // at error level (what the platform's log alerting watches).
    if (Date.now() - lastRefusalLogged >= HOUR_MS) {
      lastRefusalLogged = Date.now();
      await sql`
        INSERT INTO keeper_runs (action, status, detail)
        VALUES ('refused', 'refused', ${`balance ${balance} wei below minimum ${env.keeperMinBalanceWei} wei`})
      `;
      log.error(
        { alert: "keeper_low_balance", address: account.address, balance: balance.toString(), minimum: env.keeperMinBalanceWei.toString() },
        "ALERT keeper balance below minimum; not sending until funded",
      );
    }
    return false;
  }

  /**
   * Simulate, send, record, wait. Returns whether the transaction confirmed.
   * A failed simulation is recorded too (status failed) so the runbook can
   * see a vault that keeps refusing a chore.
   */
  async function send(vault: Address, chore: Chore): Promise<boolean> {
    const { action } = chore;
    const positionId = chore.action === "unlock" ? chore.id.toString() : null;
    let hash: Hash;
    try {
      if (chore.action === "unlock") {
        const call = { account, address: vault, abi: claspVaultAbi, functionName: "unlock", args: [chore.id] } as const;
        const { request } = await publicClient.simulateContract(call);
        const gas = await publicClient.estimateContractGas(call);
        // The owner's ETH is paid with a plain call; an owner contract whose
        // receive() burns gas makes its own unlock expensive. Not our gas to spend.
        if (gas > env.unlockMaxGas) throw new Error(`gas estimate ${gas} above UNLOCK_MAX_GAS ${env.unlockMaxGas}`);
        hash = await wallet.writeContract({ ...request, gas: (gas * GAS_HEADROOM_PCT) / 100n });
      } else {
        const call = { account, address: vault, abi: claspVaultAbi, functionName: chore.action } as const;
        const { request } = await publicClient.simulateContract(call);
        const gas = await publicClient.estimateContractGas(call);
        hash = await wallet.writeContract({ ...request, gas: (gas * GAS_HEADROOM_PCT) / 100n });
      }
    } catch (err) {
      const detail = reason(err);
      log.warn({ action, vault, positionId, detail }, "keeper call not sent");
      await sql`
        INSERT INTO keeper_runs (action, vault, position_id, status, detail)
        VALUES (${action}, ${vault}, ${positionId}, 'failed', ${detail.slice(0, 500)})
      `;
      return false;
    }

    const [run] = await sql<{ id: string }[]>`
      INSERT INTO keeper_runs (action, vault, position_id, tx_hash, status)
      VALUES (${action}, ${vault}, ${positionId}, ${hash}, 'sent')
      RETURNING id
    `;
    log.info({ action, vault, positionId, hash }, "keeper sent");
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
      const ok = receipt.status === "success";
      await sql`
        UPDATE keeper_runs SET
          status = ${ok ? "confirmed" : "reverted"},
          gas_used = ${receipt.gasUsed.toString()},
          fee_wei = ${(receipt.gasUsed * receipt.effectiveGasPrice).toString()}
        WHERE id = ${run.id}
      `;
      if (!ok) log.error({ action, vault, positionId, hash }, "keeper transaction reverted");
      return ok;
    } catch (err) {
      // Left as 'sent': it may still land. The next pass re-reads chain state,
      // so a late confirmation is picked up and never double-sent blindly.
      log.error({ action, vault, positionId, hash, detail: reason(err) }, "keeper receipt not seen");
      return false;
    }
  }

  async function harvests() {
    // Pons escrow balance, plus — while the vault is the recipient and the
    // coin is still on its curve — the creator fees harvest() would sweep.
    const vaults = await sql<{ vault: Address }[]>`
      SELECT vault FROM (
        SELECT vault, escrow_balance + CASE WHEN fee_recipient = vault THEN curve_fees ELSE 0 END AS harvestable
        FROM coins
      ) c
      WHERE harvestable >= ${env.harvestThresholdWei.toString()}
      ORDER BY harvestable DESC
    `;
    for (const { vault } of vaults) {
      const backoff = harvestBackoff.get(vault);
      if (backoff && Date.now() < backoff.nextAt) continue;
      if (!(await hasGas())) return;
      const ok = await send(vault, { action: "harvest" });
      if (ok) {
        harvestBackoff.delete(vault);
      } else {
        const delayMs = Math.min((backoff?.delayMs ?? HARVEST_BASE_DELAY_MS / 2) * 2, HARVEST_MAX_DELAY_MS);
        harvestBackoff.set(vault, { nextAt: Date.now() + delayMs, delayMs });
      }
    }
  }

  /**
   * A matured position keeps its full weight — diluting every active locker —
   * until someone unlocks it, so the biggest matured weights go first. Within
   * a vault: weight descending. Across vaults: round-robin, starting after the
   * vault served last tick, so a vault full of dust can neither starve another
   * vault nor be starved forever by the per-tick budget.
   */
  async function unlocks() {
    // Chain time, not ours: maturity is judged by block.timestamp.
    const { timestamp } = await publicClient.getBlock();
    const now = Date.now();
    const skipped = [...unlockBackoff.entries()].filter(([, b]) => b.nextAt > now).map(([key]) => key);
    const due = await sql<{ vault: Address; id: string }[]>`
      SELECT vault, id FROM (
        SELECT vault, id::text AS id,
               row_number() OVER (PARTITION BY vault ORDER BY weight DESC, id) AS rank
        FROM positions
        WHERE open AND lock_end <= ${timestamp.toString()}
          AND NOT ((vault || ':' || id::text) = ANY(${skipped}::text[]))
      ) ranked
      WHERE rank <= ${env.unlocksPerTick}
      ORDER BY vault, rank
    `;
    if (due.length === 0) return;

    const queues = new Map<Address, string[]>();
    for (const { vault, id } of due) queues.set(vault, [...(queues.get(vault) ?? []), id]);
    const vaults = [...queues.keys()].sort(); // stable order for the carried cursor
    const start = unlockCursor === null ? 0 : vaults.findIndex((v) => v > unlockCursor!);
    const order = start <= 0 ? vaults : [...vaults.slice(start), ...vaults.slice(0, start)];

    let sent = 0;
    for (let round = 0; sent < env.unlocksPerTick; round++) {
      let any = false;
      for (const vault of order) {
        if (sent >= env.unlocksPerTick) break;
        const id = queues.get(vault)![round];
        if (id === undefined) continue;
        any = true;
        if (!(await hasGas())) return;
        sent++;
        unlockCursor = vault;
        const key = `${vault}:${id}`;
        if (await send(vault, { action: "unlock", id: BigInt(id) })) {
          unlockBackoff.delete(key);
        } else {
          const delayMs = Math.min((unlockBackoff.get(key)?.delayMs ?? HOUR_MS / 2) * 2, 24 * HOUR_MS);
          unlockBackoff.set(key, { nextAt: Date.now() + delayMs, delayMs });
        }
      }
      if (!any) break;
    }
    // Positions closed on chain drop out of the query; forget their backoff.
    if (unlockBackoff.size > 10_000) for (const [key, b] of unlockBackoff) if (b.nextAt <= now) unlockBackoff.delete(key);
  }

  async function treasuryClaims() {
    const vaults = await sql<{ vault: Address }[]>`
      SELECT c.vault FROM coins c
      WHERE c.treasury_owed >= ${env.treasuryClaimThresholdWei.toString()}
        AND NOT EXISTS (
          SELECT 1 FROM keeper_runs k
          WHERE k.vault = c.vault AND k.action = 'claimTreasury' AND k.at > now() - interval '1 hour'
        )
      ORDER BY c.treasury_owed DESC
    `;
    for (const { vault } of vaults) {
      if (!(await hasGas())) return;
      await send(vault, { action: "claimTreasury" });
    }
  }

  return {
    address: account.address,
    async tick() {
      for (const [name, chore] of [
        ["harvest", harvests],
        ["unlock", unlocks],
        ["claimTreasury", treasuryClaims],
      ] as const) {
        try {
          await chore();
        } catch (err) {
          log.error({ chore: name, err }, "keeper chore failed");
        }
      }
    },
  };
}
