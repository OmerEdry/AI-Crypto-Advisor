// Display labels for the server's allowlist. The **id** is the contract and stays
// server-authoritative: PUT /api/preferences validates every one against
// server/src/config/coins.ts and rejects anything not on it. The name and symbol are labels —
// if they drift from CoinGecko's, a user sees a stale word, nothing fails and nothing wrong is
// stored. Ids copied verbatim rather than typed from memory; §17 records that `ripple`,
// `avalanche-2` and `hedera-hashgraph` would all have been guessed wrong.
//
// The alternative was carrying names in config/coins.ts behind a GET /api/coins — strictly more
// correct, and four more files plus a loading and an error state inside a wizard that otherwise
// touches the network exactly once. Declined on time, not on merit.
export interface CoinOption {
  id: string;
  name: string;
  symbol: string;
}

export const COIN_OPTIONS: CoinOption[] = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
  { id: 'ripple', name: 'XRP', symbol: 'XRP' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
  { id: 'tron', name: 'TRON', symbol: 'TRX' },
  { id: 'chainlink', name: 'Chainlink', symbol: 'LINK' },
  { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX' },
  { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
  { id: 'litecoin', name: 'Litecoin', symbol: 'LTC' },
  { id: 'bitcoin-cash', name: 'Bitcoin Cash', symbol: 'BCH' },
  { id: 'stellar', name: 'Stellar', symbol: 'XLM' },
  { id: 'monero', name: 'Monero', symbol: 'XMR' },
  { id: 'uniswap', name: 'Uniswap', symbol: 'UNI' },
  { id: 'near', name: 'NEAR Protocol', symbol: 'NEAR' },
  { id: 'sui', name: 'Sui', symbol: 'SUI' },
  { id: 'hedera-hashgraph', name: 'Hedera', symbol: 'HBAR' },
  { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB' },
];
