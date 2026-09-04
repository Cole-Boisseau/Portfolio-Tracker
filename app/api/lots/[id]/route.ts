import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAssetType } from "@/lib/assets";
import { getStockSplits, marketErrorMessage, marketErrorStatus } from "@/lib/market/service";
import { prisma } from "@/lib/prisma";
import { splitFactor } from "@/lib/splits";
import { purchaseDateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const updateLotSchema = z.object({
  shares: z.coerce.number().positive().optional(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
  totalInvested: z.coerce.number().nonnegative().optional(),
  purchaseDate: purchaseDateSchema.optional(),
  notes: z.string().optional().nullable(),
  adjustForSplits: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = updateLotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.positionLot.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Purchase lot not found." }, { status: 404 });

  const assetType = normalizeAssetType(existing.assetType);
  const ticker = existing.ticker;
  const purchaseDate = parsed.data.purchaseDate ?? existing.purchaseDate;
  let splitData: { splitFactor: number; splitDetailsJson: string | null } | undefined;

  const shouldRecalculateSplits = parsed.data.adjustForSplits !== undefined ||
    (Boolean(parsed.data.purchaseDate) && existing.splitFactor !== 1);
  if (shouldRecalculateSplits) {
    try {
      const shouldAdjust = parsed.data.adjustForSplits ?? existing.splitFactor !== 1;
      const splits = assetType === "stock" && shouldAdjust
        ? await getStockSplits(ticker, purchaseDate)
        : [];
      splitData = {
        splitFactor: splitFactor(splits),
        splitDetailsJson: splits.length ? JSON.stringify(splits) : null
      };
    } catch (error) {
      return NextResponse.json({ error: marketErrorMessage(error) }, { status: marketErrorStatus(error) });
    }
  }

  const nextShares = parsed.data.shares ?? existing.shares;
  const nextPurchasePrice = parsed.data.totalInvested !== undefined
    ? parsed.data.totalInvested / nextShares
    : parsed.data.purchasePrice;
  const lot = await prisma.positionLot.update({
    where: { id },
    data: {
      ticker,
      shares: parsed.data.shares,
      purchaseDate: parsed.data.purchaseDate,
      notes: parsed.data.notes === undefined ? undefined : parsed.data.notes?.trim() || null,
      ...(nextPurchasePrice !== undefined ? { purchasePrice: nextPurchasePrice } : {}),
      ...splitData
    }
  });

  return NextResponse.json(lot);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await prisma.positionLot.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
