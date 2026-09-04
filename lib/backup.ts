import { z } from "zod";
import { assetKey, normalizeCryptoId } from "@/lib/assets";
import { prisma } from "@/lib/prisma";
import { normalizeTicker } from "@/lib/utils";

export const BACKUP_FORMAT = "my-portfolio-backup";
export const BACKUP_VERSION = 1;

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

const splitSchema = z.object({
  id: z.string().max(100).optional(),
  ticker: z.string().trim().min(1).max(20),
  executionDate: z.string().trim().min(10).max(40),
  splitFrom: z.number().positive().finite(),
  splitTo: z.number().positive().finite()
});

const lotSchema = z.object({
  assetType: z.enum(["stock", "crypto"]),
  assetId: z.string().trim().max(100).nullable().optional(),
  ticker: z.string().trim().min(1).max(20),
  shares: z.number().positive().finite(),
  purchasePrice: z.number().nonnegative().finite(),
  purchaseDate: z.string().datetime(),
  notes: z.string().max(2000).nullable().optional(),
  splitFactor: z.number().positive().finite().default(1),
  splits: z.array(splitSchema).max(100).default([]),
  createdAt: z.string().datetime().optional()
});

const watchlistItemSchema = z.object({
  assetType: z.enum(["stock", "crypto"]),
  assetId: z.string().trim().max(100).nullable().optional(),
  ticker: z.string().trim().min(1).max(20),
  notes: z.string().max(2000).nullable().optional(),
  createdAt: z.string().datetime().optional()
});

export const backupSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  accent: z.enum(["emerald", "blue", "rose", "amber"]).optional(),
  currency: z.enum(["USD", "EUR", "JPY", "GBP", "CNY", "CHF", "AUD", "CAD", "HKD", "SGD"]).optional(),
  language: z.enum(["en", "es", "fr", "pt", "zh-CN", "de", "ja"]).optional()
});

export const portfolioBackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().datetime(),
  lots: z.array(lotSchema).max(10_000),
  watchlist: z.array(watchlistItemSchema).max(5_000),
  settings: backupSettingsSchema.default({}),
  favorites: z.array(z.string().trim().min(1).max(120)).max(5_000).default([])
});

export type PortfolioBackup = z.output<typeof portfolioBackupSchema>;

const settingKeys = ["theme", "accent", "currency", "language"] as const;

function savedSplits(value: string | null) {
  if (!value) return [];
  try {
    const parsed = z.array(splitSchema).safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function normalizedFavorite(value: string) {
  if (value.startsWith("crypto:")) {
    const id = normalizeCryptoId(value.slice(7));
    return id ? `crypto:${id}` : "";
  }
  const ticker = normalizeTicker(value.startsWith("stock:") ? value.slice(6) : value);
  return ticker ? `stock:${ticker}` : "";
}

export async function createPortfolioBackup(): Promise<PortfolioBackup> {
  const [lots, watchlist, savedSettings] = await Promise.all([
    prisma.positionLot.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.watchlistItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.appSetting.findMany({ where: { key: { in: [...settingKeys] } } })
  ]);
  const rawSettings = Object.fromEntries(savedSettings.map((setting) => [setting.key, setting.value]));
  const settings = backupSettingsSchema.safeParse(rawSettings);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    lots: lots.map((lot) => ({
      assetType: lot.assetType === "crypto" ? "crypto" : "stock",
      assetId: lot.assetId,
      ticker: lot.ticker,
      shares: lot.shares,
      purchasePrice: lot.purchasePrice,
      purchaseDate: lot.purchaseDate.toISOString(),
      notes: lot.notes,
      splitFactor: lot.splitFactor,
      splits: savedSplits(lot.splitDetailsJson),
      createdAt: lot.createdAt.toISOString()
    })),
    watchlist: watchlist.map((item) => ({
      assetType: item.assetType === "crypto" ? "crypto" : "stock",
      assetId: item.assetId,
      ticker: item.ticker,
      notes: item.notes,
      createdAt: item.createdAt.toISOString()
    })),
    settings: settings.success ? settings.data : {},
    favorites: []
  };
}

export async function restorePortfolioBackup(backup: PortfolioBackup) {
  const lots = backup.lots.map((lot) => {
    const assetType = lot.assetType;
    const ticker = normalizeTicker(lot.ticker);
    const assetId = assetType === "crypto" ? normalizeCryptoId(lot.assetId ?? "") : ticker;
    if (!ticker || !assetId) throw new BackupValidationError("A portfolio entry is missing a valid asset symbol.");

    return {
      assetType,
      assetId,
      ticker,
      shares: lot.shares,
      purchasePrice: lot.purchasePrice,
      purchaseDate: new Date(lot.purchaseDate),
      notes: lot.notes?.trim() || null,
      splitFactor: assetType === "stock" ? lot.splitFactor : 1,
      splitDetailsJson: assetType === "stock" && lot.splits.length ? JSON.stringify(lot.splits) : null,
      createdAt: lot.createdAt ? new Date(lot.createdAt) : new Date()
    };
  });

  const watchlist = backup.watchlist.map((item) => {
    const assetType = item.assetType;
    const ticker = normalizeTicker(item.ticker);
    const assetId = assetType === "crypto" ? normalizeCryptoId(item.assetId ?? "") : ticker;
    if (!ticker || !assetId) throw new BackupValidationError("A watchlist entry is missing a valid asset symbol.");
    const identity = { assetType, assetId, ticker };
    return {
      ...identity,
      assetKey: assetKey(identity),
      notes: item.notes?.trim() || null,
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date()
    };
  });

  if (new Set(watchlist.map((item) => item.assetKey)).size !== watchlist.length) {
    throw new BackupValidationError("The backup contains duplicate watchlist assets.");
  }

  const settings = Object.entries(backup.settings).map(([key, value]) => ({ key, value: String(value) }));
  const favorites = [...new Set(backup.favorites.map(normalizedFavorite).filter(Boolean))];

  await prisma.$transaction(async (transaction) => {
    await transaction.positionLot.deleteMany();
    await transaction.watchlistItem.deleteMany();
    await transaction.appSetting.deleteMany({ where: { key: { in: [...settingKeys] } } });
    if (lots.length) await transaction.positionLot.createMany({ data: lots });
    if (watchlist.length) await transaction.watchlistItem.createMany({ data: watchlist });
    if (settings.length) await transaction.appSetting.createMany({ data: settings });
  });

  return {
    lots: lots.length,
    watchlist: watchlist.length,
    settings: backup.settings,
    favorites
  };
}
