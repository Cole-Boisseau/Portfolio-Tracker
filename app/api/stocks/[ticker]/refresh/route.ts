import { NextResponse } from "next/server";
import { getMarketSnapshot, marketErrorMessage, marketErrorStatus } from "@/lib/market/service";
import { normalizeTicker } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ ticker: string }> }) {
  const { ticker: tickerParam } = await context.params;
  const ticker = normalizeTicker(tickerParam);
  if (!ticker) return NextResponse.json({ error: "Choose a valid ticker symbol." }, { status: 400 });
  try {
    return NextResponse.json(await getMarketSnapshot(ticker, { includeChart: true, includeNews: true, force: true }));
  } catch (error) {
    return NextResponse.json({ error: marketErrorMessage(error) }, { status: marketErrorStatus(error) });
  }
}
