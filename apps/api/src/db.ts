import postgres from "postgres";
import { env } from "./env.ts";

/**
 * One pooled connection per process, shared by everything in it.
 *
 * `numeric` and `bigint` columns come back as strings: wei amounts and
 * weights routinely exceed 2^53, and silently losing precision here would
 * corrupt every number the site shows. Values go in as strings for the same
 * reason (bigint is serialised with toString).
 */
export const sql = postgres(env.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15,
  transform: { undefined: null },
  types: {
    bigint: {
      to: 20,
      from: [20],
      serialize: (value: string | number | bigint) => value.toString(),
      parse: (value: string) => value,
    },
  },
  onnotice: () => {},
});

export type Sql = typeof sql;
export type Tx = postgres.TransactionSql<Record<string, never>>;
