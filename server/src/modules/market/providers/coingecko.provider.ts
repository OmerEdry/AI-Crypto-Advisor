import { z } from 'zod';
import { COIN_ALLOWLIST } from '../../../config/coins';
import { env } from '../../../config/env';
import { AppError } from '../../../errors/app-error';

const MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets';

// §9.3: 5s for a data provider. Without it a hanging upstream becomes a hanging request.
const TIMEOUT_MS = 5_000;

// The shape the dashboard consumes. Defined here because CoinGecko is the only implementation —
// CLAUDE.md §1 forbids an interface with one implementation, so there is nothing to hoist it into.
export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number | null;
  change30d: number | null;
}

// Only the seven fields we read. CoinGecko returns ~28 per coin; parsing the rest would couple us
// to a shape nothing depends on. Both change windows are nullable because a coin without enough
// history returns null, and the 30d field is optional because it exists only when the
// `price_change_percentage` parameter asks for it.
const marketCoinSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.url(),
  current_price: z.number(),
  price_change_percentage_24h: z.number().nullable(),
  price_change_percentage_30d_in_currency: z.number().nullable().optional(),
});

const marketsResponseSchema = z.array(marketCoinSchema);

function toCoinPrice(coin: z.infer<typeof marketCoinSchema>): CoinPrice {
  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image,
    price: coin.current_price,
    change24h: coin.price_change_percentage_24h,
    change30d: coin.price_change_percentage_30d_in_currency ?? null,
  };
}

// The whole allowlist in one request, so upstream volume scales with the number of coins rather
// than the number of users (§9.1). No try/catch here: the service boundary owns the single catch,
// and this function's job is to classify the failures it can name.
export async function fetchAllowlistPrices(): Promise<CoinPrice[]> {
  const url = new URL(MARKETS_URL);
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('ids', COIN_ALLOWLIST.join(','));
  // Asks for the 30d window alongside the default 24h one, so §8's HODLER emphasis needs no
  // second request at Step 15.
  url.searchParams.set('price_change_percentage', '24h,30d');

  const response = await fetch(url, {
    headers: {
      // Demo keys pair with api.coingecko.com; a Pro key uses a different host and header.
      'x-cg-demo-api-key': env.COINGECKO_API_KEY,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.status === 429) {
    throw new AppError(
      'UPSTREAM_RATE_LIMITED',
      'CoinGecko is rate-limiting requests from this key.',
    );
  }

  if (!response.ok) {
    throw new AppError('UPSTREAM_ERROR', `CoinGecko responded with ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const parsed = marketsResponseSchema.safeParse(payload);

  if (!parsed.success) {
    // An unrecognisable response is an upstream failure, not a partial success. Keeping the
    // parseable subset would risk quietly serving two coins out of twenty.
    throw new AppError('UPSTREAM_ERROR', 'CoinGecko returned a response in an unexpected shape.');
  }

  return parsed.data.map(toCoinPrice);
}
