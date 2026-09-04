import { NextResponse } from "next/server";
import { assetKey, normalizeCryptoId } from "@/lib/assets";
import { getCryptoSnapshot } from "@/lib/crypto/service";
import { marketErrorMessage, marketErrorStatus } from "@/lib/market/service";
import { prisma } from "@/lib/prisma";
import { adjustPositionLot } from "@/lib/splits";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await context.params;
  const id = normalizeCryptoId(decodeURIComponent(idParam));
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "true";

  if (!id) return NextResponse.json({ error: "Choose a cryptocurrency first." }, { status: 400 });

  try {
    const key = assetKey({ assetType: "crypto", assetId: id, ticker: id });
    const [snapshot, lots, watchlistItem] = await Promise.all([
      getCryptoSnapshot(id, { includeChart: true, force }),
      prisma.positionLot.findMany({
        where: { assetType: "crypto", assetId: id },
        orderBy: { purchaseDate: "desc" }
      }),
      prisma.watchlistItem.findUnique({ where: { assetKey: key } })
    ]);

    return NextResponse.json({
      ...snapshot,
      assetType: "crypto",
      assetId: id,
      lots: lots.map(adjustPositionLot),
      inWatchlist: Boolean(watchlistItem),
      watchlistId: watchlistItem?.id
    });
  } catch (error) {
    return NextResponse.json({ error: marketErrorMessage(error) }, { status: marketErrorStatus(error) });
  }
}
