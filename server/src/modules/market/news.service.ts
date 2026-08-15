import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';
import { cache } from '../../lib/cache';
import { logger } from '../../lib/logger';
import * as preferencesService from '../preferences/preferences.service';
import { cryptopanicProvider } from './providers/cryptopanic.provider';
import type { NewsArticle } from './providers/news.provider';
import { staticNewsProvider } from './providers/static-news.provider';

// §9.1 keys news by the caller's asset set, because the live provider genuinely filters upstream
// by currency — unlike prices, where the same fetch serves everyone. Sorted so two users with the
// same watchlist in a different order share one entry.
const cacheKey = (assets: string[]): string => `news:${[...assets].sort().join(',')}`;

interface CachedNews {
  articles: NewsArticle[];
  provider: string;
  fetchedAt: number;
}

export interface NewsResult {
  status: 'ok' | 'degraded';
  articles: NewsArticle[];
  provider: string;
  cachedAt: Date;
  notice?: string;
}

// There is no `unavailable` case here, unlike prices: the fallback provider reads a file that is
// parsed at boot, so once the process is running it cannot fail to answer.
export async function getNewsFor(userId: string): Promise<NewsResult> {
  const { assets } = await preferencesService.get(userId);

  const cached = await cache.getOrSet<CachedNews>(
    cacheKey(assets),
    env.CACHE_TTL_NEWS_MS,
    async () => {
      const startedAt = Date.now();

      try {
        const articles = await cryptopanicProvider.fetchArticles(assets);

        return { articles, provider: cryptopanicProvider.name, fetchedAt: Date.now() };
      } catch (error) {
        // The single try/catch for this provider call (§9.3). It degrades rather than rethrows,
        // and it logs — a fallback that happens silently is indistinguishable from a live feed.
        const appError =
          error instanceof AppError
            ? error
            : new AppError('UPSTREAM_ERROR', 'CryptoPanic could not be reached.');

        logger.warn('News provider failed, falling back to the curated feed', {
          provider: cryptopanicProvider.name,
          code: appError.code,
          elapsedMs: Date.now() - startedAt,
          cause: appError.message,
        });

        const articles = await staticNewsProvider.fetchArticles(assets);

        return { articles, provider: staticNewsProvider.name, fetchedAt: Date.now() };
      }
    },
  );

  const degraded = cached.provider !== cryptopanicProvider.name;

  return {
    status: degraded ? 'degraded' : 'ok',
    articles: cached.articles,
    provider: cached.provider,
    cachedAt: new Date(cached.fetchedAt),
    // §6.3: never conceal degradation. Presenting a curated feed as a live one would be the
    // dashboard lying about where its content came from.
    ...(degraded
      ? { notice: 'Showing our curated feed — the live news provider is unavailable.' }
      : {}),
  };
}
