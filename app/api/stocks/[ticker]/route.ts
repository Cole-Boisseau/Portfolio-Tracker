import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getMarketSnapshot, marketErrorMessage, marketErrorStatus } from "@/lib/market/service";
import { normalizeTicker } from "@/lib/utils";
import { adjustPositionLot } from "@/lib/splits";
import { assetKey } from "@/lib/assets";

export const dynamic = "force-dynamic";

export const GET = withUser(async (request, context: { params: Promise<{ ticker: string }> }, userId) => {
  const { ticker: tickerParam } = await context.params;
  const ticker = normalizeTicker(tickerParam);
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "true";

  if (!ticker) return NextResponse.json({ error: "Choose a valid ticker symbol." }, { status: 400 });

  try {
    const [snapshot, lots, watchlistItem] = await Promise.all([
      getMarketSnapshot(ticker, { includeChart: true, includeNews: true, force }),
      prisma.positionLot.findMany({
        where: { userId, assetType: "stock", ticker },
        orderBy: { purchaseDate: "desc" }
      }),
      prisma.watchlistItem.findUnique({
        where: { userId_assetKey: { userId, assetKey: assetKey({ assetType: "stock", assetId: ticker, ticker }) } }
      })
    ]);

    return NextResponse.json({
      ...snapshot,
      assetType: "stock",
      assetId: ticker,
      lots: lots.map(adjustPositionLot),
      inWatchlist: Boolean(watchlistItem),
      watchlistId: watchlistItem?.id
    });
  } catch (error) {
    return NextResponse.json({ error: marketErrorMessage(error) }, { status: marketErrorStatus(error) });
  }
});
