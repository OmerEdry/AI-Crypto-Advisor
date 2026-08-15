// The seam §5 and §9.2a are about. `news.service.ts` depends on this shape, never on a vendor,
// which is why supplying a CryptoPanic token later is an environment variable rather than a
// code change — and why the fallback is exercised on every request instead of being an untested
// branch.
export interface NewsArticle {
  // {provider}:{providerId} per §4.3 — the prefix stops two providers colliding on the same id
  // and makes the origin of a stored vote readable at a glance.
  itemRef: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  // Allowlisted CoinGecko coin ids, the same identifier used everywhere else (§17).
  assets: string[];
}

export interface NewsProvider {
  readonly name: string;
  fetchArticles(assets: string[]): Promise<NewsArticle[]>;
}
