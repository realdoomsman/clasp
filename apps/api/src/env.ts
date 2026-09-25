import { deployBlock } from "@clasp/sdk";
import { getAddress, isAddress, type Address } from "viem";
import { z } from "zod";

/**
 * Config is read once at boot and validated eagerly, so a bad deploy crashes
 * immediately instead of at the first request or the first keeper send.
 * Every variable is documented in docs/RUNBOOK.md.
 */

const MAINNET_CHAIN_ID = 4663;

const wei = z
  .string()
  .regex(/^\d+$/, "must be a whole number of wei")
  .transform((v) => BigInt(v));

const optionalAddress = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    if (!isAddress(v, { strict: false })) {
      ctx.addIssue({ code: "custom", message: "not an address" });
      return z.NEVER;
    }
    return getAddress(v);
  });

const Schema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1),
  RPC_URL: z.string().url().default("https://rpc.mainnet.chain.robinhood.com"),
  CHAIN_ID: z.coerce.number().int().positive().default(MAINNET_CHAIN_ID),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  // HTTP role.
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  CORS_ORIGINS: z.string().optional(),
  PUBLIC_API_URL: z.string().url().optional(),

  // Indexer role.
  START_BLOCK: z.coerce.bigint().nonnegative().optional(),
  CONFIRMATIONS: z.coerce.number().int().nonnegative().default(20),
  LOG_RANGE: z.coerce.number().int().positive().default(50_000),
  POLL_MS: z.coerce.number().int().positive().default(3_000),
  RECONCILE_MS: z.coerce.number().int().positive().default(60_000),
  IPFS_GATEWAY: z.string().url().default("https://ipfs.io/ipfs/"),

  // Keeper (inside the indexer).
  KEEPER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte hex key")
    .optional(),
  KEEPER_MIN_BALANCE_WEI: wei.default(2_000_000_000_000_000n),
  HARVEST_THRESHOLD_WEI: wei.default(1_000_000_000_000_000n),
  TREASURY_CLAIM_THRESHOLD_WEI: wei.default(10_000_000_000_000_000n),
  UNLOCKS_PER_TICK: z.coerce.number().int().positive().default(10),
  UNLOCK_MAX_GAS: z.coerce.bigint().positive().default(500_000n),

  // Local forks only: point at contracts deployed somewhere other than the
  // addresses published in @clasp/sdk.
  CLASP_FACTORY_ADDRESS: optionalAddress,
  CLASP_ROUTER_ADDRESS: optionalAddress,
  CLASP_LAUNCHER_ADDRESS: optionalAddress,
});

const parsed = Schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`invalid environment:\n${issues}`);
}
const raw = parsed.data;

export const isMainnet = raw.CHAIN_ID === MAINNET_CHAIN_ID;

export const env = {
  production: raw.NODE_ENV === "production",
  databaseUrl: raw.DATABASE_URL,
  rpcUrl: raw.RPC_URL,
  chainId: raw.CHAIN_ID,
  logLevel: raw.LOG_LEVEL,

  port: raw.PORT,
  host: raw.HOST,
  corsOrigins: (raw.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  publicApiUrl: (raw.PUBLIC_API_URL ?? `http://localhost:${raw.PORT}`).replace(/\/+$/, ""),

  // The SDK publishes the factory deploy block once deployed; START_BLOCK overrides it.
  startBlock: raw.START_BLOCK ?? (deployBlock > 0n ? deployBlock : undefined),
  confirmations: raw.CONFIRMATIONS,
  logRange: raw.LOG_RANGE,
  pollMs: raw.POLL_MS,
  reconcileMs: raw.RECONCILE_MS,
  ipfsGateway: raw.IPFS_GATEWAY.endsWith("/") ? raw.IPFS_GATEWAY : `${raw.IPFS_GATEWAY}/`,

  keeperPrivateKey: raw.KEEPER_PRIVATE_KEY as `0x${string}` | undefined,
  keeperMinBalanceWei: raw.KEEPER_MIN_BALANCE_WEI,
  harvestThresholdWei: raw.HARVEST_THRESHOLD_WEI,
  treasuryClaimThresholdWei: raw.TREASURY_CLAIM_THRESHOLD_WEI,
  unlocksPerTick: raw.UNLOCKS_PER_TICK,
  unlockMaxGas: raw.UNLOCK_MAX_GAS,

  overrides: {
    factory: raw.CLASP_FACTORY_ADDRESS as Address | undefined,
    router: raw.CLASP_ROUTER_ADDRESS as Address | undefined,
    launcher: raw.CLASP_LAUNCHER_ADDRESS as Address | undefined,
  },
} as const;

/**
 * What only the HTTP role needs, checked when it boots. On mainnet a missing
 * or wildcard CORS list is fatal: the site's origin must be named, and so must
 * the public URL uploaded images are served from, because it is written into
 * coins' on-chain logo field and can never be corrected afterwards.
 */
export function assertApiEnv() {
  if (isMainnet || env.production) {
    if (env.corsOrigins.length === 0) throw new Error("CORS_ORIGINS must list the site origin(s)");
    if (env.corsOrigins.includes("*")) throw new Error("CORS_ORIGINS must not be * on mainnet");
    if (!raw.PUBLIC_API_URL && env.production) throw new Error("PUBLIC_API_URL is required in production");
  }
  for (const origin of env.corsOrigins) {
    if (origin !== "*" && !/^https?:\/\/[^/]+$/.test(origin)) {
      throw new Error(`CORS_ORIGINS entry ${origin} must be a bare origin like https://clasp.fun`);
    }
  }
}

/**
 * What only the indexer needs. START_BLOCK bounds the first pass: with a
 * block every ~0.1s, scanning from genesis would take the public RPC days.
 */
export function assertIndexerEnv(hasCursor: boolean) {
  if (!hasCursor && env.startBlock === undefined) {
    throw new Error("START_BLOCK is required until the indexer has a saved cursor and the SDK publishes deployBlock");
  }
  if (env.production && !env.keeperPrivateKey) {
    throw new Error("KEEPER_PRIVATE_KEY is required for the production indexer");
  }
}
