import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';
import { cache } from '../../lib/cache';
import { logger } from '../../lib/logger';
import * as preferencesService from '../preferences/preferences.service';
import { fetchAllowlistPrices, type CoinPrice } from './providers/coingecko.provider';

// §9.1 keys per coin rather than per asset-set, so entries are shared across users and one
// batched fetch serves every watchlist.
const cacheKey = (coinId: string): string => `price:${coinId}`;

interface CachedCoin {
  coin: CoinPrice;
  fetchedAt: number;
}

export interface PricesResult {
  status: 'ok' | 'degraded' | 'unavailable';
  coins: CoinPrice[];
  cachedAt: Date | null;
  notice?: string;
}

// The predicate is what lets TypeScript narrow the array from (CachedCoin | undefined)[] to
// CachedCoin[]; a plain `!== undefined` filter does not change the element type.
function collect(assets: string[], read: (key: string) => CachedCoin | undefined): CachedCoin[] {
  return assets
    .map((coinId) => read(cacheKey(coinId)))
    .filter((entry): entry is CachedCoin => entry !== undefined);
}

function oldestFetchedAt(entries: CachedCoin[]): Date | null {
  if (entries.length === 0) {
    return null;
  }

  return new Date(Math.min(...entries.map((entry) => entry.fetchedAt)));
}

function ageLabel(fetchedAt: Date): string {
  const minutes = Math.floor((Date.now() - fetchedAt.getTime()) / 60_000);

  if (minutes < 1) {
    return 'less than a minute ago';
  }

  return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
}

function served(entries: CachedCoin[]): Pick<PricesResult, 'coins' | 'cachedAt'> {
  return {
    coins: entries.map((entry) => entry.coin),
    cachedAt: oldestFetchedAt(entries),
  };
}

// Rate-limited and unreachable are different situations for the reader: one resolves on its own,
// the other may not. CLAUDE.md §5 asks the copy to distinguish them.
function staleResult(assets: string[], rateLimited: boolean): PricesResult {
  const stale = collect(assets, (key) => cache.getStale<CachedCoin>(key));

  if (stale.length === 0) {
    return {
      status: 'unavailable',
      coins: [],
      cachedAt: null,
      notice: rateLimited
        ? "Prices aren't available yet — the market data provider is rate-limiting requests. Try again in a minute."
        : "Prices aren't available right now — the market data provider isn't responding. Try again in a moment.",
    };
  }

  const { coins, cachedAt } = served(stale);
  const age = cachedAt === null ? 'a moment ago' : ageLabel(cachedAt);

  return {
    status: 'degraded',
    coins,
    cachedAt,
    notice: rateLimited
      ? `Prices from ${age} — live updates are rate-limited.`
      : `Prices from ${age} — the market data provider isn't responding.`,
  };
}

export async function getPricesFor(userId: string): Promise<PricesResult> {
  const { assets } = await preferencesService.get(userId);

  const fresh = collect(assets, (key) => cache.get<CachedCoin>(key));

  if (fresh.length === assets.length) {
    return { status: 'ok', ...served(fresh) };
  }

  const startedAt = Date.now();

  try {
    const coins = await fetchAllowlistPrices();
    const fetchedAt = Date.now();

    // One line per upstream call, so the cache is provable from the logs rather than inferred
    // from response times: two requests inside the TTL print this once.
    logger.info('Fetched prices from CoinGecko', {
      coins: coins.length,
      elapsedMs: fetchedAt - startedAt,
    });

    for (const coin of coins) {
      cache.set<CachedCoin>(cacheKey(coin.id), { coin, fetchedAt }, env.CACHE_TTL_PRICES_MS);
    }

    const missing = assets.filter((coinId) => !coins.some((coin) => coin.id === coinId));

    if (missing.length > 0) {
      // The allowlist has drifted from CoinGecko's ids. The user cannot act on that and the
      // coins we did get are live, so the status stays ok and the operator gets the log line.
      logger.warn('Coins missing from the market response', { provider: 'coingecko', missing });
    }

    return { status: 'ok', ...served(collect(assets, (key) => cache.get<CachedCoin>(key))) };
  } catch (error) {
    // The single try/catch for this provider call (§9.3). The provider names the failures it can
    // classify; a timeout or a DNS failure arrives raw and is mapped here.
    const appError =
      error instanceof AppError
        ? error
        : new AppError('UPSTREAM_ERROR', 'CoinGecko could not be reached.');

    logger.warn('Market price fetch failed', {
      provider: 'coingecko',
      code: appError.code,
      elapsedMs: Date.now() - startedAt,
      cause: appError.message,
    });

    return staleResult(assets, appError.code === 'UPSTREAM_RATE_LIMITED');
  }
}
