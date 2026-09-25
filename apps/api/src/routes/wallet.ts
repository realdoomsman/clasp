import type { FastifyInstance } from "fastify";
import type { Address } from "viem";
import { publicClient } from "../chain.ts";
import { claspVaultAbi } from "../clasp.ts";
import { sql } from "../db.ts";
import type { Position, WalletResponse } from "../types.ts";
import { AddressParams } from "./shared.ts";

/** One wallet's open locks is a bounded list; this caps the live reads per request. */
const MAX_POSITIONS = 200;

export async function walletRoutes(app: FastifyInstance) {
  app.get("/wallet/:address", async (request, reply): Promise<WalletResponse> => {
    const { address } = AddressParams.parse(request.params);

    const [rows, [claimedRow]] = await Promise.all([
      sql<
        {
          vault: Address;
          token: Address;
          symbol: string;
          logo: string | null;
          id: string;
          amount: string;
          weight: string;
          multiplier_bps: number;
          lock_start: string;
          lock_end: string;
          claimed: string;
          price_wei: string | null;
        }[]
      >`
        SELECT p.vault, p.token, c.symbol, c.logo, p.id::text, p.amount::text, p.weight::text,
               p.multiplier_bps, p.lock_start, p.lock_end, p.claimed::text, c.price_wei::text
        FROM positions p JOIN coins c ON c.vault = p.vault
        WHERE p.owner = ${address} AND p.open
        ORDER BY p.lock_end
        LIMIT ${MAX_POSITIONS}
      `,
      sql<{ claimed: string }[]>`
        SELECT COALESCE(sum(claimed), 0)::text AS claimed FROM positions WHERE owner = ${address}
      `,
    ]);

    // Pending rewards stream every second and the early-exit burn shrinks
    // with time, so both are read live (one multicall for the whole list). A
    // position the indexer has not yet seen close reads back as failed or
    // zero; it is shown with nothing pending rather than failing the wallet.
    const [live, block] = await Promise.all([
      Promise.all(
        rows.map((p) =>
          Promise.all([
            publicClient
              .readContract({ address: p.vault, abi: claspVaultAbi, functionName: "pending", args: [BigInt(p.id)] })
              .catch(() => 0n),
            publicClient
              .readContract({ address: p.vault, abi: claspVaultAbi, functionName: "previewEarlyUnlock", args: [BigInt(p.id)] })
              .then(([burn]) => burn)
              .catch(() => 0n),
          ]),
        ),
      ),
      publicClient.getBlock(),
    ]);

    let pendingTotal = 0n;
    let lockedValue = 0n;
    const positions: Position[] = rows.map((p, i) => {
      const [pending, burn] = live[i];
      const matured = BigInt(p.lock_end) <= block.timestamp;
      pendingTotal += pending;
      if (p.price_wei !== null) lockedValue += (BigInt(p.amount) * BigInt(p.price_wei)) / 10n ** 18n;
      return {
        vault: p.vault,
        token: p.token,
        symbol: p.symbol,
        image: p.logo,
        id: p.id,
        amount: p.amount,
        weight: p.weight,
        multiplierBps: p.multiplier_bps,
        lockStart: Number(p.lock_start),
        lockEnd: Number(p.lock_end),
        pending: pending.toString(),
        claimed: p.claimed,
        matured,
        earlyUnlockBurn: matured ? "0" : burn.toString(),
      };
    });

    reply.header("cache-control", "no-store");
    return {
      positions,
      totals: { pending: pendingTotal.toString(), claimed: claimedRow.claimed, lockedValueEth: lockedValue.toString() },
    };
  });
}
