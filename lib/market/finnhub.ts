import { subDays } from "date-fns";
import type { ChartPoint, MarketProvider, MarketSnapshot, NewsItem, StockProfile } from "./types";
import { MarketDataError } from "./types";

type FinnhubQuote = {
  c?: number;
  d?: number;
  dp?: number;
  pc?: number;
  t?: number;
};

type FinnhubProfile = {
  name?: string;
  exchange?: string;
  finnhubIndustry?: string;
  logo?: string;
  weburl?: string;
  country?: string;
  currency?: string;
};

type FinnhubCandle = {
  s?: string;
  t?: number[];
  c?: number[];
};

type FinnhubNews = {
  id?: number;
  datetime?: number;
  headline?: string;
  source?: string;
  summary?: string;
  url?: string;
  image?: string;
};

const BASE_URL = "https://finnhub.io/api/v1";

async function finnhubFetch<T>(path: string, params: Record<string, string | number>) {
  const token = process.env.FINNHUB_API_KEY?.trim();
  if (!token) {
    throw new MarketDataError("missing_api_key", "Finnhub API key is missing. Add FINNHUB_API_KEY to your .env file.");
  }

  const url = new URL(`${BASE_URL}${path}`);
  Object.entries({ ...params, token }).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  let response: Response;
  try {
    response = await fetch(url, { next: { revalidate: 0 } });
  } catch {
    throw new MarketDataError("network", "Unable to reach Finnhub right now. Check your connection and try again.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new MarketDataError("missing_api_key", "Finnhub rejected the API key. Check FINNHUB_API_KEY in your .env file.", response.status);
  }
  if (response.status === 404) {
    throw new MarketDataError("invalid_ticker", "That ticker symbol was not found.", response.status);
  }
  if (response.status === 429) {
    throw new MarketDataError("rate_limited", "Finnhub's rate limit was reached. Wait a bit, then refresh prices again.", response.status);
  }
  if (!response.ok) {
    throw new MarketDataError("api_error", `Finnhub request failed with status ${response.status}.`, response.status);
  }
  return (await response.json()) as T;
}

function mapProfile(profile: FinnhubProfile): StockProfile {
  return {
    name: profile.name,
    exchange: profile.exchange,
    industry: profile.finnhubIndustry,
    logo: profile.logo,
    weburl: profile.weburl,
    country: profile.country,
    currency: profile.currency
  };
}

function mapChart(candle: FinnhubCandle): ChartPoint[] | undefined {
  if (candle.s !== "ok" || !candle.t?.length || !candle.c?.length) return undefined;
  return candle.t.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    price: Number((candle.c?.[index] ?? 0).toFixed(2))
  }));
}

function mapNews(items: FinnhubNews[]): NewsItem[] {
  return items.slice(0, 8).map((item, index) => ({
    id: String(item.id ?? `${item.datetime}-${index}`),
    datetime: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
    headline: item.headline ?? "Market update",
    source: item.source ?? "Finnhub",
    summary: item.summary,
    url: item.url,
    image: item.image
  }));
}

export const finnhubProvider: MarketProvider = {
  name: "Finnhub",
  async getSnapshot(ticker, options): Promise<MarketSnapshot> {
    const [quote, profile, candle, news] = await Promise.all([
      finnhubFetch<FinnhubQuote>("/quote", { symbol: ticker }),
      options?.includeProfile === false
        ? Promise.resolve(undefined)
        : finnhubFetch<FinnhubProfile>("/stock/profile2", { symbol: ticker }).catch(() => undefined),
      options?.includeChart
        ? finnhubFetch<FinnhubCandle>("/stock/candle", {
            symbol: ticker,
            resolution: "D",
            from: Math.floor(subDays(new Date(), 370).getTime() / 1000),
            to: Math.floor(Date.now() / 1000)
          }).catch(() => undefined)
        : Promise.resolve(undefined),
      options?.includeNews
        ? finnhubFetch<FinnhubNews[]>("/company-news", {
            symbol: ticker,
            from: subDays(new Date(), 14).toISOString().slice(0, 10),
            to: new Date().toISOString().slice(0, 10)
          }).catch(() => [])
        : Promise.resolve([])
    ]);

    if (typeof quote.c !== "number" || quote.c <= 0) {
      throw new MarketDataError("invalid_ticker", `Finnhub returned no current price for ${ticker}.`);
    }

    return {
      ticker,
      companyName: profile?.name,
      currentPrice: quote.c,
      previousClose: quote.pc,
      dailyChange: quote.d ?? quote.c - (quote.pc ?? quote.c),
      dailyPercent: quote.dp ?? 0,
      marketTime: quote.t ? new Date(quote.t * 1000).toISOString() : new Date().toISOString(),
      profile: profile ? mapProfile(profile) : undefined,
      chart: candle ? mapChart(candle) : undefined,
      news: mapNews(news ?? [])
    };
  }
};
