import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from 'viem';

// Plain-language messages for the contract errors a user can actually hit.
// Keys are custom error names from the Clasp contracts, Pons, and ERC-20.
const REVERTS: Record<string, string> = {
  // Clasp vault
  NotOwner: 'Only the wallet that made this lock can do that.',
  UnknownPosition: 'This lock doesn’t exist (it may already be closed).',
  AmountTooSmall: 'The smallest lock is one whole coin.',
  InvalidDuration: 'That lock length is outside what this coin allows — or, when adding coins, there’s less than the shortest lock length left. Lock for longer first.',
  NotMatured: 'This lock hasn’t ended yet.',
  AlreadyMatured: 'This lock has already ended, so it can’t be changed. Unlock it instead.',
  ExtendMustIncreaseEnd: 'The new end date has to be later than the current one.',
  NothingOwed: 'There’s nothing waiting for you.',
  InvalidOwner: 'That wallet can’t own a lock.',
  UnrecordedOutflow: 'The vault refused this because its balance didn’t add up. Please report this.',
  // Clasp factory / launcher
  IsPaused: 'New vaults are paused right now. Existing vaults keep working.',
  VaultExists: 'This coin already has a Clasp vault.',
  NotPonsLaunch: 'That address isn’t a coin launched on Pons v2.',
  NotEthPaired: 'Clasp only supports coins traded against ETH.',
  BuybackEnabled: 'This coin has Pons buybacks switched on, which Clasp can’t support.',
  WrongValue: 'The ETH amount didn’t match the launch cost. Refresh and try again.',
  InvalidLockPercent: 'The share to lock must be between 0% and 100%.',
  TermsMismatch: 'Clasp’s rules changed since you opened this page — please review and try again.',
  TreasuryMismatch: 'Clasp’s rules changed since you opened this page — please review and try again.',
  // Router / trading
  NoVault: 'This coin doesn’t have a Clasp vault yet.',
  NotTradeable: 'This coin is moving to its Uniswap pool. Trading reopens as soon as the pool is set up.',
  ZeroAmount: 'Enter an amount first.',
  Slippage: 'The price moved more than your slippage setting — try again in a few seconds.',
  SlippageExceeded: 'The price moved more than your slippage setting — try again in a few seconds.',
  Expired: 'The trade took too long to confirm. Try again.',
  CurveGraduated: 'This coin just moved to its Uniswap pool. Refresh the page and try again.',
  TransferFailed: 'A transfer inside the transaction failed. Nothing was sent.',
  // ERC-20
  ERC20InsufficientBalance: 'You don’t have enough of this coin.',
  ERC20InsufficientAllowance: 'Clasp needs your permission to move these coins first.',
};

function humanizeName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

/** Turns anything thrown by viem / a wallet into one sentence a person can act on. */
export function humanError(error: unknown): string {
  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) return 'You cancelled the request in your wallet.';
    if (error.walk((e) => e instanceof InsufficientFundsError))
      return 'Not enough ETH to cover this and the network fee.';
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name && REVERTS[name]) return REVERTS[name];
      if (name) return `The contract said no: ${humanizeName(name)}.`;
      if (revert.reason) return `The contract said no: ${revert.reason}.`;
      return 'The contract refused this transaction. Nothing was sent.';
    }
    const text = `${error.shortMessage} ${error.details ?? ''}`.toLowerCase();
    if (text.includes('user rejected') || text.includes('user denied')) return 'You cancelled the request in your wallet.';
    if (text.includes('insufficient funds')) return 'Not enough ETH to cover this and the network fee.';
    if (text.includes('chain mismatch') || text.includes('does not match the target chain'))
      return 'Switch your wallet to Robinhood Chain and try again.';
    return error.shortMessage;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
