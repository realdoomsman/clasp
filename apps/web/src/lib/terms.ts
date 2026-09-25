import { claspVaultAbi, DEFAULT_TERMS, type Terms } from '@clasp/sdk';
import { encodeAbiParameters, keccak256, type Hex } from 'viem';

type TermsFn = Extract<(typeof claspVaultAbi)[number], { type: 'function'; name: 'terms' }>;
const TERMS_PARAM = claspVaultAbi.find((x): x is TermsFn => x.type === 'function' && x.name === 'terms')!.outputs[0];

/** `keccak256(abi.encode(terms))`, the value ClaspFactory.defaultsHash() and the launcher compare against. */
export function termsHash(terms: Terms): Hex {
  return keccak256(encodeAbiParameters([TERMS_PARAM], [terms]));
}

/**
 * The API returns a vault's frozen Terms with every value stringified. Rebuild
 * the SDK's Terms shape from it, keeping each field's numeric type; a field
 * the API left out falls back to Clasp's default.
 */
export function termsFromApi(raw: Record<string, string>): Terms {
  const entries = Object.entries(DEFAULT_TERMS).map(([key, fallback]) => {
    const value = raw[key] ?? String(fallback);
    return [key, typeof fallback === 'bigint' ? BigInt(value) : Number(value)];
  });
  return Object.fromEntries(entries) as Terms;
}

/** "25%" from basis points. */
export function bpsToPercent(bps: bigint | number): string {
  return `${Number(bps) / 100}%`;
}
