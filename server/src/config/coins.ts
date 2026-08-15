// The curated asset allowlist. Shared rather than owned by any one module: preferences
// validates against it, the prices service fetches it in one batch and keys its cache
// `price:{coinId}`, and PRICES feedback rows reference the same id (§4.3). One identifier,
// four uses, no coin metadata copied anywhere.
//
// Every id was read from CoinGecko's own /coins/list and /coins/markets, never written from
// memory. A wrong id is not an error upstream — it is silently absent from the response — so
// a guess would have surfaced as a missing row in the prices section, not as a failure here.
export const COIN_ALLOWLIST = [
  'bitcoin',
  'ethereum',
  'binancecoin',
  'ripple',
  'solana',
  'cardano',
  'dogecoin',
  'tron',
  'chainlink',
  'avalanche-2',
  'polkadot',
  'litecoin',
  'bitcoin-cash',
  'stellar',
  'monero',
  'uniswap',
  'near',
  'sui',
  'hedera-hashgraph',
  'shiba-inu',
] as const;
