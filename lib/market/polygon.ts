import { subDays } from "date-fns";
import type { ChartPoint, MarketProvider, MarketProviderOptions, MarketSnapshot, NewsItem, StockProfile, StockSplit, TickerSearchResult } from "./types";
import { MarketDataError } from "./types";

const BASE_URL = "https://api.polygon.io";
const useSnapshotEndpoint = process.env.POLYGON_USE_SNAPSHOT === "true";

type PolygonTickerDetails = {
  results?: {
    ticker?: string;
    name?: string;
    primary_exchange?: string;
    sic_description?: string;
    branding?: {
      logo_url?: string;
    };
    homepage_url?: string;
    locale?: string;
    currency_name?: string;
  };
};

type PolygonSnapshot = {
  ticker?: {
    ticker?: string;
    todaysChange?: number;
    todaysChangePerc?: number;
    updated?: number;
    day?: {
      c?: number;
    };
    prevDay?: {
      c?: number;
    };
  };
};

type PolygonAggs = {
  results?: Array<{
    t?: number;
    c?: number;
  }>;
};

type PolygonNews = {
  results?: Array<{
    id?: string;
    published_utc?: string;
    title?: string;
    publisher?: {
      name?: string;
    };
    description?: string;
    article_url?: string;
    image_url?: string;
  }>;
};

type PolygonTickerSearch = {
  results?: Array<{
    ticker?: string;
    name?: string;
    market?: string;
    locale?: string;
    primary_exchange?: string;
    type?: string;
    active?: boolean;
    currency_name?: string;
  }>;
};

type PolygonSplits = {
  results?: Array<{
    id?: string;
    ticker?: string;
    execution_date?: string;
    split_from?: number;
    split_to?: number;
  }>;
};

function apiKey() {
  const key = process.env.POLYGON_API_KEY;
  if (!key || key === "your_api_key_here") {
    throw new MarketDataError("missing_api_key", "Polygon API key is missing. Add POLYGON_API_KEY to your .env file.");
  }
  return key;
}

async function polygonFetch<T>(path: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries({ ...params, apiKey: apiKey() }).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  let response: Response;
  try {
    response = await fetch(url, { next: { revalidate: 0 } });
  } catch {
    throw new MarketDataError("network", "Unable to reach Polygon right now. Check your connection and try again.");
  }

  if (response.status === 401) {
    throw new MarketDataError("missing_api_key", "Polygon rejected the API key. Check POLYGON_API_KEY in your .env file.", response.status);
  }
  if (response.status === 403) {
    throw new MarketDataError("api_error", "This Polygon account does not allow that market-data endpoint.", response.status);
  }
  if (response.status === 404) {
    throw new MarketDataError("invalid_ticker", "That ticker symbol was not found.", response.status);
  }
  if (response.status === 429) {
    throw new MarketDataError("rate_limited", "Polygon rate limit reached. Wait a bit, then refresh prices again.", response.status);
  }
  if (!response.ok) {
    throw new MarketDataError("api_error", `Polygon request failed with status ${response.status}.`, response.status);
  }

  return (await response.json()) as T;
}

function mapProfile(details?: PolygonTickerDetails["results"]): StockProfile | undefined {
  if (!details) return undefined;
  return {
    name: details.name,
    exchange: details.primary_exchange,
    industry: details.sic_description,
    logo: details.branding?.logo_url,
    weburl: details.homepage_url,
    country: details.locale?.toUpperCase(),
    currency: details.currency_name?.toUpperCase()
  };
}

function mapChart(aggs?: PolygonAggs): ChartPoint[] | undefined {
  if (!aggs?.results?.length) return undefined;
  return aggs.results
    .filter((point) => point.t && typeof point.c === "number")
    .map((point) => ({
      date: new Date(point.t as number).toISOString().slice(0, 10),
      price: Number((point.c as number).toFixed(2))
    }));
}

function mapNews(news?: PolygonNews): NewsItem[] {
  return (
    news?.results?.slice(0, 8).map((item, index) => ({
      id: item.id ?? `${item.published_utc}-${index}`,
      datetime: item.published_utc ?? new Date().toISOString(),
      headline: item.title ?? "Market update",
      source: item.publisher?.name ?? "Polygon",
      summary: item.description,
      url: item.article_url,
      image: item.image_url
    })) ?? []
  );
}

function mapTickerSearch(search: PolygonTickerSearch): TickerSearchResult[] {
  return (
    search.results
      ?.filter((item) => item.ticker && item.name)
      .map((item) => ({
        ticker: item.ticker as string,
        name: item.name as string,
        type: item.type,
        exchange: item.primary_exchange,
        market: item.market,
        currency: item.currency_name?.toUpperCase()
      })) ?? []
  );
}

function searchVariants(query: string) {
  const variants = [query];
  if (/\btechnology\b/i.test(query) && !/\binformation technology\b/i.test(query)) {
    variants.push(query.replace(/\btechnology\b/gi, "information technology"));
  }
  return [...new Set(variants)];
}

function mapSnapshot(ticker: string, snapshot: PolygonSnapshot, profile?: StockProfile, chart?: ChartPoint[], news?: NewsItem[]): MarketSnapshot {
  const item = snapshot.ticker;
  const currentPrice = item?.day?.c ?? item?.prevDay?.c;
  const previousClose = item?.prevDay?.c;
  if (!item || typeof currentPrice !== "number") {
    throw new MarketDataError("invalid_ticker", `No Polygon price data was found for ${ticker}.`);
  }

  const dailyChange = item.todaysChange ?? currentPrice - (previousClose ?? currentPrice);
  const dailyPercent = item.todaysChangePerc ?? (previousClose ? (dailyChange / previousClose) * 100 : 0);

  return {
    ticker,
    companyName: profile?.name,
    currentPrice,
    previousClose,
    dailyChange,
    dailyPercent,
    marketTime: item.updated ? new Date(item.updated / 1000000).toISOString() : new Date().toISOString(),
    profile,
    chart,
    news
  };
}

