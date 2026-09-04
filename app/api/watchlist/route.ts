import { NextResponse } from "next/server";
import { z } from "zod";
import { assetKey, normalizeCryptoId } from "@/lib/assets";
import { getCryptoSnapshot } from "@/lib/crypto/service";
import { getMarketSnapshot, marketErrorMessage, marketErrorStatus } from "@/lib/market/service";
import { prisma } from "@/lib/prisma";
import { normalizeTicker } from "@/lib/utils";

export const dynamic = "force-dynamic";

const watchlistSchema = z.object({
  assetType: z.enum(["stock", "crypto"]).optional().default("stock"),
  assetId: z.string().max(100).optional().nullable(),
  ticker: z.string().min(1).max(20),
  notes: z.string().optional().nullable()
});

export async function GET() {
  const items = await prisma.watchlistItem.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const parsed = watchlistSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const assetType = parsed.data.assetType;
  const requestedTicker = normalizeTicker(parsed.data.ticker);
  const id = assetType === "crypto" ? normalizeCryptoId(parsed.data.assetId ?? "") : requestedTicker;
  if (!id) {
    return NextResponse.json(
      { error: assetType === "crypto" ? "Choose a cryptocurrency from the search results first." : "Ticker is required." },
      { status: 400 }
    );
  }

  let ticker = requestedTicker;
  try {
    if (assetType === "crypto") {
      const snapshot = await getCryptoSnapshot(id, { force: true });
      ticker = snapshot.ticker;
    } else {
      await getMarketSnapshot(ticker, { force: true });
    }
  } catch (error) {
    return NextResponse.json({ error: marketErrorMessage(error) }, { status: marketErrorStatus(error) });
  }

  const key = assetKey({ assetType, assetId: id, ticker });
  const item = await prisma.watchlistItem.upsert({
    where: { assetKey: key },
    create: {
      assetType,
      assetId: id,
      assetKey: key,
      ticker,
      notes: parsed.data.notes?.trim() || null
    },
    update: {
      ticker,
      notes: parsed.data.notes?.trim() || null
    }
  });

  return NextResponse.json(item, { status: 201 });
}
