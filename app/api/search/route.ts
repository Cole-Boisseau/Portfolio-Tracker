import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import { marketErrorMessage, searchTickers } from "@/lib/market/service";
import { MarketDataError } from "@/lib/market/types";
import { searchCryptoAssets } from "@/lib/crypto/service";

export const dynamic = "force-dynamic";

export const GET = withUser(async (request) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const assetType = url.searchParams.get("type") === "crypto" ? "crypto" : "stock";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = assetType === "crypto"
      ? await searchCryptoAssets(query, 8)
      : (await searchTickers(query, 8)).map((result) => ({
          ...result,
          assetType: "stock" as const,
          assetId: result.ticker
        }));
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof MarketDataError && error.code === "rate_limited") {
      return NextResponse.json(
        { error: `${assetType === "crypto" ? "Crypto" : "Stock"} search is temporarily limited. Please wait about a minute and try again.` },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: marketErrorMessage(error) }, { status: 503 });
  }
});
