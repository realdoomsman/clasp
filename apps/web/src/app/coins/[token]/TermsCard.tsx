import type { Terms } from '@clasp/sdk';
import Link from 'next/link';
import { RulesList } from '@/components/RulesList';
import { Card } from '@/components/ui';
import type { CoinDetail } from '@/lib/api';
import { explorerAddress } from '@/lib/chain';
import { shortAddress } from '@/lib/format';
import { bpsToPercent } from '@/lib/terms';

/** The vault's rules, frozen when it was created, in plain words. */
export function TermsCard({ coin, terms }: { coin: CoinDetail; terms: Terms }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl font-semibold">This vault’s rules</h2>
      <p className="mt-1 text-sm text-ink-2">Written into the vault when it was created. Nobody can change them.</p>
      <div className="mt-4">
        <RulesList
          terms={terms}
          symbol={coin.symbol}
          extra={[['Pons creator fee', `${bpsToPercent(coin.creatorTaxBps)} of each Pons trade, paid to the vault`]]}
        />
      </div>
      <div className="mt-4 rounded-2xl bg-paper-2 p-4 text-sm text-ink-2">
        <p>
          <strong className="text-ink">One outside risk:</strong> Pons’s admin can redirect this coin’s creator fees after a
          3-day public wait. Clasp’s 2% fee, locked coins and earned ETH can’t be touched.{' '}
          <Link href="/security#pons-admin" className="font-semibold text-accent-strong underline">
            Learn more
          </Link>
        </p>
      </div>
      <p className="num mt-4 text-xs text-ink-3">
        Vault{' '}
        <a href={explorerAddress(coin.vault)} target="_blank" rel="noreferrer" className="underline">
          {shortAddress(coin.vault)}
        </a>{' '}
        · Coin{' '}
        <a href={explorerAddress(coin.token)} target="_blank" rel="noreferrer" className="underline">
          {shortAddress(coin.token)}
        </a>
      </p>
    </Card>
  );
}
