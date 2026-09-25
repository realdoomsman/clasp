import { publicClient } from "./chain.ts";
import { clasp, claspDeployed } from "./clasp.ts";
import { sql } from "./db.ts";
import { assertIndexerEnv, env } from "./env.ts";
import { ingestRange, loadCursor, loadVaults } from "./ingest.ts";
import { createKeeper } from "./keeper.ts";
import { log as rootLog } from "./log.ts";
import { reconcile } from "./reconcile.ts";
import { sleep } from "./util.ts";

/**
 * ROLE=indexer. A singleton: builds the read model from confirmed blocks,
 * reconciles it against chain state, and runs the keeper. Two of these would
 * race each other's keeper sends, so the deploy must never scale it past one.
 *
 * Loop: follow the head `CONFIRMATIONS` blocks behind in ranges of at most
 * `LOG_RANGE` (halved on any RPC failure, grown back on success); every
 * `RECONCILE_MS`, reconcile every vault and — once caught up — run the keeper.
 */

const log = rootLog.child({ svc: "indexer" });
const MIN_RANGE = 16n;

const chainId = await publicClient.getChainId();
if (chainId !== env.chainId) throw new Error(`RPC_URL serves chain ${chainId}, expected CHAIN_ID ${env.chainId}`);

const saved = await loadCursor();
assertIndexerEnv(saved !== null);
let cursor = saved ?? env.startBlock! - 1n;
const vaults = await loadVaults();
const keeper = env.keeperPrivateKey ? createKeeper(env.keeperPrivateKey, log) : null;

log.info(
  { chainId, cursor: cursor.toString(), vaults: vaults.size, factory: clasp.factory, keeper: keeper?.address ?? null },
  "indexer starting",
);
if (!claspDeployed) log.warn("Clasp factory address is zero: no vaults to index until the SDK publishes deployments");
if (!keeper) log.warn("KEEPER_PRIVATE_KEY unset: keeper disabled, indexing only");

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    log.info({ signal }, "stopping after the current step");
    stopping = true;
  });
}

const maxRange = BigInt(env.logRange);
let range = maxRange;
let lastReconcile = 0;

while (!stopping) {
  try {
    const head = await publicClient.getBlockNumber({ cacheTime: 0 });
    const safe = head - BigInt(env.confirmations);

    while (cursor < safe && !stopping) {
      const from = cursor + 1n;
      const to = from + range - 1n < safe ? from + range - 1n : safe;
      try {
        const summary = await ingestRange(from, to, vaults);
        cursor = to;
        const busy = summary.vaultsCreated + summary.vaultEvents + summary.trades + summary.ponsEvents + summary.launches > 0;
        log[busy ? "info" : "debug"]({ from: from.toString(), to: to.toString(), behind: (safe - to).toString(), ...summary }, "indexed");
        if (range < maxRange) range = range * 2n > maxRange ? maxRange : range * 2n;
      } catch (err) {
        if (range <= MIN_RANGE) throw err;
        range = range / 2n > MIN_RANGE ? range / 2n : MIN_RANGE;
        log.warn({ err, from: from.toString(), range: range.toString() }, "range failed; shrinking");
        await sleep(500);
      }
      // Far behind, keep the vault numbers fresh rather than finishing the catch-up first.
      if (Date.now() - lastReconcile >= env.reconcileMs) break;
    }

    if (!stopping && Date.now() - lastReconcile >= env.reconcileMs) {
      lastReconcile = Date.now();
      await reconcile(log);
      // Chores are judged from indexed positions: only act on a caught-up view.
      if (keeper && cursor >= safe) await keeper.tick();
    }
  } catch (err) {
    log.error({ err }, "indexer pass failed");
  }
  if (!stopping) await sleep(env.pollMs);
}

await sql.end({ timeout: 5 });
log.info("indexer stopped");
