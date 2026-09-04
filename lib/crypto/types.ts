import type { ChartPoint, MarketSnapshot, TickerSearchResult } from "@/lib/market/types";

export type CryptoProvider = {
  name: string;
  searchAssets: (query: string, limit?: number) => Promise<TickerSearchResult[]>;
  getSnapshots: (assetIds: string[]) => Promise<MarketSnapshot[]>;
  getChart: (assetId: string) => Promise<ChartPoint[]>;
  getHistoricalPrice: (assetId: string, date: Date) => Promise<number>;
};
