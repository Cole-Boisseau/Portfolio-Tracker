export const supportedCurrencies = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "GBP", name: "British Pound" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SGD", name: "Singapore Dollar" }
] as const;

export type CurrencyCode = (typeof supportedCurrencies)[number]["code"];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return supportedCurrencies.some((currency) => currency.code === value);
}
