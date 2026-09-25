import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BaseError, createWalletClient, getAddress, http, isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { chain } from "../chain.ts";
import { createSealedKey, openSealedKey, type SealedKey } from "../custody.ts";
import { sql } from "../db.ts";
import { env } from "../env.ts";
import type { GoogleSessionResponse } from "../types.ts";

/**
 * Google login with Clasp-held wallets.
 *
 * OAuth: authorization-code flow with PKCE. /auth/google/start stores state and
 * the PKCE verifier in a short-lived HMAC-signed cookie and sends the browser to
 * Google; /auth/google/callback exchanges the code server-to-server, reads the
 * ID token straight from Google's token endpoint over TLS, creates the wallet on
 * first login and sets an HttpOnly session cookie on this host.
 *
 * Custody: /custody/send signs and broadcasts one transaction from the signed-in
 * account's wallet; /custody/export returns the private key, only within 15
 * minutes of a fresh Google login. Every send and export is logged.
 *
 * CSRF: the session cookie is SameSite=Lax, and every state-changing call also
 * requires an Origin from CORS_ORIGINS.
 */

const SESSION_COOKIE = "clasp_session";
const OAUTH_COOKIE = "clasp_oauth";
const SESSION_SECS = 30 * 24 * 60 * 60;
const OAUTH_SECS = 10 * 60;
const EXPORT_WINDOW_MS = 15 * 60_000;

