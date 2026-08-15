import { apiRequest } from '../../lib/api-client';
import {
  asArray,
  asNullableNumber,
  asNumber,
  asOptionalString,
  asRecord,
  asStatus,
  asString,
  asStringArray,
  shapeError,
} from '../../lib/parse';
import type {
  ContentType,
  InsightResponse,
  InvestorType,
  MemeResponse,
  NewsResponse,
  Preferences,
  PricesResponse,
} from '../../types/api';

const INVESTOR_TYPES: InvestorType[] = ['HODLER', 'DAY_TRADER', 'NFT_COLLECTOR'];
const CONTENT_TYPES: ContentType[] = ['MARKET_NEWS', 'CHARTS', 'SOCIAL', 'FUN'];

// The enums are checked rather than assumed: `contentTypes` decides the order of this entire
// page, so a value the client does not know about must fail loudly instead of silently ranking
// as nothing.
function asInvestorType(value: unknown, endpoint: string): InvestorType {
  const parsed = INVESTOR_TYPES.find((type) => type === value);

  if (parsed === undefined) {
    throw shapeError(endpoint);
  }

  return parsed;
}

function asContentTypes(value: unknown, endpoint: string): ContentType[] {
  return asArray(value, endpoint).map((entry) => {
    const parsed = CONTENT_TYPES.find((type) => type === entry);

    if (parsed === undefined) {
      throw shapeError(endpoint);
    }

    return parsed;
  });
}

export async function fetchPreferences(): Promise<Preferences> {
  const endpoint = '/preferences';
  const payload = asRecord(await apiRequest('/preferences'), endpoint);
  const preferences = asRecord(payload.preferences, endpoint);

  return {
    assets: asStringArray(preferences.assets, endpoint),
    investorType: asInvestorType(preferences.investorType, endpoint),
    contentTypes: asContentTypes(preferences.contentTypes, endpoint),
    updatedAt: asString(preferences.updatedAt, endpoint),
  };
}

export async function fetchPrices(): Promise<PricesResponse> {
  const endpoint = '/market/prices';
  const payload = asRecord(await apiRequest('/market/prices'), endpoint);
  const cachedAt = payload.cachedAt;

  return {
    status: asStatus(payload.status, endpoint),
    coins: asArray(payload.coins, endpoint).map((entry) => {
      const coin = asRecord(entry, endpoint);

      return {
        id: asString(coin.id, endpoint),
        symbol: asString(coin.symbol, endpoint),
        name: asString(coin.name, endpoint),
        image: asString(coin.image, endpoint),
        price: asNumber(coin.price, endpoint),
        change24h: asNullableNumber(coin.change24h, endpoint),
        change30d: asNullableNumber(coin.change30d, endpoint),
      };
    }),
    cachedAt: cachedAt === null ? null : asString(cachedAt, endpoint),
    ...optionalNotice(payload.notice, endpoint),
  };
}

export async function fetchNews(): Promise<NewsResponse> {
  const endpoint = '/market/news';
  const payload = asRecord(await apiRequest('/market/news'), endpoint);

  return {
    status: asStatus(payload.status, endpoint),
    articles: asArray(payload.articles, endpoint).map((entry) => {
      const article = asRecord(entry, endpoint);

      return {
        itemRef: asString(article.itemRef, endpoint),
        title: asString(article.title, endpoint),
        url: asString(article.url, endpoint),
        source: asString(article.source, endpoint),
        publishedAt: asString(article.publishedAt, endpoint),
        assets: asStringArray(article.assets, endpoint),
      };
    }),
    provider: asString(payload.provider, endpoint),
    cachedAt: asString(payload.cachedAt, endpoint),
    ...optionalNotice(payload.notice, endpoint),
  };
}

export async function fetchInsight(): Promise<InsightResponse> {
  const endpoint = '/insight/today';
  const payload = asRecord(await apiRequest('/insight/today'), endpoint);
  const insight = asRecord(payload.insight, endpoint);

  return {
    status: asStatus(payload.status, endpoint),
    insight: {
      id: asString(insight.id, endpoint),
      content: asString(insight.content, endpoint),
      forDate: asString(insight.forDate, endpoint),
    },
    ...optionalNotice(payload.notice, endpoint),
  };
}

// NF2: the meme changes on every dashboard update, so `exclude` is what stops the same image
// coming back twice in a row.
export async function fetchMeme(exclude?: string): Promise<MemeResponse> {
  const endpoint = '/memes/random';
  const path =
    exclude === undefined
      ? '/memes/random'
      : `/memes/random?exclude=${encodeURIComponent(exclude)}`;
  const payload = asRecord(await apiRequest(path), endpoint);
  const meme = asRecord(payload.meme, endpoint);

  return {
    status: asStatus(payload.status, endpoint),
    meme: {
      id: asString(meme.id, endpoint),
      title: asString(meme.title, endpoint),
      imageUrl: asString(meme.imageUrl, endpoint),
    },
  };
}

// `notice` is present only when status is not ok, and exactOptionalPropertyTypes means an
// explicit `notice: undefined` is not the same as an absent key — so it is spread in or not at
// all.
function optionalNotice(value: unknown, endpoint: string): { notice?: string } {
  const notice = asOptionalString(value, endpoint);

  return notice === undefined ? {} : { notice };
}
