-- CreateTable
CREATE TABLE "PositionLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "shares" REAL NOT NULL,
    "purchasePrice" REAL NOT NULL,
    "purchaseDate" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockCache" (
    "ticker" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT,
    "currentPrice" REAL,
    "previousClose" REAL,
    "dailyChange" REAL,
    "dailyPercent" REAL,
    "marketTime" DATETIME,
    "profileJson" TEXT,
    "chartJson" TEXT,
    "newsJson" TEXT,
    "quoteUpdatedAt" DATETIME,
    "newsUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PositionLot_ticker_idx" ON "PositionLot"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_ticker_key" ON "WatchlistItem"("ticker");
