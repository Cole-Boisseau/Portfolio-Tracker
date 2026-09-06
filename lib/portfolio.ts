import { assetKey, normalizeAssetType, normalizeCryptoId } from "@/lib/assets";
import type { AssetIdentity, AssetType } from "@/lib/assets";
import { getCryptoSnapshots } from "@/lib/crypto/service";
import { getMarketSnapshot } from "@/lib/market/service";
import type { ChartPoint, MarketSnapshot } from "@/lib/market/types";
import { prisma } from "@/lib/prisma";
import { adjustPositionLot } from "@/lib/splits";
import { normalizeTicker } from "@/lib/utils";

export type Holding = {
  assetType: AssetType;
  assetId: string;
  ticker: string;
  companyName?: string;
  image?: string;
  shares: number;
  totalCost: number;
  averageCost: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  dailyChange: number;
  dailyPercent: number;
  lastUpdated?: string;
  chart?: ChartPoint[];
  lots: Array<{
    id: string;
    assetType?: string;
    assetId?: string | null;
    ticker: string;
    shares: number;
    purchasePrice: number;
    purchaseDate: string;
    notes?: string | null;
    splitFactor: number;
    originalShares?: number;
    originalPurchasePrice?: number;
    splits: Array<{
      id?: string;
      ticker: string;
      executionDate: string;
      splitFrom: number;
      splitTo: number;
    }>;
  }>;
};

export type PortfolioSummary = {
  totalCost: number;
  totalValue: number;
  gainLoss: number;
  gainLossPercent: number;
  dayChangeEstimate: number;
  holdings: Holding[];
  watchlist: Array<MarketSnapshot & { id: string; assetType: AssetType; assetId: string; notes?: string | null }>;
  updatedAt: string;
};

type PositionLotRow = {
  id: string;
  assetType: string;
  assetId?: string | null;
  ticker: string;
  shares: number;
  purchasePrice: number;
  purchaseDate: Date;
  notes?: string | null;
  splitFactor: number;
  splitDetailsJson?: string | null;
};

type WatchlistItemRow = {
  id: string;
  assetType: string;
  assetId?: string | null;
  ticker: string;
  notes?: string | null;
};

function identity(row: { assetType?: string; assetId?: string | null; ticker: string }): AssetIdentity {
  const assetType = normalizeAssetType(row.assetType);
  const ticker = normalizeTicker(row.ticker);
  return {
    assetType,
    ticker,
    assetId: assetType === "crypto" ? normalizeCryptoId(row.assetId ?? "") : ticker
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const [lots, watchlist] = (await Promise.all([
    prisma.positionLot.findMany({ where: { userId }, orderBy: [{ assetType: "asc" }, { ticker: "asc" }, { purchaseDate: "asc" }] }),
    prisma.watchlistItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
  ])) as [PositionLotRow[], WatchlistItemRow[]];

  const activeIdentities = [...lots.map(identity), ...watchlist.map(identity)];
  const stockTickers = [
    ...new Set(activeIdentities.filter((item) => item.assetType === "stock").map((item) => item.ticker))
  ];
  const cryptoIds = [
    ...new Set(
      activeIdentities
        .filter((item) => item.assetType === "crypto")
        .map((item) => normalizeCryptoId(item.assetId ?? ""))
        .filter(Boolean)
    )
  ];
  const snapshots = new Map<string, MarketSnapshot>();

  const [stockSnapshots, cryptoSnapshots] = await Promise.all([
    Promise.all(stockTickers.map((ticker) => getMarketSnapshot(ticker, { includeChart: true }))),
    getCryptoSnapshots(cryptoIds, { includeChart: true })
  ]);

  stockSnapshots.forEach((snapshot) => {
    const descriptor = { assetType: "stock" as const, assetId: snapshot.ticker, ticker: snapshot.ticker };
    snapshots.set(assetKey(descriptor), { ...snapshot, ...descriptor });
  });
  cryptoSnapshots.forEach((snapshot) => {
    const descriptor = {
      assetType: "crypto" as const,
      assetId: normalizeCryptoId(snapshot.assetId ?? ""),
      ticker: snapshot.ticker
    };
    snapshots.set(assetKey(descriptor), { ...snapshot, ...descriptor });
  });

  const holdingKeys = [...new Set(lots.map((lot) => assetKey(identity(lot))))];
  const holdings = holdingKeys.map((key) => {
    const tickerLots = lots.filter((lot) => assetKey(identity(lot)) === key);
    const descriptor = identity(tickerLots[0]);
    const adjustedLots = tickerLots.map(adjustPositionLot);
    const snapshot = snapshots.get(key);
    const shares = adjustedLots.reduce((sum, lot) => sum + lot.shares, 0);
    const calculatedCost = tickerLots.reduce((sum, lot) => sum + lot.shares * lot.purchasePrice, 0);
    const totalCost = descriptor.assetType === "crypto" ? roundMoney(calculatedCost) : calculatedCost;
    const currentPrice = snapshot?.currentPrice ?? 0;
    const calculatedValue = shares * currentPrice;
    const currentValue = descriptor.assetType === "crypto" ? roundMoney(calculatedValue) : calculatedValue;
    const calculatedGainLoss = currentValue - totalCost;
    const gainLoss = descriptor.assetType === "crypto" ? roundMoney(calculatedGainLoss) : calculatedGainLoss;

    return {
      assetType: descriptor.assetType,
      assetId: descriptor.assetId ?? descriptor.ticker,
      ticker: snapshot?.ticker ?? descriptor.ticker,
      companyName: snapshot?.companyName,
      image: snapshot?.image,
      shares,
      totalCost,
      averageCost: shares ? totalCost / shares : 0,
      currentPrice,
      currentValue,
      gainLoss,
      gainLossPercent: totalCost ? (gainLoss / totalCost) * 100 : 0,
      dailyChange: snapshot?.dailyChange ?? 0,
      dailyPercent: snapshot?.dailyPercent ?? 0,
      lastUpdated: snapshot?.marketTime,
      chart: snapshot?.chart,
      lots: adjustedLots
    };
  });

  const totalCost = holdings.reduce((sum, holding) => sum + holding.totalCost, 0);
  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const gainLoss = totalValue - totalCost;
  const dayChangeEstimate = holdings.reduce((sum, holding) => sum + holding.shares * holding.dailyChange, 0);
  const snapshotTimes = [...snapshots.values()]
    .map((snapshot) => snapshot.cachedAt ? Date.parse(snapshot.cachedAt) : Number.NaN)
    .filter(Number.isFinite);
  const updatedAt = snapshotTimes.length
    ? new Date(Math.min(...snapshotTimes)).toISOString()
    : new Date().toISOString();

  return {
    totalCost,
    totalValue,
    gainLoss,
    gainLossPercent: totalCost ? (gainLoss / totalCost) * 100 : 0,
    dayChangeEstimate,
    holdings: holdings.sort((a, b) => b.currentValue - a.currentValue),
    watchlist: watchlist.map((item) => {
      const descriptor = identity(item);
      const snapshot = snapshots.get(assetKey(descriptor));
      if (!snapshot) {
        throw new Error(`Market data is unavailable for ${item.ticker}.`);
      }
      return {
        ...snapshot,
        id: item.id,
        assetType: descriptor.assetType,
        assetId: descriptor.assetId ?? descriptor.ticker,
        notes: item.notes
      };
    }),
    updatedAt
  };
}
