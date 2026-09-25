import { pino } from "pino";
import { env } from "./env.ts";

/** Structured JSON logs for both roles; the HTTP server hands this same instance to Fastify. */
export const log = pino({ level: env.logLevel });
