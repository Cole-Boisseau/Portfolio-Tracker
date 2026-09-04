import type { CurrencyCode } from "@/lib/currencies";

const configuredCacheSeconds = Number(process.env.FX_CACHE_SECONDS);
const cacheSeconds = Number.isFinite(configuredCacheSeconds) && configuredCacheSeconds > 0
  ? configuredCacheSeconds
  : 43200;
const baseUrl = "https://api.frankfurter.dev/v2";

type RateResponse = Array<{
  date: string;
  base: string;
  quote: string;
  rate: number;
}>;

export type ExchangeRate = {
  currency: CurrencyCode;
  rate: number;
  asOf: string;
};

type CachedRate = ExchangeRate & { cachedAt: number };

declare global {
  var exchangeRateCache: Map<CurrencyCode, CachedRate> | undefined;
  var exchangeRateRequests: Map<CurrencyCode, Promise<ExchangeRate>> | undefined;
}

const rateCache = globalThis.exchangeRateCache ?? new Map<CurrencyCode, CachedRate>();
const rateRequests = globalThis.exchangeRateRequests ?? new Map<CurrencyCode, Promise<ExchangeRate>>();
globalThis.exchangeRateCache = rateCache;
globalThis.exchangeRateRequests = rateRequests;

export class ExchangeRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExchangeRateError";
  }
}

async function fetchRate(currency: CurrencyCode): Promise<ExchangeRate> {
  let response: Response;
  try {
    const query = new URLSearchParams({ base: "USD", quotes: currency });
    response = await fetch(`${baseUrl}/rates?${query.toString()}`, { cache: "no-store" });
  } catch {
    throw new ExchangeRateError("Currency conversion is temporarily unavailable. Please try again.");
  }

  if (!response.ok) {
    throw new ExchangeRateError("Currency conversion is temporarily unavailable. Please try again.");
  }

  const rates = (await response.json()) as RateResponse;
  const match = rates.find((entry) => entry.base === "USD" && entry.quote === currency);
  if (!match || !Number.isFinite(match.rate) || match.rate <= 0) {
    throw new ExchangeRateError(`No exchange rate is available for ${currency}.`);
  }

  return { currency, rate: match.rate, asOf: match.date };
}

export async function getUsdExchangeRate(currency: CurrencyCode): Promise<ExchangeRate> {
  if (currency === "USD") {
    return { currency: "USD", rate: 1, asOf: new Date().toISOString().slice(0, 10) };
  }

  const cached = rateCache.get(currency);
  if (cached && Date.now() - cached.cachedAt < cacheSeconds * 1000) {
    return cached;
  }

  const pending = rateRequests.get(currency);
  if (pending) return pending;

  const request = fetchRate(currency)
    .then((rate) => {
      rateCache.set(currency, { ...rate, cachedAt: Date.now() });
      return rate;
    })
    .catch((error) => {
      if (cached) return cached;
      throw error;
    })
    .finally(() => rateRequests.delete(currency));

  rateRequests.set(currency, request);
  return request;
}