const b64url = (bytes: Buffer) => bytes.toString("base64url");
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function readCookies(request: FastifyRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function setCookie(reply: FastifyReply, name: string, value: string, maxAge: number, path: string) {
  const parts = [`${name}=${value}`, `Path=${path}`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (env.production) parts.push("Secure");
  reply.header("set-cookie", parts.join("; "));
}

function sign(secret: string, payload: string): string {
  const body = b64url(Buffer.from(payload));
  return `${body}.${b64url(createHmac("sha256", secret).update(body).digest())}`;
}

function verify(secret: string, signed: string | undefined): string | null {
  if (!signed) return null;
  const [body, mac] = signed.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return Buffer.from(body, "base64url").toString();
}

/** Only same-site paths: never an absolute URL, protocol-relative URL, or fragment. */
function safeReturn(path: string | undefined): string {
  return path && /^\/(?!\/)[^\s\\#]{0,500}$/.test(path) ? path : "/";
}

function requireOrigin(request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = request.headers.origin;
  if (origin && env.corsOrigins.includes(origin)) return true;
  void reply.code(403).send({ error: "origin not allowed" });
  return false;
}

type Account = { googleSub: string; email: string; address: Address; sealed: SealedKey; sessionCreatedAt: Date };

async function currentAccount(request: FastifyRequest): Promise<Account | null> {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const [row] = await sql<
    { google_sub: string; email: string; address: Address; key_iv: Buffer; key_cipher: Buffer; key_version: number; created_at: Date }[]
  >`
    SELECT a.google_sub, a.email, a.address, a.key_iv, a.key_cipher, a.key_version, s.created_at
    FROM sessions s JOIN custodial_accounts a USING (google_sub)
    WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now()
  `;
  if (!row) return null;
  return {
    googleSub: row.google_sub,
    email: row.email,
    address: row.address,
    sealed: { address: row.address, iv: row.key_iv, cipher: row.key_cipher, version: row.key_version },
    sessionCreatedAt: row.created_at,
  };
}

const OAuthState = z.object({ state: z.string(), verifier: z.string(), ret: z.string(), exp: z.number() });
const GoogleClaims = z.object({
  iss: z.enum(["accounts.google.com", "https://accounts.google.com"]),
  aud: z.string(),
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.literal(true),
  exp: z.number(),
});

const hex = z.string().regex(/^0x[0-9a-fA-F]*$/);
const SendBody = z.object({
  to: z.string().refine((v) => isAddress(v, { strict: false }), "must be an address"),
  data: hex.optional(),
  value: hex.optional(),
  gas: hex.optional(),
});

export async function authRoutes(app: FastifyInstance) {
  const redirectUri = `${env.publicApiUrl}/auth/google/callback`;

  app.get("/auth/session", async (request, reply): Promise<GoogleSessionResponse> => {
    reply.header("cache-control", "no-store");
    if (!env.google) return { enabled: false, user: null };
    const account = await currentAccount(request);
    return { enabled: true, user: account ? { address: getAddress(account.address), email: account.email } : null };
  });

  app.get("/auth/google/start", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const google = env.google;
    if (!google) return reply.code(503).send({ error: "Google login is not set up" });
    const { return: ret } = z.object({ return: z.string().optional() }).parse(request.query);
    const state = b64url(randomBytes(16));
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    const saved = JSON.stringify({ state, verifier, ret: safeReturn(ret), exp: Date.now() + OAUTH_SECS * 1000 });
    setCookie(reply, OAUTH_COOKIE, sign(google.sessionSecret, saved), OAUTH_SECS, "/auth/google");

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return reply.redirect(url.toString());
  });

  app.get("/auth/google/callback", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const google = env.google;
    if (!google) return reply.code(503).send({ error: "Google login is not set up" });
    setCookie(reply, OAUTH_COOKIE, "", 0, "/auth/google");
    const fail = (why: string, ret = "/") => {
      request.log.warn({ why }, "google login failed");
      return reply.redirect(`${env.siteUrl}${ret}#google-login-failed`);
    };

    const query = z
      .object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() })
      .parse(request.query);
    const raw = verify(google.sessionSecret, readCookies(request)[OAUTH_COOKIE]);
    const saved = raw ? OAuthState.safeParse(JSON.parse(raw)) : null;
    if (!saved?.success || saved.data.exp < Date.now() || saved.data.state !== query.state) return fail("bad state");
    const ret = safeReturn(saved.data.ret);
    if (query.error || !query.code) return fail(query.error ?? "no code", ret);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: query.code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: saved.data.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) return fail(`token endpoint ${tokenRes.status}`, ret);
    const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
    // Received directly from Google's token endpoint over TLS, so the claims
    // can be trusted without re-verifying the signature (OIDC Core 3.1.3.7).
    const payload = idToken?.split(".")[1];
    const claims = payload ? GoogleClaims.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString())) : null;
    if (!claims?.success || claims.data.aud !== google.clientId || claims.data.exp * 1000 < Date.now()) {
      return fail("invalid id token", ret);
    }

    const sealed = createSealedKey(google.custodyMasterKey);
    await sql`
      INSERT INTO custodial_accounts (google_sub, email, address, key_iv, key_cipher, key_version)
      VALUES (${claims.data.sub}, ${claims.data.email}, ${sealed.address}, ${sealed.iv}, ${sealed.cipher}, ${sealed.version})
      ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, last_login_at = now()
    `;
    const token = b64url(randomBytes(32));
    await sql`
      INSERT INTO sessions (token_hash, google_sub, expires_at)
      VALUES (${sha256(token)}, ${claims.data.sub}, now() + make_interval(secs => ${SESSION_SECS}))
    `;
    setCookie(reply, SESSION_COOKIE, token, SESSION_SECS, "/");
    return reply.redirect(`${env.siteUrl}${ret}#google-login`);
  });

  app.post("/auth/logout", async (request, reply) => {
    if (!requireOrigin(request, reply)) return;
    const token = readCookies(request)[SESSION_COOKIE];
    if (token) await sql`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
    setCookie(reply, SESSION_COOKIE, "", 0, "/");
    return { ok: true };
  });

  app.post("/custody/send", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (!requireOrigin(request, reply)) return;
    const google = env.google;
    if (!google) return reply.code(503).send({ error: "Google login is not set up" });
    const account = await currentAccount(request);
    if (!account) return reply.code(401).send({ error: "Sign in with Google again." });
    const body = SendBody.parse(request.body);
    const to = getAddress(body.to);
    const value = body.value ? BigInt(body.value) : undefined;
    const wallet = createWalletClient({
      account: privateKeyToAccount(openSealedKey(google.custodyMasterKey, account.sealed)),
      chain,
      transport: http(env.rpcUrl, { retryCount: 3, timeout: 30_000 }),
    });

    // One send at a time per wallet, across API replicas, so nonces never collide.
    const lockKey = account.address.toLowerCase();
    const conn = await sql.reserve();
    try {
      await conn`SELECT pg_advisory_lock(hashtextextended(${lockKey}, 0))`;
      const hash = await wallet.sendTransaction({
        to,
        data: body.data as Hex | undefined,
        value,
        gas: body.gas ? BigInt(body.gas) : undefined,
      });
      await sql`
        INSERT INTO custody_log (google_sub, action, to_address, value, selector, tx_hash, status)
        VALUES (${account.googleSub}, 'send', ${to}, ${(value ?? 0n).toString()}, ${body.data?.slice(0, 10) ?? null}, ${hash}, 'sent')
      `;
      return { hash };
    } catch (error) {
      const message = error instanceof BaseError ? `${error.shortMessage} ${error.details ?? ""}`.trim() : String(error);
      await sql`
        INSERT INTO custody_log (google_sub, action, to_address, value, selector, status, detail)
        VALUES (${account.googleSub}, 'send', ${to}, ${(value ?? 0n).toString()}, ${body.data?.slice(0, 10) ?? null}, 'failed', ${message.slice(0, 500)})
      `;
      return reply.code(400).send({ error: message });
    } finally {
      await conn`SELECT pg_advisory_unlock(hashtextextended(${lockKey}, 0))`;
      conn.release();
    }
  });

  app.post("/custody/export", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
    if (!requireOrigin(request, reply)) return;
    const google = env.google;
    if (!google) return reply.code(503).send({ error: "Google login is not set up" });
    const account = await currentAccount(request);
    if (!account) return reply.code(401).send({ error: "Sign in with Google again." });
    if (Date.now() - account.sessionCreatedAt.getTime() > EXPORT_WINDOW_MS) {
      return reply.code(403).send({ error: "reauth" });
    }
    await sql`
      INSERT INTO custody_log (google_sub, action, status) VALUES (${account.googleSub}, 'export', 'exported')
    `;
    reply.header("cache-control", "no-store");
    return { privateKey: openSealedKey(google.custodyMasterKey, account.sealed) };
  });
}
