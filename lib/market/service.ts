import { addSeconds, isAfter, subSeconds } from "date-fns";
import { prisma } from "@/lib/prisma";
import { normalizeTicker } from "@/lib/utils";
import { demoMarketProvider } from "./demo";
import { finnhubProvider } from "./finnhub";
import { polygonProvider } from "./polygon";
import { MarketDataError } from "./types";
import type { ChartPoint, MarketProvider, MarketProviderOptions, MarketSnapshot, NewsItem, StockProfile, StockSplit, TickerSearchResult } from "./types";

function positiveSeconds(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const quoteCacheSeconds = positiveSeconds(process.env.MARKET_CACHE_SECONDS, 1800);
const newsCacheSeconds = positiveSeconds(process.env.MARKET_NEWS_CACHE_SECONDS, 21600);
const searchCacheSeconds = positiveSeconds(process.env.MARKET_SEARCH_CACHE_SECONDS, 86400);
const splitCacheSeconds = positiveSeconds(process.env.MARKET_SPLIT_CACHE_SECONDS, 86400);

type SearchCacheEntry = {
  results: TickerSearchResult[];
  updatedAt: number;
};

declare global {
  var marketSearchCache: Map<string, SearchCacheEntry> | undefined;
  var marketSearchRequests: Map<string, Promise<TickerSearchResult[]>> | undefined;
}

// Keep search metadata across requests and Next.js development reloads.
const searchCache = globalThis.marketSearchCache ?? new Map<string, SearchCacheEntry>();
const searchRequests = globalThis.marketSearchRequests ?? new Map<string, Promise<TickerSearchResult[]>>();
globalThis.marketSearchCache = searchCache;
globalThis.marketSearchRequests = searchRequests;

function provider(): MarketProvider {
  if (process.env.MARKET_PROVIDER === "demo") return demoMarketProvider;
  if (process.env.MARKET_PROVIDER === "finnhub") return finnhubProvider;
  return polygonProvider;
}

function parseJson<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function isFresh(date: Date | null | undefined, seconds: number) {
  if (!date) return false;
  return isAfter(addSeconds(date, seconds), new Date());
}

export async function getMarketSnapshot(
  tickerInput: string,
  options: MarketProviderOptions & { force?: boolean } = {}
): Promise<MarketSnapshot> {
  const ticker = normalizeTicker(tickerInput);
  const cache = await prisma.stockCache.findUnique({ where: { ticker } });
  const needsQuote = options.force || !cache || !isFresh(cache.quoteUpdatedAt, quoteCacheSeconds);
  const needsNews =
    options.includeNews &&
    (options.force || !cache?.newsJson || !isFresh(cache.newsUpdatedAt, newsCacheSeconds));
  const needsChart = options.includeChart && (options.force || !cache?.chartJson);

  if (!needsQuote && !needsNews && !needsChart && cache?.currentPrice) {
    return {
      ticker,
      companyName: cache.companyName ?? undefined,
      currentPrice: cache.currentPrice,
      previousClose: cache.previousClose ?? undefined,
      dailyChange: cache.dailyChange ?? 0,
      dailyPercent: cache.dailyPercent ?? 0,
      marketTime: cache.marketTime?.toISOString(),
      cachedAt: cache.quoteUpdatedAt?.toISOString(),
      profile: parseJson<StockProfile>(cache.profileJson),
      chart: parseJson<ChartPoint[]>(cache.chartJson),
      news: parseJson<NewsItem[]>(cache.newsJson)
    };
  }

  let snapshot: MarketSnapshot;
  try {
    snapshot = await provider().getSnapshot(ticker, {
      includeChart: options.includeChart,
      includeNews: options.includeNews,
      includeProfile: !cache?.profileJson
    });
  } catch (error) {
    if (cache?.currentPrice && !options.force) {
      return {
        ticker,
        companyName: cache.companyName ?? undefined,
        currentPrice: cache.currentPrice,
        previousClose: cache.previousClose ?? undefined,
        dailyChange: cache.dailyChange ?? 0,
        dailyPercent: cache.dailyPercent ?? 0,
        marketTime: cache.marketTime?.toISOString(),
        cachedAt: cache.quoteUpdatedAt?.toISOString(),
        profile: parseJson<StockProfile>(cache.profileJson),
        chart: parseJson<ChartPoint[]>(cache.chartJson),
        news: parseJson<NewsItem[]>(cache.newsJson)
      };
    }
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError("api_error", "Unable to fetch market data right now. Please try again.");
  }

  const nextChart = snapshot.chart ?? parseJson<ChartPoint[]>(cache?.chartJson);
  const nextNews = snapshot.news ?? parseJson<NewsItem[]>(cache?.newsJson);
  const nextProfile = snapshot.profile ?? parseJson<StockProfile>(cache?.profileJson);
  const nextCompanyName = snapshot.companyName ?? cache?.companyName ?? ticker;
  const fetchedAt = new Date();

  await prisma.stockCache.upsert({
    where: { ticker },
    create: {
      ticker,
      companyName: nextCompanyName,
      currentPrice: snapshot.currentPrice,
      previousClose: snapshot.previousClose,
      dailyChange: snapshot.dailyChange,
      dailyPercent: snapshot.dailyPercent,
      marketTime: snapshot.marketTime ? new Date(snapshot.marketTime) : new Date(),
      profileJson: nextProfile ? JSON.stringify(nextProfile) : undefined,
      chartJson: nextChart ? JSON.stringify(nextChart) : undefined,
      newsJson: nextNews ? JSON.stringify(nextNews) : undefined,
      quoteUpdatedAt: fetchedAt,
      newsUpdatedAt: snapshot.news ? fetchedAt : cache?.newsUpdatedAt
    },
    update: {
      companyName: nextCompanyName,
      currentPrice: snapshot.currentPrice,
      previousClose: snapshot.previousClose,
      dailyChange: snapshot.dailyChange,
      dailyPercent: snapshot.dailyPercent,
      marketTime: snapshot.marketTime ? new Date(snapshot.marketTime) : new Date(),
      profileJson: nextProfile ? JSON.stringify(nextProfile) : undefined,
      chartJson: nextChart ? JSON.stringify(nextChart) : undefined,
      newsJson: nextNews ? JSON.stringify(nextNews) : undefined,
      quoteUpdatedAt: fetchedAt,
      newsUpdatedAt: snapshot.news ? fetchedAt : cache?.newsUpdatedAt
    }
  });

  return {
    ...snapshot,
    companyName: nextCompanyName,
    cachedAt: fetchedAt.toISOString(),
    profile: nextProfile,
    chart: nextChart,
    news: nextNews
  };
}

export async function refreshTickers(tickers: string[]) {
  const uniqueTickers = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  const snapshots: MarketSnapshot[] = [];

  // Polygon Basic does not provide a batch quote endpoint. Run each aggregate
  // request in sequence so a refresh does not create an avoidable burst.
  for (const ticker of uniqueTickers) {
    snapshots.push(await getMarketSnapshot(ticker, { includeChart: true, force: true }));
  }

  return snapshots;
}

export async function searchTickers(query: string, limit = 8): Promise<TickerSearchResult[]> {
  const cleanQuery = query.trim().replace(/\s+/g, " ");
  if (cleanQuery.length < 2) return [];

  const activeProvider = provider();
  if (!activeProvider.searchTickers) return [];

  const cacheKey = `${activeProvider.name}:${cleanQuery.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt < searchCacheSeconds * 1000) {
    return cached.results.slice(0, limit);
  }

  const pending = searchRequests.get(cacheKey);
  if (pending) return (await pending).slice(0, limit);

  const normalizedQuery = cleanQuery.toLowerCase();
  const reusable = [...searchCache.entries()]
    .filter(([key, entry]) =>
      key.startsWith(`${activeProvider.name}:`) &&
      normalizedQuery.startsWith(key.slice(activeProvider.name.length + 1)) &&
      Date.now() - entry.updatedAt < searchCacheSeconds * 1000
    )
    .sort(([left], [right]) => right.length - left.length)
    .map(([, entry]) => entry.results.filter((result) => {
      const searchable = `${result.ticker} ${result.name}`.toLowerCase();
      return normalizedQuery.split(/\s+/).every((term) => searchable.includes(term));
    }))
    .find((results) => results.length > 0);

  if (reusable) return reusable.slice(0, limit);

  const request = activeProvider
    .searchTickers(cleanQuery, Math.max(limit, 50))
    .then((results) => {
      searchCache.set(cacheKey, { results, updatedAt: Date.now() });
      return results;
    })
    .catch((error) => {
      // A stale match is still useful during a brief provider outage or rate limit.
      if (cached) return cached.results;
      throw error;
    })
    .finally(() => searchRequests.delete(cacheKey));

  searchRequests.set(cacheKey, request);
  return (await request).slice(0, limit);
}

export async function getHistoricalPrice(tickerInput: string, date: Date) {
  const ticker = normalizeTicker(tickerInput);
  const activeProvider = provider();

  if (!activeProvider.getHistoricalPrice) {
    throw new MarketDataError("api_error", "Historical purchase prices are not available for this market data provider.");
  }

  return activeProvider.getHistoricalPrice(ticker, date);
}

export async function getStockSplits(tickerInput: string, from?: Date): Promise<StockSplit[]> {
  const ticker = normalizeTicker(tickerInput);
  const activeProvider = provider();
  if (!activeProvider.getSplits) return [];

  const cache = await prisma.stockCache.findUnique({ where: { ticker } });
  let splits = parseJson<StockSplit[]>(cache?.splitsJson);

  if (!splits || !isFresh(cache?.splitsUpdatedAt, splitCacheSeconds)) {
    splits = await activeProvider.getSplits(ticker);
    const now = new Date();
    await prisma.stockCache.upsert({
      where: { ticker },
      create: {
        ticker,
        splitsJson: JSON.stringify(splits),
        splitsUpdatedAt: now
      },
      update: {
        splitsJson: JSON.stringify(splits),
        splitsUpdatedAt: now
      }
    });
  }

  const fromDate = from?.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return splits.filter(
    (split) => (!fromDate || split.executionDate > fromDate) && split.executionDate <= today
  );
}

export function cacheWindowStartedAt() {
  return subSeconds(new Date(), quoteCacheSeconds);
}

export function marketErrorMessage(error: unknown) {
  if (error instanceof MarketDataError) return error.message;
  return "Unable to fetch market data right now. Please try again.";
}

export function marketErrorStatus(error: unknown) {
  if (!(error instanceof MarketDataError)) return 503;
  if (error.code === "invalid_ticker") return 400;
  if (error.code === "rate_limited") return 429;
  return 503;
}
