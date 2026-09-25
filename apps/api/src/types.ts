/**
 * Response shapes of the read API. The website mirrors these, so a change
 * here is a change to SPEC.md first.
 *
 * Conventions: every wei / token base-unit amount is a decimal string (they
 * routinely exceed 2^53); timestamps are unix seconds as numbers; addresses
 * are EIP-55 checksummed; percentages are plain numbers (12.5 means 12.5%).
 */

export type Address = `0x${string}`;
export type Hash = `0x${string}`;

export interface HealthResponse {
  ok: boolean;
  /** Latest block the RPC reports (cached for a few seconds). */
  block: number;
  chainId: number;
  /** Last block the indexer has fully processed, or null before its first pass. */
  indexedBlock: number | null;
}

export interface StatsResponse {
  coins: number;
  /** Sum over coins of `totalLocked × price`, in wei. */
  lockedValueEth: string;
  /** Sum of every vault's `lifetimeRewards` (ETH claimed by lockers, including on unlock), in wei. */
  paidToLockersEth: string;
  /** ETH that arrived in vaults in the last 24 hours (`FeesArrived.amount`), in wei. */
  fees24hEth: string;
  /** Distinct wallets with at least one open lock. */
  lockers: number;
}

export interface CoinSummary {
  token: Address;
  vault: Address;
  name: string;
  symbol: string;
  /** http(s) only; anything else the coin declared is dropped. */
  image: string | null;
  /** The Pons deployer of the coin (who launched it). */
  creator: Address;
  /** Wei per one whole token (1e18 base units); null when no market is readable. */
  priceEth: string | null;
  /** `priceEth × totalSupply / 1e18`, in wei. */
  marketCapEth: string | null;
  /** Token base units in circulation (`totalSupply()`). */
  totalSupply: string;
  totalLocked: string;
  totalWeight: string;
  /** Distinct owners with an open lock in this vault. */
  lockers: number;
  /** The vault's `lifetimeRewards`: ETH paid out to lockers since creation, in wei. */
  paidToLockers: string;
  /**
   * Annualised: ETH credited to lockers in the last 7 days × 365/7, divided by
   * the ETH value of the locked tokens, as a percent. Null when nothing is
   * locked or the coin has no readable price.
   */
  apr: number | null;
  graduated: boolean;
  /** When the vault was created (unix seconds). */
  createdAt: number;
}

export interface CoinsResponse {
  coins: CoinSummary[];
}

export interface VaultState {
  /** Native balance of the vault contract, in wei. */
  balance: string;
  undistributed: string;
  streamEnd: number;
  treasuryOwed: string;
  lifetimeInflow: string;
  lifetimeRewards: string;
  accRewardPerWeight: string;
  /** Creator fees credited to the vault in the Pons escrow, not yet harvested. */
  escrowBalance: string;
  /**
   * Before graduation: the creator's share of fees still held by the Pons
   * curve (harvest sweeps it). Counts for this vault only while it is the
   * fee recipient. "0" after graduation.
   */
  curveFees: string;
}

export interface AdminRedirect {
  newRecipient: Address;
  /** Earliest time Pons can execute the redirect (unix seconds). */
  executableAt: number;
  /** After this the proposal lapses unless re-proposed (unix seconds). */
  expiresAt: number;
}

export interface CoinDetail extends CoinSummary {
  description: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
  farcaster: string | null;
  /** Pons creator tax on every trade, paid to the fee recipient (the vault). */
  creatorTaxBps: number;
  treasury: Address;
  /** The vault's frozen Terms struct, field names as in the contract, values stringified. */
  terms: Record<string, string>;
  vaultState: VaultState;
  /** Current Pons `creatorFeeRecipient` of the coin. */
  feeRecipient: Address;
  /** True when that recipient is this coin's vault. */
  feeRecipientOk: boolean;
  adminRedirectPending: AdminRedirect | null;
  fees24hEth: string;
  fees7dEth: string;
  /** Lockers' share of fees that arrived in the last 7 days (what `apr` uses). */
  toLockers7dEth: string;
}

export type ActivityKind = "lock" | "increase" | "extend" | "claim" | "unlock" | "fees" | "treasury";

export interface ActivityRow {
  kind: ActivityKind;
  /** Position id within the vault; null for vault-wide events. */
  id: string | null;
  owner: Address | null;
  /**
   * lock / increase: tokens added. claim: wei paid. unlock: tokens returned
   * to the owner (principal minus burn). fees: wei that arrived. treasury:
   * wei paid to the treasury. extend: "0".
   */
  amount: string;
  /** The event's remaining arguments, stringified (e.g. burned, forfeited, early, toLockers). */
  data: Record<string, string | boolean>;
  txHash: Hash;
  blockNumber: number;
  blockTime: number;
}

export interface ActivityResponse {
  activity: ActivityRow[];
}

export interface Locker {
  owner: Address;
  positions: number;
  amount: string;
  weight: string;
  /** Share of the vault's total weight, percent. */
  sharePct: number;
  /** ETH claimed by this owner from this vault so far, in wei. */
  claimed: string;
}

export interface LockersResponse {
  lockers: Locker[];
}

export interface Position {
  vault: Address;
  token: Address;
  symbol: string;
  image: string | null;
  id: string;
  amount: string;
  weight: string;
  multiplierBps: number;
  lockStart: number;
  lockEnd: number;
  /** Claimable now, read live from the vault. */
  pending: string;
  claimed: string;
  matured: boolean;
  /** Tokens an early unlock would burn right now; "0" once matured. */
  earlyUnlockBurn: string;
}

export interface WalletResponse {
  positions: Position[];
  totals: {
    pending: string;
    claimed: string;
    lockedValueEth: string;
  };
}

export interface EarnerRow {
  rank: number;
  owner: Address;
  /** ETH claimed across all vaults, in wei. */
  claimed: string;
  positions: number;
}

export interface CoinBoardRow {
  rank: number;
  token: Address;
  vault: Address;
  name: string;
  symbol: string;
  image: string | null;
  paidToLockers: string;
  lockedValueEth: string;
  lockers: number;
}

export interface LongestRow {
  rank: number;
  owner: Address;
  token: Address;
  symbol: string;
  image: string | null;
  id: string;
  amount: string;
  durationSecs: number;
  lockEnd: number;
  multiplierBps: number;
}

export type LeaderboardResponse =
  | { board: "earners"; rows: EarnerRow[] }
  | { board: "coins"; rows: CoinBoardRow[] }
  | { board: "longest"; rows: LongestRow[] };

export interface ImageUploadResponse {
  /** Absolute URL, suitable for the Pons `logo` field. */
  url: string;
}
