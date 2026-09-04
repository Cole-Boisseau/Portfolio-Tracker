import type { StockSplit } from "@/lib/market/types";

type StoredPositionLot = {
  id: string;
  assetType?: string;
  assetId?: string | null;
  ticker: string;
  shares: number;
  purchasePrice: number;
  purchaseDate: Date | string;
  notes?: string | null;
  splitFactor?: number | null;
  splitDetailsJson?: string | null;
};

export function splitFactor(splits: StockSplit[]) {
  return splits.reduce((factor, split) => factor * (split.splitTo / split.splitFrom), 1);
}

export function parseSplitDetails(value?: string | null): StockSplit[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as StockSplit[]) : [];
  } catch {
    return [];
  }
}

export function adjustPositionLot(lot: StoredPositionLot) {
  const factor = lot.splitFactor && lot.splitFactor > 0 ? lot.splitFactor : 1;
  const adjusted = factor !== 1;

  return {
    id: lot.id,
    assetType: lot.assetType ?? "stock",
    assetId: lot.assetId ?? lot.ticker,
    ticker: lot.ticker,
    shares: lot.shares * factor,
    purchasePrice: lot.purchasePrice / factor,
    purchaseDate:
      lot.purchaseDate instanceof Date ? lot.purchaseDate.toISOString() : lot.purchaseDate,
    notes: lot.notes,
    splitFactor: factor,
    splits: parseSplitDetails(lot.splitDetailsJson),
    originalShares: adjusted ? lot.shares : undefined,
    originalPurchasePrice: adjusted ? lot.purchasePrice : undefined
  };
}
