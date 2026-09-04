import type { AssetType } from "@/lib/assets";

export type ChartPoint = {
  date: string;
  price: number;
};

export type NewsItem = {
  id: string;
  datetime: string;
  headline: string;
  source: string;
  summary?: string;
  url?: string;
  image?: string;
};

export type StockProfile = {
  name?: string;
  exchange?: string;
  industry?: string;
  logo?: string;
  weburl?: string;
  country?: string;
  currency?: string;
  image?: string;
  marketCapRank?: number;
  marketCap?: number;
  high24h?: number;
  low24h?: number;
  totalVolume?: number;
};

export type MarketSnapshot = {
  assetType?: AssetType;
  assetId?: string;
  ticker: string;
  companyName?: string;
  currentPrice: number;
  previousClose?: number;
  dailyChange: number;
  dailyPercent: number;
  marketTime?: string;
  cachedAt?: string;
  profile?: StockProfile;
  chart?: ChartPoint[];
  news?: NewsItem[];
  image?: string;
};

export type TickerSearchResult = {
  assetType?: AssetType;
  assetId?: string;
  ticker: string;
  name: string;
  type?: string;
  exchange?: string;
  market?: string;
  currency?: string;
  image?: string;
};

export type StockSplit = {
  id?: string;
  ticker: string;
  executionDate: string;
  splitFrom: number;
  splitTo: number;
};

export type MarketProvider = {
  name: string;
  getSnapshot: (ticker: string, options?: MarketProviderOptions) => Promise<MarketSnapshot>;
  getSnapshots?: (tickers: string[], options?: MarketProviderOptions) => Promise<MarketSnapshot[]>;
  searchTickers?: (query: string, limit?: number) => Promise<TickerSearchResult[]>;
  getHistoricalPrice?: (ticker: string, date: Date) => Promise<number>;
  getSplits?: (ticker: string) => Promise<StockSplit[]>;
};

export type MarketProviderOptions = {
  includeChart?: boolean;
  includeNews?: boolean;
  includeProfile?: boolean;
};

export type MarketErrorCode = "missing_api_key" | "invalid_ticker" | "rate_limited" | "network" | "api_error";

export class MarketDataError extends Error {
  code: MarketErrorCode;
  status?: number;

  constructor(code: MarketErrorCode, message: string, status?: number) {
    super(message);
    this.name = "MarketDataError";
    this.code = code;
    this.status = status;
  }
}
