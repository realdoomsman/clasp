import type { FastifyInstance, FastifyReply } from "fastify";
import { getAddress, isAddress, type Address, type Hash } from "viem";
import { z } from "zod";
import { sql } from "../db.ts";
import type {
  ActivityKind,
  ActivityResponse,
  CoinDetail,
  CoinsResponse,
  LeaderboardResponse,
  LockersResponse,
  StatsResponse,
} from "../types.ts";
import { COIN_JOINS, COIN_SELECT, Paging, TokenParams, toSummary, type CoinRecord } from "./shared.ts";

const CoinsQuery = Paging.extend({
  sort: z.enum(["new", "earning", "locked", "lockers"]).default("new"),
  search: z.string().trim().max(64).optional(),
});

const LeaderboardQuery = z.object({
  board: z.enum(["earners", "coins", "longest"]).default("earners"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const ACTIVITY_KINDS: ActivityKind[] = ["lock", "increase", "extend", "claim", "unlock", "fees", "treasury"];

/** List responses change once per indexed block at most; a few seconds of caching is free. */
function shortCache(reply: FastifyReply) {
  reply.header("cache-control", "public, max-age=5");
}

async function findCoin(token: Address): Promise<CoinRecord | undefined> {
  const [coin] = await sql<CoinRecord[]>`
    SELECT ${sql.unsafe(COIN_SELECT)} FROM coins c ${sql.unsafe(COIN_JOINS)}
    WHERE c.token = ${token} OR c.vault = ${token}
  `;
  return coin;
}

export async function coinRoutes(app: FastifyInstance) {
  app.get("/stats", async (_request, reply): Promise<StatsResponse> => {
    const [row] = await sql<
      { coins: number; locked_value: string; paid: string; fees_24h: string; lockers: number }[]
    >`
      SELECT
        (SELECT count(*)::int FROM coins) AS coins,
        (SELECT COALESCE(sum(trunc(total_locked * price_wei / 1e18)), 0)::text FROM coins WHERE price_wei IS NOT NULL) AS locked_value,
        (SELECT COALESCE(sum(lifetime_rewards), 0)::text FROM coins) AS paid,
        (SELECT COALESCE(sum(amount), 0)::text FROM events WHERE kind = 'fees' AND block_time > now() - interval '1 day') AS fees_24h,
        (SELECT count(DISTINCT owner)::int FROM positions WHERE open) AS lockers
    `;
    shortCache(reply);
    return {
      coins: row.coins,
      lockedValueEth: row.locked_value,
      paidToLockersEth: row.paid,
      fees24hEth: row.fees_24h,
      lockers: row.lockers,
    };
  });

  app.get("/coins", async (request, reply): Promise<CoinsResponse> => {
    const query = CoinsQuery.parse(request.query);
    const search = query.search;
    let where = sql``;
    if (search && isAddress(search, { strict: false })) {
      const address = getAddress(search);
      where = sql`WHERE c.token = ${address} OR c.vault = ${address}`;
    } else if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      where = sql`WHERE c.symbol ILIKE ${pattern} OR c.name ILIKE ${pattern}`;
    }
    const order = {
      new: sql`c.created_block DESC`,
      earning: sql`COALESCE(f.to_lockers, 0) DESC, c.lifetime_rewards DESC, c.created_block DESC`,
      locked: sql`c.total_locked * c.price_wei DESC NULLS LAST, c.total_locked DESC, c.created_block DESC`,
      lockers: sql`COALESCE(h.lockers, 0) DESC, c.created_block DESC`,
    }[query.sort];
    const rows = await sql<CoinRecord[]>`
      SELECT ${sql.unsafe(COIN_SELECT)} FROM coins c ${sql.unsafe(COIN_JOINS)}
      ${where}
      ORDER BY ${order}
      LIMIT ${query.limit} OFFSET ${query.offset}
    `;
    shortCache(reply);
    return { coins: rows.map(toSummary) };
  });

  app.get("/coins/:token", async (request, reply): Promise<CoinDetail | void> => {
    const { token } = TokenParams.parse(request.params);
    const coin = await findCoin(token);
    if (!coin) return reply.code(404).send({ error: "coin not found" });

    const [fees] = await sql<{ d1: string; d7: string }[]>`
      SELECT
        COALESCE(sum(amount) FILTER (WHERE block_time > now() - interval '1 day'), 0)::text AS d1,
        COALESCE(sum(amount), 0)::text AS d7
      FROM events
      WHERE vault = ${coin.vault} AND kind = 'fees' AND block_time > now() - interval '7 days'
    `;
    const nowSecs = Math.floor(Date.now() / 1000);
    // The factory keeps an expired proposal in its slot; it can no longer execute.
    const redirectLive = coin.redirect_to !== null && Number(coin.redirect_expires_at) >= nowSecs;

    shortCache(reply);
    return {
      ...toSummary(coin),
      description: coin.description,
      website: coin.website,
      twitter: coin.twitter,
      telegram: coin.telegram,
      discord: coin.discord,
      farcaster: coin.farcaster,
      creatorTaxBps: coin.creator_tax_bps,
      treasury: coin.treasury ?? coin.vault,
      terms: coin.terms,
      vaultState: {
        balance: coin.vault_balance,
        undistributed: coin.undistributed,
        streamEnd: Number(coin.stream_end),
        treasuryOwed: coin.treasury_owed,
        lifetimeInflow: coin.lifetime_inflow,
        lifetimeRewards: coin.lifetime_rewards,
        accRewardPerWeight: coin.acc_reward_per_weight,
        escrowBalance: coin.escrow_balance,
        curveFees: coin.curve_fees,
      },
      feeRecipient: coin.fee_recipient ?? coin.vault,
      feeRecipientOk: coin.fee_recipient === coin.vault,
      adminRedirectPending: redirectLive
        ? {
            newRecipient: coin.redirect_to!,
            executableAt: Number(coin.redirect_effective_at),
            expiresAt: Number(coin.redirect_expires_at),
          }
        : null,
      fees24hEth: fees.d1,
      fees7dEth: fees.d7,
      toLockers7dEth: coin.to_lockers_7d,
    };
  });

  app.get("/coins/:token/lockers", async (request, reply): Promise<LockersResponse | void> => {
    const { token } = TokenParams.parse(request.params);
    const { limit, offset } = Paging.parse(request.query);
    const coin = await findCoin(token);
    if (!coin) return reply.code(404).send({ error: "coin not found" });
    const rows = await sql<
      { owner: Address; positions: number; amount: string; weight: string; claimed: string; share_bp: string | null }[]
    >`
      SELECT
        owner,
        count(*) FILTER (WHERE open)::int AS positions,
        COALESCE(sum(amount) FILTER (WHERE open), 0)::text AS amount,
        COALESCE(sum(weight) FILTER (WHERE open), 0)::text AS weight,
        sum(claimed)::text AS claimed,
        trunc(
          COALESCE(sum(weight) FILTER (WHERE open), 0) * 1000000
          / NULLIF(sum(COALESCE(sum(weight) FILTER (WHERE open), 0)) OVER (), 0)
        )::text AS share_bp
      FROM positions
      WHERE vault = ${coin.vault}
      GROUP BY owner
      HAVING count(*) FILTER (WHERE open) > 0
      ORDER BY sum(weight) FILTER (WHERE open) DESC, owner
      LIMIT ${limit} OFFSET ${offset}
    `;
    shortCache(reply);
    return {
      lockers: rows.map((r) => ({
        owner: r.owner,
        positions: r.positions,
        amount: r.amount,
        weight: r.weight,
        sharePct: r.share_bp === null ? 0 : Number(r.share_bp) / 10_000,
        claimed: r.claimed,
      })),
    };
  });

  app.get("/coins/:token/activity", async (request, reply): Promise<ActivityResponse | void> => {
    const { token } = TokenParams.parse(request.params);
    const { limit, offset } = Paging.parse(request.query);
    const coin = await findCoin(token);
    if (!coin) return reply.code(404).send({ error: "coin not found" });
    const rows = await sql<
      {
        kind: ActivityKind;
        position_id: string | null;
        owner: Address | null;
        amount: string;
        data: Record<string, string | boolean>;
        tx_hash: Hash;
        block_number: string;
        block_time: Date;
      }[]
    >`
      SELECT kind, position_id::text, owner, amount::text, data, tx_hash, block_number, block_time
      FROM events
      WHERE vault = ${coin.vault} AND kind = ANY(${ACTIVITY_KINDS})
      ORDER BY block_number DESC, log_index DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    shortCache(reply);
    return {
      activity: rows.map((r) => ({
        kind: r.kind,
        id: r.position_id,
        owner: r.owner,
        amount: r.amount,
        data: r.data,
        txHash: r.tx_hash,
        blockNumber: Number(r.block_number),
        blockTime: Math.floor(r.block_time.getTime() / 1000),
      })),
    };
  });

  app.get("/leaderboard", async (request, reply): Promise<LeaderboardResponse> => {
    const { board, limit } = LeaderboardQuery.parse(request.query);
    shortCache(reply);

    if (board === "earners") {
      const rows = await sql<{ owner: Address; claimed: string; positions: number }[]>`
        SELECT owner, sum(claimed)::text AS claimed, count(*) FILTER (WHERE open)::int AS positions
        FROM positions
        GROUP BY owner
        HAVING sum(claimed) > 0
        ORDER BY sum(claimed) DESC, owner
        LIMIT ${limit}
      `;
      return { board, rows: rows.map((r, i) => ({ rank: i + 1, ...r })) };
    }

    if (board === "coins") {
      const rows = await sql<CoinRecord[]>`
        SELECT ${sql.unsafe(COIN_SELECT)} FROM coins c ${sql.unsafe(COIN_JOINS)}
        ORDER BY c.lifetime_rewards DESC, c.created_block
        LIMIT ${limit}
      `;
      return {
        board,
        rows: rows.map((c, i) => ({
          rank: i + 1,
          token: c.token,
          vault: c.vault,
          name: c.name,
          symbol: c.symbol,
          image: c.logo,
          paidToLockers: c.lifetime_rewards,
          lockedValueEth: c.locked_value ?? "0",
          lockers: c.lockers,
        })),
      };
    }

    const rows = await sql<
      {
        owner: Address;
        token: Address;
        symbol: string;
        logo: string | null;
        id: string;
        amount: string;
        duration: string;
        lock_end: string;
        multiplier_bps: number;
      }[]
    >`
      SELECT p.owner, p.token, c.symbol, c.logo, p.id::text, p.amount::text,
             (p.lock_end - p.lock_start) AS duration, p.lock_end, p.multiplier_bps
      FROM positions p JOIN coins c ON c.vault = p.vault
      WHERE p.open
      ORDER BY p.lock_end - p.lock_start DESC, p.amount DESC
      LIMIT ${limit}
    `;
    return {
      board,
      rows: rows.map((r, i) => ({
        rank: i + 1,
        owner: r.owner,
        token: r.token,
        symbol: r.symbol,
        image: r.logo,
        id: r.id,
        amount: r.amount,
        durationSecs: Number(r.duration),
        lockEnd: Number(r.lock_end),
        multiplierBps: r.multiplier_bps,
      })),
    };
  });
}
