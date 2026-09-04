import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  options: { compact?: boolean; locale?: string } = {}
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const absoluteValue = Math.abs(value);
  const maximumFractionDigits = options.compact
    ? 1
    : currency === "JPY" || absoluteValue >= 1000
      ? 0
      : absoluteValue > 0 && absoluteValue < 0.01
        ? 6
        : 2;
  return new Intl.NumberFormat(options.locale ?? "en-US", {
    style: "currency",
    currency,
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits
  }).format(value);
}

export function formatPercent(value: number | null | undefined, locale = "en-US") {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always"
  }).format(value)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits
  }).format(value);
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
