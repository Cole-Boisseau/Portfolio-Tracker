import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import { isCurrencyCode } from "@/lib/currencies";
import { ExchangeRateError, getUsdExchangeRate } from "@/lib/currency/service";

export const dynamic = "force-dynamic";

export const GET = withUser(async (request) => {
  const currency = new URL(request.url).searchParams.get("currency")?.toUpperCase();
  if (!isCurrencyCode(currency)) {
    return NextResponse.json({ error: "Choose a supported currency." }, { status: 400 });
  }

  try {
    return NextResponse.json(await getUsdExchangeRate(currency));
  } catch (error) {
    const message = error instanceof ExchangeRateError
      ? error.message
      : "Currency conversion is temporarily unavailable. Please try again.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
});
