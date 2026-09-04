-- Add first-class asset identity to portfolio lots.
ALTER TABLE "PositionLot" ADD COLUMN "assetType" TEXT NOT NULL DEFAULT 'stock';
ALTER TABLE "PositionLot" ADD COLUMN "assetId" TEXT;
UPDATE "PositionLot" SET "assetId" = "ticker" WHERE "assetId" IS NULL;
CREATE INDEX "PositionLot_assetType_assetId_idx" ON "PositionLot"("assetType", "assetId");

-- Replace the ticker-only watchlist key so stock and crypto symbols cannot collide.
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetType" TEXT NOT NULL DEFAULT 'stock',
    "assetId" TEXT,
    "assetKey" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WatchlistItem" ("id", "assetType", "assetId", "assetKey", "ticker", "notes", "createdAt", "updatedAt")
SELECT "id", 'stock', "ticker", 'stock:' || "ticker", "ticker", "notes", "createdAt", "updatedAt" FROM "WatchlistItem";
DROP TABLE "WatchlistItem";
ALTER TABLE "new_WatchlistItem" RENAME TO "WatchlistItem";
CREATE UNIQUE INDEX "WatchlistItem_assetKey_key" ON "WatchlistItem"("assetKey");
PRAGMA foreign_keys=ON;

-- Crypto quotes and charts are cached separately from stock ticker data.
CREATE TABLE "CryptoCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "currentPrice" REAL,
    "previousClose" REAL,
    "dailyChange" REAL,
    "dailyPercent" REAL,
    "marketTime" DATETIME,
    "profileJson" TEXT,
    "chartJson" TEXT,
    "quoteUpdatedAt" DATETIME,
    "chartUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "CryptoCache_ticker_idx" ON "CryptoCache"("ticker");
