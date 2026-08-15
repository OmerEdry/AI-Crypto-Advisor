import { z } from 'zod';
import { env } from '../../../config/env';
import { AppError } from '../../../errors/app-error';
import type { NewsArticle, NewsProvider } from './news.provider';

const PROVIDER_NAME = 'cryptopanic';

// §2: the v2 API is at https://cryptopanic.com/api/{plan}/v2/. `developer` is the free tier's
// plan segment. Unverifiable without a token — the request 401s before the path matters — so it
// is recorded in §17 rather than presented as confirmed.
const POSTS_URL = 'https://cryptopanic.com/api/developer/v2/posts/';

const TIMEOUT_MS = 5_000;

// CryptoPanic filters by ticker code; everything else in this project keys on CoinGecko ids.
// Translating between the two is the adapter's job, which is why the map lives here and not in
// config/coins.ts. Every symbol was read from CoinGecko's own /coins/markets response.
const SYMBOL_BY_COIN_ID: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  binancecoin: 'BNB',
  ripple: 'XRP',
  solana: 'SOL',
  tron: 'TRX',
  dogecoin: 'DOGE',
  monero: 'XMR',
  chainlink: 'LINK',
  cardano: 'ADA',
  stellar: 'XLM',
  'bitcoin-cash': 'BCH',
  litecoin: 'LTC',
  'hedera-hashgraph': 'HBAR',
  'avalanche-2': 'AVAX',
  sui: 'SUI',
  'shiba-inu': 'SHIB',
  near: 'NEAR',
  uniswap: 'UNI',
  polkadot: 'DOT',
};

const COIN_ID_BY_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_BY_COIN_ID).map(([coinId, symbol]) => [symbol, coinId]),
);

// Modelled on the documented v2 response. Optional wherever the documentation is thinner than
// the code needs, because guessing a required field would turn a working response into a parse
// failure — and §9.2a is explicit that this shape has never been checked against an
// authenticated reply.
const postSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().min(1),
  url: z.url().optional(),
  original_url: z.url().optional(),
  published_at: z.string().min(1),
  domain: z.string().optional(),
  source: z.object({ title: z.string().optional(), domain: z.string().optional() }).optional(),
  currencies: z.array(z.object({ code: z.string() })).optional(),
});

const postsResponseSchema = z.object({ results: z.array(postSchema) });

function toArticle(post: z.infer<typeof postSchema>): NewsArticle | undefined {
  const url = post.url ?? post.original_url;

  if (url === undefined) {
    return undefined;
  }

  const assets = (post.currencies ?? [])
    .map((currency) => COIN_ID_BY_SYMBOL[currency.code.toUpperCase()])
    .filter((coinId): coinId is string => coinId !== undefined);

  return {
    itemRef: `${PROVIDER_NAME}:${String(post.id)}`,
    title: post.title,
    url,
    source: post.source?.title ?? post.domain ?? 'CryptoPanic',
    publishedAt: post.published_at,
    assets,
  };
}

export const cryptopanicProvider: NewsProvider = {
  name: PROVIDER_NAME,

  async fetchArticles(assets: string[]): Promise<NewsArticle[]> {
    const url = new URL(POSTS_URL);
    // Sent even when empty. No token was obtained, so this 401s — which is the point: the
    // fallback in news.service.ts is the path that actually runs, and it runs continuously
    // rather than sitting untested (§9.2a).
    url.searchParams.set('auth_token', env.CRYPTOPANIC_TOKEN ?? '');
    url.searchParams.set('public', 'true');

    const symbols = assets
      .map((coinId) => SYMBOL_BY_COIN_ID[coinId])
      .filter((symbol): symbol is string => symbol !== undefined);

    if (symbols.length > 0) {
      url.searchParams.set('currencies', symbols.join(','));
    }

    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 429) {
      throw new AppError('UPSTREAM_RATE_LIMITED', 'CryptoPanic is rate-limiting requests.');
    }

    if (!response.ok) {
      throw new AppError('UPSTREAM_ERROR', `CryptoPanic responded with ${response.status}.`);
    }

    const payload: unknown = await response.json();
    const parsed = postsResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AppError(
        'UPSTREAM_ERROR',
        'CryptoPanic returned a response in an unexpected shape.',
      );
    }

    return parsed.data.results
      .map(toArticle)
      .filter((article): article is NewsArticle => article !== undefined);
  },
};
