import { z } from 'zod';
import { COIN_ALLOWLIST } from '../../../config/coins';
import articles from '../data/news-articles.json';
import type { NewsArticle, NewsProvider } from './news.provider';

const PROVIDER_NAME = 'static';

// Parsed once at module load rather than per request. A mistyped coin id in the curated file
// would otherwise never match anyone's watchlist and would look like a filtering bug; here it
// refuses to start the process, which is the same fail-fast bargain as config/env.ts.
const curatedArticleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  source: z.string().min(1),
  publishedAt: z.iso.date(),
  assets: z.array(z.enum(COIN_ALLOWLIST)).min(1),
});

const curated: NewsArticle[] = z
  .array(curatedArticleSchema)
  .min(1)
  .parse(articles)
  .map((article) => ({
    itemRef: `${PROVIDER_NAME}:${article.id}`,
    title: article.title,
    url: article.url,
    source: article.source,
    publishedAt: article.publishedAt,
    assets: article.assets,
  }));

// §9.2a: this is the production news source, not a placeholder. Every entry is a real article
// from a real publisher, each URL fetched and its headline and date confirmed at curation time.
export const staticNewsProvider: NewsProvider = {
  name: PROVIDER_NAME,

  fetchArticles(assets: string[]): Promise<NewsArticle[]> {
    const wanted = new Set(assets);

    const matching = curated
      .filter((article) => article.assets.some((asset) => wanted.has(asset)))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

    // Not async in substance — the interface is async because the other implementation is.
    return Promise.resolve(matching);
  },
};