function mapAggregateSnapshot(
  ticker: string,
  aggregateChart: ChartPoint[] | undefined,
  profile?: StockProfile,
  chart?: ChartPoint[],
  news?: NewsItem[]
): MarketSnapshot {
  const points = aggregateChart ?? [];
  const latest = points.at(-1);
  const previous = points.at(-2);
  if (!latest) {
    throw new MarketDataError("invalid_ticker", `No Polygon price data was found for ${ticker}.`);
  }

  const previousClose = previous?.price ?? latest.price;
  const dailyChange = Number((latest.price - previousClose).toFixed(4));

  return {
    ticker,
    companyName: profile?.name,
    currentPrice: latest.price,
    previousClose,
    dailyChange,
    dailyPercent: previousClose ? Number(((dailyChange / previousClose) * 100).toFixed(4)) : 0,
    marketTime: new Date(`${latest.date}T21:00:00.000Z`).toISOString(),
    profile,
    chart,
    news
  };
}

async function getProfile(ticker: string) {
  const details = await polygonFetch<PolygonTickerDetails>(`/v3/reference/tickers/${ticker}`);
  return mapProfile(details.results);
}

async function getChart(ticker: string) {
  const to = new Date().toISOString().slice(0, 10);
  const from = subDays(new Date(), 370).toISOString().slice(0, 10);
  const aggs = await polygonFetch<PolygonAggs>(`/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}`, {
    adjusted: "true",
    sort: "asc",
    limit: 370
  });
  return mapChart(aggs);
}

async function getHistoricalPrice(ticker: string, date: Date) {
  const to = date.toISOString().slice(0, 10);
  const from = subDays(date, 7).toISOString().slice(0, 10);
  let aggs: PolygonAggs;
  try {
    aggs = await polygonFetch<PolygonAggs>(`/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}`, {
      // Purchase lots keep the price that was actually paid; split adjustment is applied separately.
      adjusted: "false",
      sort: "desc",
      limit: 1
    });
  } catch (error) {
    if (error instanceof MarketDataError && error.status === 403) {
      throw new MarketDataError("api_error", "Polygon could not return that purchase-date price. Your plan supports roughly 2 years of historical stock data.");
    }
    throw error;
  }

  const point = aggs.results?.find((item) => typeof item.c === "number");

  if (!point?.c) {
    throw new MarketDataError("api_error", `No historical close was available for ${ticker} near ${to}.`);
  }

  return Number(point.c.toFixed(2));
}

async function getSplits(ticker: string): Promise<StockSplit[]> {
  const response = await polygonFetch<PolygonSplits>("/v3/reference/splits", {
    ticker,
    sort: "execution_date",
    order: "asc",
    limit: 1000
  });

  return (
    response.results
      ?.filter(
        (item) =>
          item.ticker &&
          item.execution_date &&
          typeof item.split_from === "number" &&
          typeof item.split_to === "number" &&
          item.split_from > 0 &&
          item.split_to > 0
      )
      .map((item) => ({
        id: item.id,
        ticker: item.ticker as string,
        executionDate: item.execution_date as string,
        splitFrom: item.split_from as number,
        splitTo: item.split_to as number
      })) ?? []
  );
}

async function getNews(ticker: string) {
  const news = await polygonFetch<PolygonNews>("/v2/reference/news", {
    ticker,
    limit: 8,
    order: "desc",
    sort: "published_utc"
  });
  return mapNews(news);
}

async function getOneSnapshot(ticker: string, options?: MarketProviderOptions) {
  const [profile, aggregateChart, news] = await Promise.all([
    options?.includeProfile === false ? Promise.resolve(undefined) : getProfile(ticker).catch(() => undefined),
    options?.includeChart || !useSnapshotEndpoint ? getChart(ticker) : Promise.resolve(undefined),
    options?.includeNews ? getNews(ticker).catch(() => []) : Promise.resolve([])
  ]);

  if (!useSnapshotEndpoint) {
    return mapAggregateSnapshot(
      ticker,
      aggregateChart,
      profile,
      options?.includeChart ? aggregateChart : undefined,
      news
    );
  }

  try {
    const snapshot = await polygonFetch<PolygonSnapshot>(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`);
    return mapSnapshot(ticker, snapshot, profile, aggregateChart, news);
  } catch (error) {
    // Some Polygon plans allow aggregate bars but not snapshot/last-trade endpoints.
    if (error instanceof MarketDataError && error.status === 403) {
      const fallbackChart = aggregateChart ?? (await getChart(ticker));
      return mapAggregateSnapshot(ticker, fallbackChart, profile, options?.includeChart ? fallbackChart : undefined, news);
    }
    throw error;
  }
}

export const polygonProvider: MarketProvider = {
  name: "Polygon",
  getSnapshot: getOneSnapshot,
  getHistoricalPrice,
  getSplits,
  async searchTickers(query, limit = 8): Promise<TickerSearchResult[]> {
    const results = new Map<string, TickerSearchResult>();

    for (const variant of searchVariants(query)) {
      const search = await polygonFetch<PolygonTickerSearch>("/v3/reference/tickers", {
        market: "stocks",
        active: "true",
        limit,
        search: variant
      });

      const matches = mapTickerSearch(search);
      for (const item of matches) {
        if (!results.has(item.ticker)) results.set(item.ticker, item);
      }
      // Only try alternate wording when Polygon found nothing for the original query.
      if (matches.length > 0) break;
    }

    return [...results.values()].slice(0, limit);
  }
};
