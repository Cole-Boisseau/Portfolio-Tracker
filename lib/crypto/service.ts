import { addSeconds, isAfter } from "date-fns";
import { normalizeCryptoId } from "@/lib/assets";
import { prisma } from "@/lib/prisma";
import { MarketDataError } from "@/lib/market/types";
import type { ChartPoint, MarketSnapshot, StockProfile, TickerSearchResult } from "@/lib/market/types";
import { coinGeckoProvider } from "./coingecko";
import type { CryptoProvider } from "./types";

function positiveSeconds(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const quoteCacheSeconds = positiveSeconds(process.env.CRYPTO_CACHE_SECONDS ?? process.env.MARKET_CACHE_SECONDS, 1800);
const chartCacheSeconds = positiveSeconds(process.env.CRYPTO_CHART_CACHE_SECONDS, 21600);
const searchCacheSeconds = positiveSeconds(process.env.CRYPTO_SEARCH_CACHE_SECONDS, 86400);

type SearchCacheEntry = { results: TickerSearchResult[]; updatedAt: number };

declare global {
  var cryptoSearchCache: Map<string, SearchCacheEntry> | undefined;
  var cryptoSearchRequests: Map<string, Promise<TickerSearchResult[]>> | undefined;
}

const searchCache = globalThis.cryptoSearchCache ?? new Map<string, SearchCacheEntry>();
const searchRequests = globalThis.cryptoSearchRequests ?? new Map<string, Promise<TickerSearchResult[]>>();
globalThis.cryptoSearchCache = searchCache;
globalThis.cryptoSearchRequests = searchRequests;

function provider(): CryptoProvider {
  return coinGeckoProvider;
}

function isFresh(date: Date | null | undefined, seconds: number) {
  return Boolean(date && isAfter(addSeconds(date, seconds), new Date()));
}

function parseJson<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

type CachedCrypto = Awaited<ReturnType<typeof prisma.cryptoCache.findUnique>>;

function cachedSnapshot(cache: CachedCrypto | undefined): MarketSnapshot | undefined {
  if (!cache || cache.currentPrice === null) return undefined;
  return {
    assetType: "crypto",
    assetId: cache.id,
    ticker: cache.ticker,
    companyName: cache.companyName,
    currentPrice: cache.currentPrice,
    previousClose: cache.previousClose ?? undefined,
    dailyChange: cache.dailyChange ?? 0,
    dailyPercent: cache.dailyPercent ?? 0,
    marketTime: cache.marketTime?.toISOString(),
    cachedAt: cache.quoteUpdatedAt?.toISOString(),
    image: cache.imageUrl ?? undefined,
    profile: parseJson<StockProfile>(cache.profileJson),
    chart: parseJson<ChartPoint[]>(cache.chartJson)
  };
}

export async function getCryptoSnapshots(
  assetIdInputs: string[],
  options: { includeChart?: boolean; force?: boolean } = {}
) {
  const assetIds = [...new Set(assetIdInputs.map(normalizeCryptoId).filter(Boolean))];
  if (!assetIds.length) return [];

  const cachedRows = await prisma.cryptoCache.findMany({ where: { id: { in: assetIds } } });
  const cacheById = new Map(cachedRows.map((row) => [row.id, row]));
  const quoteIds = assetIds.filter((id) => {
    const cache = cacheById.get(id);
    return options.force || !cache?.currentPrice || !isFresh(cache.quoteUpdatedAt, quoteCacheSeconds);
  });
  const fetchedById = new Map<string, MarketSnapshot>();

  if (quoteIds.length) {
    try {
      const fetched = await provider().getSnapshots(quoteIds);
      fetched.forEach((snapshot) => fetchedById.set(snapshot.assetId ?? "", snapshot));
    } catch (error) {
      if (options.force) throw error;
      const hasUncachedAsset = quoteIds.some((id) => !cachedSnapshot(cacheById.get(id)));
      if (hasUncachedAsset) throw error;
    }
  }

  for (const id of quoteIds) {
    if (!fetchedById.has(id) && !cachedSnapshot(cacheById.get(id))) {
      throw new MarketDataError("invalid_ticker", "That cryptocurrency could not be found.");
    }
  }

  const chartById = new Map<string, ChartPoint[]>();
  if (options.includeChart) {
    const chartIds = assetIds.filter((id) => {
      const cache = cacheById.get(id);
      return !cache?.chartJson || !isFresh(cache.chartUpdatedAt, chartCacheSeconds);
    });
    await Promise.all(
      chartIds.map(async (id) => {
        try {
          chartById.set(id, await provider().getChart(id));
        } catch {
          // A missing chart should not hide an otherwise useful cached/live quote.
        }
      })
    );
  }

  const now = new Date();
  const snapshots = await Promise.all(
    assetIds.map(async (id) => {
      const cache = cacheById.get(id);
      const fetched = fetchedById.get(id);
      const fallback = cache ? cachedSnapshot(cache) : undefined;
      const snapshot = fetched ?? fallback;
      if (!snapshot) throw new MarketDataError("invalid_ticker", "That cryptocurrency could not be found.");

      const chart = chartById.get(id) ?? snapshot.chart ?? parseJson<ChartPoint[]>(cache?.chartJson);
      const profile = snapshot.profile ?? parseJson<StockProfile>(cache?.profileJson);
      const complete = {
        ...snapshot,
        chart,
        profile,
        cachedAt: fetched ? now.toISOString() : snapshot.cachedAt
      };

      if (fetched || chartById.has(id)) {
        await prisma.cryptoCache.upsert({
          where: { id },
          create: {
            id,
            ticker: complete.ticker,
            companyName: complete.companyName ?? complete.ticker,
            imageUrl: complete.image,
            currentPrice: complete.currentPrice,
            previousClose: complete.previousClose,
            dailyChange: complete.dailyChange,
            dailyPercent: complete.dailyPercent,
            marketTime: complete.marketTime ? new Date(complete.marketTime) : now,
            profileJson: profile ? JSON.stringify(profile) : undefined,
            chartJson: chart ? JSON.stringify(chart) : undefined,
            quoteUpdatedAt: fetched ? now : cache?.quoteUpdatedAt,
            chartUpdatedAt: chartById.has(id) ? now : cache?.chartUpdatedAt
          },
          update: {
            ticker: complete.ticker,
            companyName: complete.companyName ?? complete.ticker,
            imageUrl: complete.image,
            currentPrice: complete.currentPrice,
            previousClose: complete.previousClose,
            dailyChange: complete.dailyChange,
            dailyPercent: complete.dailyPercent,
            marketTime: complete.marketTime ? new Date(complete.marketTime) : now,
            profileJson: profile ? JSON.stringify(profile) : undefined,
            chartJson: chart ? JSON.stringify(chart) : undefined,
            ...(fetched ? { quoteUpdatedAt: now } : {}),
            ...(chartById.has(id) ? { chartUpdatedAt: now } : {})
          }
        });
      }

      return complete;
    })
  );

  return snapshots;
}

export async function getCryptoSnapshot(
  assetId: string,
  options: { includeChart?: boolean; force?: boolean } = {}
) {
  const [snapshot] = await getCryptoSnapshots([assetId], options);
  return snapshot;
}

export async function refreshCryptoAssets(assetIds: string[]) {
  return getCryptoSnapshots(assetIds, { includeChart: true, force: true });
}

export async function searchCryptoAssets(query: string, limit = 8) {
  const cleanQuery = query.trim().replace(/\s+/g, " ");
  if (cleanQuery.length < 2) return [];

  const cacheKey = `${provider().name}:${cleanQuery.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt < searchCacheSeconds * 1000) {
    return cached.results.slice(0, limit);
  }

  const pending = searchRequests.get(cacheKey);
  if (pending) return (await pending).slice(0, limit);

  const request = provider()
    .searchAssets(cleanQuery, Math.max(limit, 8))
    .then((results) => {
      searchCache.set(cacheKey, { results, updatedAt: Date.now() });
      return results;
    })
    .catch((error) => {
      if (cached) return cached.results;
      throw error;
    })
    .finally(() => searchRequests.delete(cacheKey));

  searchRequests.set(cacheKey, request);
  return (await request).slice(0, limit);
}

export async function getCryptoHistoricalPrice(assetId: string, date: Date) {
  return provider().getHistoricalPrice(normalizeCryptoId(assetId), date);
}
