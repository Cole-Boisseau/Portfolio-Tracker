import { subDays } from "date-fns";
import type { ChartPoint, MarketProvider, MarketSnapshot, NewsItem } from "./types";

const names: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  TSLA: "Tesla, Inc.",
  AMZN: "Amazon.com, Inc.",
  GOOGL: "Alphabet Inc.",
  META: "Meta Platforms, Inc.",
  JPM: "JPMorgan Chase & Co.",
  V: "Visa Inc."
};

function seed(ticker: string) {
  return [...ticker].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function demoPrice(ticker: string) {
  const value = seed(ticker);
  return Number((40 + (value % 380) + (value % 17) / 10).toFixed(2));
}

function demoChart(ticker: string): ChartPoint[] {
  const base = demoPrice(ticker);
  const tickerSeed = seed(ticker);
  return Array.from({ length: 365 }, (_, index) => {
    const drift = index * ((tickerSeed % 7) - 2) * 0.18;
    const wave = Math.sin(index / 2.8 + tickerSeed) * (2 + (tickerSeed % 5));
    return {
      date: subDays(new Date(), 364 - index).toISOString().slice(0, 10),
      price: Number(Math.max(1, base - 8 + drift + wave).toFixed(2))
    };
  });
}

function demoNews(ticker: string): NewsItem[] {
  const company = names[ticker] ?? `${ticker} Holdings`;
  return [
    {
      id: `${ticker}-demo-1`,
      datetime: new Date().toISOString(),
      headline: `${company} updates investors as markets digest the latest trading session`,
      source: "Demo Market Wire",
      summary: "Add a Finnhub API key to replace this placeholder with current company news."
    },
    {
      id: `${ticker}-demo-2`,
      datetime: subDays(new Date(), 1).toISOString(),
      headline: `Analysts revisit expectations for ${ticker} after recent sector movement`,
      source: "Demo Finance Desk",
      summary: "This deterministic demo story keeps the app useful while offline."
    }
  ];
}

export const demoMarketProvider: MarketProvider = {
  name: "Demo",
  async getSnapshot(ticker, options): Promise<MarketSnapshot> {
    const currentPrice = demoPrice(ticker);
    const dailyChange = Number((((seed(ticker) % 19) - 8) / 10).toFixed(2));
    const previousClose = Number((currentPrice - dailyChange).toFixed(2));
    return {
      ticker,
      companyName: names[ticker] ?? `${ticker} Holdings`,
      currentPrice,
      previousClose,
      dailyChange,
      dailyPercent: Number(((dailyChange / previousClose) * 100).toFixed(2)),
      marketTime: new Date().toISOString(),
      profile: {
        name: names[ticker] ?? `${ticker} Holdings`,
        exchange: "Demo Exchange",
        industry: "Demo market data",
        currency: "USD"
      },
      chart: options?.includeChart ? demoChart(ticker) : undefined,
      news: options?.includeNews ? demoNews(ticker) : undefined
    };
  }
};
