import { DegradedNotice } from '../../../components/ui/DegradedNotice';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { CoinPrice, InvestorType } from '../../../types/api';
import { formatPercent, formatPrice } from '../format';
import { SectionCard } from '../SectionCard';
import { sectionErrorMessage } from '../section-error';
import { usePrices } from '../use-dashboard-queries';
import { VoteButtons } from '../VoteButtons';

// §8: the investor type decides which window is emphasised, and §17 assigns NFT_COLLECTOR the
// 24h window alongside day traders — a collector tracks moves, not multi-week trends.
function windowFor(investorType: InvestorType | undefined): {
  key: 'change24h' | 'change30d';
  label: string;
} {
  return investorType === 'HODLER'
    ? { key: 'change30d', label: '30d' }
    : { key: 'change24h', label: '24h' };
}

function ChangeValue({ change }: { change: number | null }) {
  if (change === null) {
    return <span className="text-sm text-muted">No data</span>;
  }

  return (
    <span className={`text-sm tabular-nums ${change >= 0 ? 'text-positive' : 'text-negative'}`}>
      {formatPercent(change)}
    </span>
  );
}

function CoinTile({ coin, window }: { coin: CoinPrice; window: ReturnType<typeof windowFor> }) {
  return (
    <li className="rounded-surface border border-border bg-surface-alt p-4">
      <div className="flex items-center gap-3">
        {/* Served from CoinGecko's CDN. No key travels with it and nothing about the user
            leaves — the URL arrives inside our own response (§17). */}
        <img src={coin.image} alt="" className="h-8 w-8 rounded-full" />
        <div className="min-w-0">
          <p className="truncate font-medium">{coin.name}</p>
          <p className="text-xs uppercase text-muted">{coin.symbol}</p>
        </div>
      </div>
      <p className="mt-3 text-lg tabular-nums">{formatPrice(coin.price)}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="flex items-baseline gap-2">
          <ChangeValue change={coin[window.key]} />
          <span className="text-xs text-muted">{window.label}</span>
        </p>
        <VoteButtons sectionType="PRICES" itemRef={coin.id} label={coin.name} />
      </div>
    </li>
  );
}

export function PricesSection({
  preferred,
  investorType,
}: {
  preferred: boolean;
  investorType: InvestorType | undefined;
}) {
  const prices = usePrices();
  const window = windowFor(investorType);

  return (
    <SectionCard title="Your assets" preferred={preferred}>
      {prices.isPending ? (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index}>
              <Skeleton className="h-36" />
            </li>
          ))}
        </ul>
      ) : prices.isError ? (
        <ErrorState
          message={sectionErrorMessage(prices.error)}
          onRetry={() => void prices.refetch()}
        />
      ) : prices.data.coins.length === 0 ? (
        // §6.3's `unavailable` arrives inside a 200 with an empty list, so the actionable
        // message is the server's own notice — it is the only thing that knows whether this was
        // a rate limit or an unreachable provider.
        <ErrorState
          message={
            prices.data.notice ?? "Prices aren't available right now. Try again in a moment."
          }
          onRetry={() => void prices.refetch()}
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {prices.data.coins.map((coin) => (
              <CoinTile key={coin.id} coin={coin} window={window} />
            ))}
          </ul>
          {prices.data.notice !== undefined && <DegradedNotice notice={prices.data.notice} />}
        </>
      )}
    </SectionCard>
  );
}
