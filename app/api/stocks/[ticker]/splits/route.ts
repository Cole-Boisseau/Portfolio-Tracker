import { NextResponse } from "next/server";
import { getStockSplits, marketErrorMessage, marketErrorStatus } from "@/lib/market/service";
import { splitFactor } from "@/lib/splits";
import { normalizeTicker } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ ticker: string }> }) {
  const { ticker: tickerParam } = await context.params;
  const ticker = normalizeTicker(tickerParam);
  const purchaseDate = new URL(request.url).searchParams.get("from") ?? "";

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)
    ? new Date(`${purchaseDate}T00:00:00.000Z`)
    : null;
  if (
    !ticker ||
    !parsedDate ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== purchaseDate ||
    parsedDate.getTime() > Date.now()
  ) {
    return NextResponse.json({ error: "Choose a valid purchase date." }, { status: 400 });
  }

  try {
    const splits = await getStockSplits(ticker, parsedDate);
    return NextResponse.json({ ticker, splits, factor: splitFactor(splits) });
  } catch (error) {
    return NextResponse.json({ error: marketErrorMessage(error) }, { status: marketErrorStatus(error) });
  }
}
