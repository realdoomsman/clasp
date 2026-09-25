import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { publicClient } from "./chain.ts";
import { sql } from "./db.ts";
import { assertApiEnv, env } from "./env.ts";
import { CURSOR } from "./ingest.ts";
import { log } from "./log.ts";
import { coinRoutes } from "./routes/coins.ts";
import { MAX_IMAGE_BYTES, imageRoutes } from "./routes/images.ts";
import { walletRoutes } from "./routes/wallet.ts";
import type { HealthResponse } from "./types.ts";

/**
 * ROLE=api. Read-only over the indexer's tables plus a few live reads; never
 * holds a key and is never in the signing path — transactions are built and
 * signed in the browser. Stateless, so it can scale out.
 */

assertApiEnv();

const app = Fastify({
  loggerInstance: log.child({ svc: "api" }),
  bodyLimit: 32 * 1024,
  // Railway's edge terminates TLS; the socket address is the edge, and the
  // client address is taken from X-Forwarded-For only where it matters (the
  // rate-limit key below).
  trustProxy: false,
});

await app.register(cors, {
  origin: env.corsOrigins.includes("*") ? true : env.corsOrigins,
  methods: ["GET", "POST"],
  // Nothing here uses cookies or auth headers.
  credentials: false,
  maxAge: 600,
});

await app.register(multipart, { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 } });

await app.register(rateLimit, {
  max: 240,
  timeWindow: "1 minute",
  // Railway's edge appends the address it accepted the connection from as the
  // right-most X-Forwarded-For entry; everything left of it is whatever the
  // client sent, so keying on it would let anyone reset their own limit.
  // Direct connections (local runs) have no header and use the socket.
  keyGenerator: (request) => {
    const header = request.headers["x-forwarded-for"];
    const forwarded = Array.isArray(header) ? header.join(",") : header;
    return forwarded?.split(",").at(-1)?.trim() || request.socket.remoteAddress || "unknown";
  },
});

// JSON and images only: nothing here should ever render as a page, be framed,
// or be sniffed into a different type.
app.addHook("onSend", async (_request, reply) => {
  reply.header("x-content-type-options", "nosniff");
  reply.header("x-frame-options", "DENY");
  reply.header("referrer-policy", "no-referrer");
  reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  reply.header("cross-origin-opener-policy", "same-origin");
  if (!reply.hasHeader("cross-origin-resource-policy")) reply.header("cross-origin-resource-policy", "same-site");
  if (env.production) reply.header("strict-transport-security", "max-age=63072000; includeSubDomains");
});

app.setErrorHandler((error: unknown, request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "invalid request",
      issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  const status =
    error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
  if (status >= 500) request.log.error({ err: error }, "request failed");
  const message = error instanceof Error ? error.message : "internal error";
  return reply.code(status).send({ error: status >= 500 ? "internal error" : message });
});

app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "not found" }));

// Polled by the platform and by anyone else; the block is served from a
// value at most a few seconds old so polling never becomes one RPC call each.
const BLOCK_TTL_MS = 5_000;
let blockCache: { at: number; block: Promise<bigint> } | null = null;

app.get("/health", async (_request, reply): Promise<HealthResponse> => {
  if (!blockCache || Date.now() - blockCache.at >= BLOCK_TTL_MS) {
    const block = publicClient.getBlockNumber({ cacheTime: 0 });
    // A failed read must not stick in the cache.
    block.catch(() => (blockCache = null));
    blockCache = { at: Date.now(), block };
  }
  const [[cursor], block] = await Promise.all([
    sql<{ block: string }[]>`SELECT block FROM indexer_cursor WHERE name = ${CURSOR}`,
    blockCache.block,
  ]);
  reply.header("cache-control", "no-store");
  return {
    ok: true,
    block: Number(block),
    chainId: env.chainId,
    indexedBlock: cursor ? Number(cursor.block) : null,
  };
});

await app.register(coinRoutes, { prefix: "/api" });
await app.register(walletRoutes, { prefix: "/api" });
await app.register(imageRoutes);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await sql.end({ timeout: 5 });
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port: env.port, host: env.host });
