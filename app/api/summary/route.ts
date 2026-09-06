import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getPortfolioSummary } from "@/lib/portfolio";
import { marketErrorMessage, marketErrorStatus, refreshTickers } from "@/lib/market/service";
import { normalizeTicker } from "@/lib/utils";
import { normalizeAssetType, normalizeCryptoId } from "@/lib/assets";
import { refreshCryptoAssets } from "@/lib/crypto/service";

export const dynamic = "force-dynamic";

export const GET = withUser(async (_request, _context, userId) => {
  try {
    const summary = await getPortfolioSummary(userId);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: marketErrorMessage(error) }, { status: marketErrorStatus(error) });
  }
});

export const POST = withUser(async (_request, _context, userId) => {
  try {
    const [lots, watchlist] = await Promise.all([
      prisma.positionLot.findMany({ where: { userId }, select: { assetType: true, assetId: true, ticker: true } }),
      prisma.watchlistItem.findMany({ where: { userId }, select: { assetType: true, assetId: true, ticker: true } })
    ]);
    const assets = [...lots, ...watchlist];
    const tickers = assets
      .filter((item) => normalizeAssetType(item.assetType) === "stock")
      .map((item) => normalizeTicker(item.ticker));
    const cryptoIds = assets
      .filter((item) => normalizeAssetType(item.assetType) === "crypto")
      .map((item) => normalizeCryptoId(item.assetId ?? ""));
    await Promise.all([refreshTickers(tickers), refreshCryptoAssets(cryptoIds)]);
    return NextResponse.json(await getPortfolioSummary(userId));
  } catch (error) {
    return NextResponse.json({ error: marketErrorMessage(error) }, { status: marketErrorStatus(error) });
  }
});
