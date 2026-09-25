import { bucket, defineRailway, postgres, preserve, project, service, volume } from "railway/iac";

/**
 * Clasp's Railway project (see docs/RUNBOOK.md). `railway config plan` previews
 * changes; `railway config apply` applies them. Anything omitted here is removed
 * from Railway on apply. Secret values are `preserve()`: they live only in
 * Railway, never in git.
 */
export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "us-west2" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: "us-west2",
    sizeMB: 50000,
  });
  // Point-in-time recovery archive (daily/weekly/monthly schedule: `railway postgres pitr schedule list`).
  const PostgresPITR = bucket("Postgres-PITR", { region: "sjc" });

  // Read API, image host, Google login and custody. Stateless: scales out.
  const api = service("api", {
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/api/Dockerfile" },
    deploy: { healthcheckPath: "/health", healthcheckTimeout: 60, restartPolicyType: "ALWAYS", drainingSeconds: 15 },
    replicas: { "us-west2": 1 },
    networking: { serviceDomains: { "api-production-373a2.up.railway.app": { port: 8080 } } },
    domains: [{ domain: "api.clasp.fun", port: 8080 }],
    env: {
      CHAIN_ID: preserve(),
      CORS_ORIGINS: preserve(),
      CUSTODY_MASTER_KEY: preserve(),
      DATABASE_URL: preserve(),
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      PORT: preserve(),
      PUBLIC_API_URL: preserve(),
      RPC_URL: preserve(),
      SESSION_SECRET: preserve(),
    },
  });

  // Indexer + keeper. Exactly one, and never two at once: a new deploy starts only
  // after the old container has stopped, so two keepers can't race each other's sends.
  const indexer = service("indexer", {
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/api/Dockerfile" },
    deploy: { overlapSeconds: 0, drainingSeconds: 30, restartPolicyType: "ALWAYS" },
    replicas: { "us-west2": 1 },
    env: {
      CHAIN_ID: preserve(),
      DATABASE_URL: preserve(),
      KEEPER_PRIVATE_KEY: preserve(),
      ROLE: preserve(),
      RPC_URL: preserve(),
    },
  });

  // Website. NEXT_PUBLIC_* are build args: changing one needs a rebuild.
  const web = service("web", {
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/web/Dockerfile" },
    deploy: { healthcheckPath: "/icon.svg", healthcheckTimeout: 60, restartPolicyType: "ALWAYS", drainingSeconds: 15 },
    replicas: { "us-west2": 1 },
    networking: { serviceDomains: { "web-production-56f7f.up.railway.app": { port: 3000 } } },
    domains: [
      { domain: "clasp.fun", port: 3000 },
      { domain: "www.clasp.fun", port: 3000 },
    ],
    env: {
      NEXT_PUBLIC_API_URL: preserve(),
      NEXT_PUBLIC_RPC_URL: preserve(),
      NEXT_PUBLIC_SITE_URL: preserve(),
      PORT: preserve(),
    },
  });

  return project("clasp", {
    resources: [Postgres, api, indexer, web, postgresVolume, PostgresPITR],
  });
});
