import { normalizeCryptoId } from "@/lib/assets";
import { MarketDataError } from "@/lib/market/types";
import type { ChartPoint, MarketSnapshot, TickerSearchResult } from "@/lib/market/types";
import type { CryptoProvider } from "./types";

const baseUrl = "https://api.coingecko.com/api/v3";

type CoinGeckoSearchResponse = {
  coins?: Array<{
    id: string;
    name: string;
    symbol: string;
    market_cap_rank?: number | null;
    thumb?: string;
    large?: string;
  }>;
};

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number | null;
  market_cap?: number | null;
  market_cap_rank?: number | null;
  total_volume?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  price_change_24h?: number | null;
  price_change_percentage_24h?: number | null;
  last_updated?: string;
};

type CoinGeckoChart = {
  prices?: Array<[number, number]>;
};

type CoinGeckoHistory = {
  market_data?: {
    current_price?: { usd?: number };
  };
};

function apiKey() {
  const key = process.env.COINGECKO_API_KEY?.trim();
  if (!key) {
    throw new MarketDataError(
      "missing_api_key",
      "Crypto data needs a free CoinGecko Demo API key. Add COINGECKO_API_KEY to .env and restart the app."
    );
  }
  return key;
}

async function coinGeckoFetch<T>(path: string): Promise<T> {
  const key = apiKey();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: {
        accept: "application/json",
        "x-cg-demo-api-key": key
      },
      cache: "no-store"
    });
  } catch {
    throw new MarketDataError("network", "CoinGecko could not be reached. Check your connection and try again.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new MarketDataError(
      "missing_api_key",
      "CoinGecko rejected the API key. Check COINGECKO_API_KEY in .env and restart the app.",
      response.status
    );
  }
  if (response.status === 404) {
    throw new MarketDataError("invalid_ticker", "That cryptocurrency could not be found.", 404);
  }
  if (response.status === 429) {
    throw new MarketDataError(
      "rate_limited",
      "CoinGecko's free limit was reached. Cached prices will remain visible; try again shortly.",
      429
    );
  }
  if (!response.ok) {
    throw new MarketDataError("api_error", "CoinGecko is unavailable right now. Please try again.", response.status);
  }

  return response.json() as Promise<T>;
}

function marketSnapshot(coin: CoinGeckoMarket): MarketSnapshot {
  if (typeof coin.current_price !== "number") {
    throw new MarketDataError("invalid_ticker", `No USD price is available for ${coin.name}.`);
  }

  const dailyChange = coin.price_change_24h ?? 0;
  return {
    assetType: "crypto",
    assetId: coin.id,
    ticker: coin.symbol.toUpperCase(),
    companyName: coin.name,
    currentPrice: coin.current_price,
    previousClose: coin.current_price - dailyChange,
    dailyChange,
    dailyPercent: coin.price_change_percentage_24h ?? 0,
    marketTime: coin.last_updated ?? new Date().toISOString(),
    image: coin.image,
    profile: {
      name: coin.name,
      currency: "USD",
      image: coin.image,
      marketCapRank: coin.market_cap_rank ?? undefined,
      marketCap: coin.market_cap ?? undefined,
      high24h: coin.high_24h ?? undefined,
      low24h: coin.low_24h ?? undefined,
      totalVolume: coin.total_volume ?? undefined
    }
  };
}

async function searchAssets(query: string, limit = 8): Promise<TickerSearchResult[]> {
  const response = await coinGeckoFetch<CoinGeckoSearchResponse>(
    `/search?query=${encodeURIComponent(query.trim())}`
  );

  return (response.coins ?? []).slice(0, limit).map((coin) => ({
    assetType: "crypto",
    assetId: coin.id,
    ticker: coin.symbol.toUpperCase(),
    name: coin.name,
    type: "Crypto",
    market: coin.market_cap_rank ? `Rank #${coin.market_cap_rank}` : undefined,
    currency: "USD",
    image: coin.large ?? coin.thumb
  }));
}

async function getSnapshots(assetIds: string[]): Promise<MarketSnapshot[]> {
  const ids = [...new Set(assetIds.map(normalizeCryptoId).filter(Boolean))];
  if (!ids.length) return [];

  const snapshots: MarketSnapshot[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const query = new URLSearchParams({
      vs_currency: "usd",
      ids: chunk.join(","),
      price_change_percentage: "24h",
      sparkline: "false"
    });
    const markets = await coinGeckoFetch<CoinGeckoMarket[]>(`/coins/markets?${query.toString()}`);
    snapshots.push(...markets.map(marketSnapshot));
  }
  return snapshots;
}

async function getChart(assetIdInput: string): Promise<ChartPoint[]> {
  const assetId = normalizeCryptoId(assetIdInput);
  const query = new URLSearchParams({ vs_currency: "usd", days: "365", interval: "daily" });
  const response = await coinGeckoFetch<CoinGeckoChart>(
    `/coins/${encodeURIComponent(assetId)}/market_chart?${query.toString()}`
  );
  const points = response.prices ?? [];

  const byDate = new Map<string, ChartPoint>();
  points.forEach(([timestamp, price]) => {
    const date = new Date(timestamp).toISOString().slice(0, 10);
    byDate.set(date, { date, price });
  });
  return [...byDate.values()];
}

async function getHistoricalPrice(assetIdInput: string, date: Date) {
  const assetId = normalizeCryptoId(assetIdInput);
  const day = date.toISOString().slice(0, 10);
  const response = await coinGeckoFetch<CoinGeckoHistory>(
    `/coins/${encodeURIComponent(assetId)}/history?date=${day}&localization=false`
  );
  const price = response.market_data?.current_price?.usd;
  if (typeof price !== "number") {
    throw new MarketDataError(
      "api_error",
      "A purchase-date crypto price is not available. Enter your total invested amount instead."
    );
  }
  return price;
}

export const coinGeckoProvider: CryptoProvider = {
  name: "coingecko",
  searchAssets,
  getSnapshots,
  getChart,
  getHistoricalPrice
};
