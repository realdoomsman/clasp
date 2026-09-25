import { robinhoodChain } from "@clasp/sdk";
import { createPublicClient, defineChain, http } from "viem";
import { env } from "./env.ts";
import { MULTICALL3 } from "./pons.ts";

/** The SDK's chain, pointed at our RPC, with Multicall3 (deployed on Robinhood Chain) for batching. */
export const chain = defineChain({
  ...robinhoodChain,
  id: env.chainId,
  rpcUrls: { default: { http: [env.rpcUrl] } },
  contracts: { multicall3: { address: MULTICALL3 } },
});

/**
 * The public RPC answers bursts with 429s; viem retries those with
 * exponential backoff. Reads made in the same tick are folded into Multicall3
 * batches so a reconcile pass over every vault costs a handful of requests.
 */
export const publicClient = createPublicClient({
  chain,
  transport: http(env.rpcUrl, { retryCount: 6, retryDelay: 400, timeout: 30_000 }),
  batch: { multicall: { batchSize: 2_048, wait: 16 } },
});
