import { addresses, claspFactoryAbi, claspLauncherAbi, claspRouterAbi, claspVaultAbi } from "@clasp/sdk";
import { zeroAddress, type Address } from "viem";
import { env } from "./env.ts";

export { claspFactoryAbi, claspLauncherAbi, claspRouterAbi, claspVaultAbi };

/**
 * Deployed Clasp contracts: the SDK's published addresses, unless a local
 * fork run overrides them (CLASP_*_ADDRESS). A zero address means "not
 * deployed yet"; the indexer then has nothing of ours to scan.
 */
export const clasp: { factory: Address; router: Address; launcher: Address } = {
  factory: env.overrides.factory ?? addresses.claspFactory,
  router: env.overrides.router ?? addresses.claspRouter,
  launcher: env.overrides.launcher ?? addresses.claspLauncher,
};

export const claspDeployed = clasp.factory !== zeroAddress;
