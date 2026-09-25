import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "./db.ts";

/**
 * The schema is idempotent (`IF NOT EXISTS` throughout), so migrating is
 * replaying it. Both roles run this before starting; an advisory lock keeps
 * two containers booting at once from racing on the same DDL.
 */
const here = dirname(fileURLToPath(import.meta.url));
const schema = await readFile(resolve(here, "schema.sql"), "utf8");

await sql.begin(async (tx) => {
  await tx`SELECT pg_advisory_xact_lock(4663)`;
  await tx.unsafe(schema);
});
console.log("migrated");
await sql.end();
