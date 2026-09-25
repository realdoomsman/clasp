import { addresses, ponsFactoryAbi } from "@clasp/sdk";
import { encodeAbiParameters, keccak256, parseAbi, zeroAddress, type Address } from "viem";
import { env } from "./env.ts";

/**
 * Pons v2 reads on top of the SDK's ABIs: which factory events matter to a
 * Clasp coin, how to find a graduated coin's v4 pool and price it, and how
 * to sanitise the metadata a coin declares about itself.
 */

export const MULTICALL3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

type PonsFactoryItem = (typeof ponsFactoryAbi)[number];
type RecipientEvent = Extract<PonsFactoryItem, { type: "event"; name: `CreatorFeeRecipient${string}` }>;

/** The three Pons factory events that change (or threaten) where a coin's creator fees go. */
export const ponsRecipientEvents = ponsFactoryAbi.filter(
  (item): item is RecipientEvent => item.type === "event" && item.name.startsWith("CreatorFeeRecipient"),
);

/** Uniswap v4 PoolManager exposes its storage; slot0 is read straight out of it. */
export const poolManagerAbi = parseAbi(["function extsload(bytes32 slot) view returns (bytes32)"]);

/** Frozen per launch on its curve; the SDK's curve ABI does not carry it. */
export const curveFeeShareAbi = parseAbi(["function protocolFeeShareBps() view returns (uint16)"]);

export const multicall3Abi = parseAbi(["function getEthBalance(address addr) view returns (uint256 balance)"]);

/** PonsV2 GraduationPhase. */
export const Phase = { NotGraduated: 0, Swept: 1, PoolCreated: 2, Rescued: 3 } as const;

/** The fields of the factory's LaunchedToken record the price read needs. */
export interface LaunchedToken {
  token: Address;
  curve: Address;
  poolFee: number;
  tickSpacing: number;
  phase: number;
  sweptQuote: bigint;
  sweptTokens: bigint;
}

const ONE_TOKEN = 10n ** 18n;
const Q192 = 1n << 192n;
/** Uniswap v4 StateLibrary.POOLS_SLOT. */
const POOLS_SLOT = 6n;

/**
 * The v4 pool a coin graduates into: ETH (address 0, always currency0) against
 * the coin, at the fee and spacing the launch snapshotted, behind the Pons hook.
 */
export function poolIdOf(launch: Pick<LaunchedToken, "token" | "poolFee" | "tickSpacing">): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [zeroAddress, launch.token, launch.poolFee, launch.tickSpacing, addresses.ponsMemeHook],
    ),
  );
}

/** Storage slot of `pools[poolId].slot0` inside the PoolManager. */
export function poolSlot0Key(poolId: `0x${string}`): `0x${string}` {
  return keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [poolId, POOLS_SLOT]));
}

/** Wei per whole token from a v4 slot0 word (ETH is currency0, the coin currency1). */
export function priceFromSlot0(slot0: `0x${string}`): bigint | null {
  const sqrtPriceX96 = BigInt(slot0) & ((1n << 160n) - 1n);
  if (sqrtPriceX96 === 0n) return null;
  return (ONE_TOKEN * Q192) / (sqrtPriceX96 * sqrtPriceX96);
}

/** Wei per whole token from constant-product reserves. */
export function priceFromReserves(quote: bigint, tokens: bigint): bigint | null {
  if (tokens === 0n) return null;
  return (quote * ONE_TOKEN) / tokens;
}

const MAX_URL_LENGTH = 512;

/**
 * Coin metadata is whatever its launcher typed. Only http(s) URLs survive
 * (ipfs:// is rewritten onto the configured gateway); everything else —
 * javascript:, data:, relative paths, oversized strings — becomes null, so
 * the site can put the result straight into an href or img src.
 */
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim();
  if (candidate.startsWith("ipfs://")) candidate = env.ipfsGateway + candidate.slice("ipfs://".length).replace(/^ipfs\//, "");
  if (candidate.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Social handles are stored as URLs; a bare handle is expanded onto its network. */
export function socialUrl(kind: "twitter" | "telegram", value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_]{1,64}$/.test(trimmed.replace(/^@/, ""))) {
    const handle = trimmed.replace(/^@/, "");
    return kind === "twitter" ? `https://x.com/${handle}` : `https://t.me/${handle}`;
  }
  return safeUrl(trimmed);
}

/** Plain text fields are capped so one coin cannot bloat every list response. */
export function cleanText(value: string, max: number): string {
  // Strip C0/C1 control characters except newline and tab.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "").slice(0, max);
}
