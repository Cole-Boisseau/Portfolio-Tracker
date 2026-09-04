-- AlterTable
ALTER TABLE "PositionLot" ADD COLUMN "splitFactor" REAL NOT NULL DEFAULT 1;
ALTER TABLE "PositionLot" ADD COLUMN "splitDetailsJson" TEXT;

-- AlterTable
ALTER TABLE "StockCache" ADD COLUMN "splitsJson" TEXT;
ALTER TABLE "StockCache" ADD COLUMN "splitsUpdatedAt" DATETIME;
