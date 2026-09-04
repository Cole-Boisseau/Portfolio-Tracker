import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeCryptoId } from "@/lib/assets";
import { getCryptoHistoricalPrice, getCryptoSnapshot } from "@/lib/crypto/service";
import { getHistoricalPrice, getMarketSnapshot, getStockSplits, marketErrorMessage, marketErrorStatus } from "@/lib/market/service";
import { prisma } from "@/lib/prisma";
import { splitFactor } from "@/lib/splits";
import { normalizeTicker } from "@/lib/utils";
import { purchaseDateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const lotSchema = z.object({
  assetType: z.enum(["stock", "crypto"]).optional().default("stock"),
  assetId: z.string().max(100).optional().nullable(),
  ticker: z.string().min(1).max(20),
  shares: z.coerce.number().positive(),
  purchasePrice: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().nonnegative().optional()
  ),
  totalInvested: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().nonnegative().optional()
  ),
  purchaseDate: purchaseDateSchema,
  notes: z.string().optional().nullable(),
  adjustForSplits: z.boolean().optional().default(false)
});

export async function GET() {
  const lots = await prisma.positionLot.findMany({
    orderBy: [{ assetType: "asc" }, { ticker: "asc" }, { purchaseDate: "desc" }]
  });
  return NextResponse.json(lots);
}

export async function POST(request: Request) {
  const parsed = lotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const assetType = parsed.data.assetType;
  const requestedTicker = normalizeTicker(parsed.data.ticker);
  const requestedAssetId = assetType === "crypto" ? normalizeCryptoId(parsed.data.assetId ?? "") : requestedTicker;
  if (!requestedTicker) return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
  if (!requestedAssetId) {
    return NextResponse.json({ error: "Choose a cryptocurrency from the search results first." }, { status: 400 });
  }

  let ticker = requestedTicker;
  let purchasePrice =
    parsed.data.totalInvested !== undefined
      ? parsed.data.totalInvested / parsed.data.shares
      : parsed.data.purchasePrice;
  let splits = [] as Awaited<ReturnType<typeof getStockSplits>>;

  try {
    if (assetType === "crypto") {
      const snapshot = await getCryptoSnapshot(requestedAssetId, { force: true });
      ticker = snapshot.ticker;
      purchasePrice = purchasePrice ?? (await getCryptoHistoricalPrice(requestedAssetId, parsed.data.purchaseDate));
    } else {
      await getMarketSnapshot(ticker, { force: true });
      purchasePrice = purchasePrice ?? (await getHistoricalPrice(ticker, parsed.data.purchaseDate));
      if (parsed.data.adjustForSplits) {
        splits = await getStockSplits(ticker, parsed.data.purchaseDate);
      }
    }
  } catch (error) {
    return NextResponse.json({ error: marketErrorMessage(error) }, { status: marketErrorStatus(error) });
  }

  if (purchasePrice === undefined) {
    return NextResponse.json({ error: "Enter the total amount invested." }, { status: 400 });
  }

  const factor = assetType === "stock" ? splitFactor(splits) : 1;
  const lot = await prisma.positionLot.create({
    data: {
      assetType,
      assetId: requestedAssetId,
      ticker,
      shares: parsed.data.shares,
      purchasePrice,
      purchaseDate: parsed.data.purchaseDate,
      notes: parsed.data.notes?.trim() || null,
      splitFactor: factor,
      splitDetailsJson: splits.length ? JSON.stringify(splits) : null
    }
  });

  return NextResponse.json(
    {
      ...lot,
      splitAdjustment: {
        factor,
        originalShares: lot.shares,
        adjustedShares: lot.shares * factor,
        originalPurchasePrice: lot.purchasePrice,
        adjustedPurchasePrice: lot.purchasePrice / factor,
        totalInvested: lot.shares * lot.purchasePrice,
        splits
      }
    },
    { status: 201 }
  );
}
