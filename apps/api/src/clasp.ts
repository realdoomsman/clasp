import { addresses, claspFactoryAbi, claspLauncherAbi, claspRouterAbi, claspVaultAbi } from "@clasp/sdk";
import { isAddressEqual, zeroAddress, type Address } from "viem";
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

/**
 * Who a coin's page credits as its creator. A coin launched through
 * ClaspLauncher has the launcher contract as both its Pons deployer and the
 * caller of createVault, so the launcher's own `Launched.creator` wins; any
 * other coin is credited to its Pons deployer, falling back to whoever
 * registered the vault. The launcher itself is never an answer.
 */
export function attributeCreator(input: {
  launchedCreator: Address | null;
  ponsDeployer: Address | null;
  registeredBy: Address | null;
  launcher: Address;
}): Address | null {
  if (input.launchedCreator) return input.launchedCreator;
  const notLauncher = (a: Address | null) =>
    a !== null && (input.launcher === zeroAddress || !isAddressEqual(a, input.launcher)) ? a : null;
  return notLauncher(input.ponsDeployer) ?? notLauncher(input.registeredBy);
}
