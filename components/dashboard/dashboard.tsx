"use client";

import { createContext, FormEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  BellOff,
  BellPlus,
  Bitcoin,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  DatabaseBackup,
  Download,
  Ellipsis,
  ExternalLink,
  GitFork,
  LayoutDashboard,
  Languages,
  LineChart,
  LockKeyhole,
  Moon,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Star,
  Sun,
  Trash2,
  Upload,
  WalletCards,
  X,
  type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { assetKey } from "@/lib/assets";
import type { AssetIdentity, AssetType } from "@/lib/assets";
import { isCurrencyCode, supportedCurrencies } from "@/lib/currencies";
import type { CurrencyCode } from "@/lib/currencies";
import { translate, type TranslationKey } from "@/lib/i18n";
import { isLanguageCode, languageLocale, supportedLanguages } from "@/lib/languages";
import type { LanguageCode } from "@/lib/languages";
import { cn, formatCurrency, formatNumber, formatPercent, normalizeTicker, toDateInputValue } from "@/lib/utils";

type ChartPoint = {
  date: string;
  price: number;
};

type PositionLot = {
  id: string;
  assetType?: AssetType;
  assetId?: string;
  ticker: string;
  shares: number;
  purchasePrice: number;
  purchaseDate: string;
  notes?: string | null;
  splitFactor: number;
  originalShares?: number;
  originalPurchasePrice?: number;
  splits: StockSplit[];
};

type StockSplit = {
  id?: string;
  ticker: string;
  executionDate: string;
  splitFrom: number;
  splitTo: number;
};

type SplitPreview = {
  ticker: string;
  factor: number;
  splits: StockSplit[];
};

type PositionForm = {
  assetType: AssetType;
  assetId: string;
  ticker: string;
  shares: string;
  totalInvested: string;
  purchaseDate: string;
  notes: string;
  adjustForSplits?: boolean;
};

type PositionUpdateForm = Pick<PositionForm, "shares" | "totalInvested" | "purchaseDate" | "notes" | "adjustForSplits">;

type SavedPosition = {
  splitAdjustment: {
    factor: number;
    originalShares: number;
    adjustedShares: number;
  };
};

type NewsItem = {
  id: string;
  datetime: string;
  headline: string;
  source: string;
  summary?: string;
  url?: string;
  image?: string;
};

type Holding = {
  assetType: AssetType;
  assetId: string;
  ticker: string;
  companyName?: string;
  image?: string;
  shares: number;
  totalCost: number;
  averageCost: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  dailyChange: number;
  dailyPercent: number;
  lastUpdated?: string;
  chart?: ChartPoint[];
  lots: PositionLot[];
};

type WatchlistItem = {
  id: string;
  assetType: AssetType;
  assetId: string;
  ticker: string;
  companyName?: string;
  image?: string;
  currentPrice: number;
  dailyChange: number;
  dailyPercent: number;
  notes?: string | null;
  chart?: ChartPoint[];
};

type TickerSearchResult = {
  assetType: AssetType;
  assetId: string;
  ticker: string;
  name: string;
  type?: string;
  exchange?: string;
  market?: string;
  currency?: string;
  image?: string;
};

type SearchResponse = {
  results: TickerSearchResult[];
};

type PortfolioSummary = {
  totalCost: number;
  totalValue: number;
  gainLoss: number;
  gainLossPercent: number;
  dayChangeEstimate: number;
  holdings: Holding[];
  watchlist: WatchlistItem[];
  updatedAt: string;
};

type AssetDetail = WatchlistItem & {
  previousClose?: number;
  marketTime?: string;
  news?: NewsItem[];
  inWatchlist: boolean;
  watchlistId?: string;
  lots: PositionLot[];
  profile?: {
    exchange?: string;
    industry?: string;
    weburl?: string;
    currency?: string;
    country?: string;
    marketCapRank?: number;
    marketCap?: number;
    high24h?: number;
    low24h?: number;
    totalVolume?: number;
  };
};

type Settings = {
  theme: "light" | "dark" | "system";
  accent: "emerald" | "blue" | "rose" | "amber";
  currency: CurrencyCode;
  language: LanguageCode;
};

type ExchangeRateState = {
  currency: CurrencyCode;
  rate: number;
  asOf?: string;
};

type PortfolioBackupFile = {
  format: string;
  version: number;
  exportedAt: string;
  lots: unknown[];
  watchlist: unknown[];
  settings: Partial<Settings>;
  favorites?: string[];
};

type BackupRestoreResponse = {
  restored: {
    favorites: string[];
  };
};

type View = "overview" | "holdings" | "watchlist" | "analytics" | "settings";
type HoldingSort = "value" | "return" | "day" | "ticker";
type WatchlistSort = "day" | "price" | "ticker";
type Notice = { message: string; tone: "success" | "info" };

const defaultSettings: Settings = {
  theme: "system",
  accent: "emerald",
  currency: "USD",
  language: "en"
};

const devicePreferencesKey = "portfolio-device-preferences";

function readDevicePreferences(): Partial<Pick<Settings, "language" | "currency">> {
  try {
    const stored = window.localStorage.getItem(devicePreferencesKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as { language?: unknown; currency?: unknown };
    return {
      ...(isLanguageCode(parsed.language) ? { language: parsed.language } : {}),
      ...(isCurrencyCode(parsed.currency) ? { currency: parsed.currency } : {})
    };
  } catch {
    return {};
  }
}

function saveDevicePreferences(language: LanguageCode, currency: CurrencyCode) {
  try {
    window.localStorage.setItem(devicePreferencesKey, JSON.stringify({ language, currency }));
  } catch {
    // Private browsing or restricted storage should not block onboarding.
  }
}

const CurrencyContext = createContext<ExchangeRateState>({ currency: "USD", rate: 1 });
const LanguageContext = createContext({
  language: "en" as LanguageCode,
  locale: "en-US",
  t: (key: TranslationKey, values?: Record<string, string | number>) => translate("en", key, values)
});

function useLanguage() {
  return useContext(LanguageContext);
}

function useCurrencyDisplay() {
  const { currency, rate } = useContext(CurrencyContext);
  const { locale } = useLanguage();
  return {
    currency,
    rate,
    formatMoney: (value: number | null | undefined) =>
      formatCurrency(value === null || value === undefined ? value : value * rate, currency, { locale }),
    formatCompactMoney: (value: number | null | undefined) =>
      formatCurrency(value === null || value === undefined ? value : value * rate, currency, { compact: true, locale }),
    formatEnteredMoney: (value: number | null | undefined) => formatCurrency(value, currency, { locale }),
    toDisplayValue: (usdValue: number) => usdValue * rate
  };
}

function enteredAmountToUsd(value: string, rate: number) {
  if (!value.trim()) return value;
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount / rate) : value;
}

const allocationColors = ["#0891b2", "#10b981", "#f59e0b", "#f43f5e", "#6366f1", "#14b8a6"];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const responseError = body?.error;
    const fieldMessage = responseError && typeof responseError === "object"
      ? Object.values(responseError.fieldErrors ?? {}).flat().find((message) => typeof message === "string")
      : undefined;
    throw new Error(
      typeof responseError === "string"
        ? responseError
        : typeof fieldMessage === "string"
          ? fieldMessage
          : "The request failed. Please try again."
    );
  }
  return response.json() as Promise<T>;
}

function useTheme(settings: Settings) {
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => setSystemDark(media.matches);
    updateSystemTheme();
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, []);

  const shouldDark = settings.theme === "dark" || (settings.theme === "system" && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", shouldDark);
    root.classList.remove("accent-emerald", "accent-blue", "accent-rose", "accent-amber");
    root.classList.add(`accent-${settings.accent}`);
  }, [settings.accent, shouldDark]);

  return shouldDark;
}

function useDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => setIsDesktop(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  return isDesktop;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function assetFromSearch(query: string, results: TickerSearchResult[], assetType: AssetType) {
  const trimmed = query.trim();
  const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const matchingResult = results.find((result) => {
    const searchable = `${result.ticker} ${result.name}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
  if (matchingResult) return matchingResult;
  if (assetType === "stock" && /^[A-Za-z0-9.-]{1,12}$/.test(trimmed)) {
    const ticker = normalizeTicker(trimmed);
    return { assetType: "stock" as const, assetId: ticker, ticker, name: ticker };
  }
  return null;
}

function sortWithFavorites<T extends AssetIdentity>(
  items: T[],
  favorites: Set<string>,
  compare: (a: T, b: T) => number
) {
  return [...items].sort((a, b) => {
    const favoriteDifference = Number(favorites.has(assetKey(b))) - Number(favorites.has(assetKey(a)));
    return favoriteDifference || compare(a, b);
  });
}

function assetRoute(asset: AssetIdentity, refresh = false) {
  const path = asset.assetType === "crypto"
    ? `/api/crypto/${encodeURIComponent(asset.assetId ?? "")}`
    : `/api/stocks/${encodeURIComponent(normalizeTicker(asset.ticker))}`;
  return `${path}${refresh ? "?refresh=true" : ""}`;
}

function relativeRefreshText(
  updatedAt: string | undefined,
  now: number,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
) {
  if (!updatedAt) return t("loadingPrices");
  const nextRefresh = new Date(updatedAt).getTime() + 30 * 60 * 1000;
  const minutes = Math.max(0, Math.ceil((nextRefresh - now) / 60000));
  return minutes > 0 ? t("nextCheckMinutes", { minutes }) : t("nextCheckDue");
}

type PriceStatusState = "refreshing" | "loading" | "waiting" | "fresh" | "cached" | "stale";

function priceStatus(summary: PortfolioSummary | null, refreshing: boolean, now: number): PriceStatusState {
  if (refreshing) return "refreshing";
  if (!summary) return "loading";
  if (summary.holdings.length + summary.watchlist.length === 0) return "waiting";

  const updatedAt = Date.parse(summary.updatedAt);
  if (!Number.isFinite(updatedAt)) return "stale";
  const ageMinutes = Math.max(0, now - updatedAt) / 60000;
  if (ageMinutes <= 35) return "fresh";
  if (ageMinutes <= 120) return "cached";
  return "stale";
}

function filterChartRange<T extends { date: string }>(
  data: T[],
  range: "week" | "month" | "quarter" | "year" | "all"
) {
  if (range === "all" || data.length < 2) return data;
  const days = range === "week" ? 7 : range === "month" ? 30 : range === "quarter" ? 90 : 365;
  const latest = Date.parse(data.at(-1)?.date ?? "");
  if (Number.isNaN(latest)) return data;
  const cutoff = latest - (days - 1) * 24 * 60 * 60 * 1000;
  return data.filter((point) => {
    const pointTime = Date.parse(point.date);
    return Number.isNaN(pointTime) || pointTime >= cutoff;
  });
}

function lastPriceOnOrBefore(chart: ChartPoint[] | undefined, date: string) {
  if (!chart?.length) return undefined;
  let latest: number | undefined;
  for (const point of chart) {
    if (point.date > date) break;
    latest = point.price;
  }
  return latest;
}

export function Dashboard() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "news">("overview");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateState>({ currency: "USD", rate: 1 });
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [showLanguagePrompt, setShowLanguagePrompt] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [activeView, setActiveView] = useState<View>("overview");
  const [searchTicker, setSearchTicker] = useState("");
  const [searchAssetType, setSearchAssetType] = useState<AssetType>("stock");
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [searchingSymbols, setSearchingSymbols] = useState(false);
  const [quickPosition, setQuickPosition] = useState<TickerSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [favoriteTickers, setFavoriteTickers] = useState<string[]>([]);
  const [holdingSort, setHoldingSort] = useState<HoldingSort>("value");
  const [watchlistSort, setWatchlistSort] = useState<WatchlistSort>("day");
  const [clock, setClock] = useState(() => Date.now());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const favoritesLoaded = useRef(false);
  const languageRef = useRef<LanguageCode>(settings.language);
  languageRef.current = settings.language;

  const isDarkMode = useTheme(settings);
  const isDesktopViewport = useDesktopViewport();

  const densityClass = "text-sm";
  const locale = languageLocale(settings.language);
  const t = useCallback(
    (key: TranslationKey, values?: Record<string, string | number>) => translate(languageRef.current, key, values),
    []
  );
  const money = (value: number | null | undefined) =>
    formatCurrency(value === null || value === undefined ? value : value * exchangeRate.rate, exchangeRate.currency, { locale });

  useEffect(() => {
    document.documentElement.lang = settings.language;
    document.title = translate(settings.language, "myPortfolio");
  }, [settings.language]);

  function focusPortfolioSearch() {
    setQuickPosition(null);
    setSearchTicker("");
    setSearchResults([]);
    window.requestAnimationFrame(() => {
      searchInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      searchInputRef.current?.focus();
    });
  }

  const loadSummary = useCallback(async (force = false, announce = false) => {
    setError(null);
    if (force) setRefreshing(true);
    try {
      const data = await api<PortfolioSummary>("/api/summary", {
        method: force ? "POST" : "GET"
      });
      setSummary(data);
      setClock(Date.now());
      if (announce) {
        setNotice({ tone: "success", message: t("pricesRefreshed") });
      }
    } catch (loadError) {
      setError(errorMessage(loadError, t("unableLoadPortfolio")));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  async function loadDetail(asset: AssetIdentity, refresh = false) {
    const key = assetKey(asset);
    if (!asset.assetId && asset.assetType === "crypto") {
      setError(t("chooseMatchingCrypto"));
      return;
    }
    setBusy(`detail-${key}`);
    setError(null);
    try {
      const data = await api<AssetDetail>(assetRoute(asset, refresh));
      setDetail(data);
      setDetailTab("overview");
    } catch (detailError) {
      setError(errorMessage(detailError, t("unableLoadDetails")));
    } finally {
      setBusy(null);
    }
  }

  const loadExchangeRate = useCallback(async (currency: CurrencyCode) => {
    setCurrencyLoading(true);
    try {
      const rate = currency === "USD"
        ? { currency: "USD" as const, rate: 1, asOf: new Date().toISOString().slice(0, 10) }
        : await api<ExchangeRateState>(`/api/exchange-rate?currency=${currency}`);
      setExchangeRate(rate);
      return rate;
    } finally {
      setCurrencyLoading(false);
    }
  }, []);

  async function saveSettings(next: Partial<Settings>) {
    const previousSettings = settings;
    const previousRate = exchangeRate;
    const merged = { ...settings, ...next };
    setSettings(merged);
    try {
      if (next.currency && next.currency !== exchangeRate.currency) {
        await loadExchangeRate(next.currency);
      }
      await api("/api/settings", { method: "PUT", body: JSON.stringify(next) });
    } catch (settingsError) {
      setSettings(previousSettings);
      setExchangeRate(previousRate);
      setError(errorMessage(settingsError, t("unableUpdateSettings")));
    }
  }

  async function completeLanguageSelection(language: LanguageCode, currency: CurrencyCode) {
    let effectiveCurrency = currency;
    setLanguageSaving(true);
    setSettings((current) => ({ ...current, language, currency }));
    saveDevicePreferences(language, currency);
    setShowLanguagePrompt(false);

    let syncFailed = false;
    try {
      if (currency !== exchangeRate.currency) {
        await loadExchangeRate(currency);
      }
    } catch {
      syncFailed = true;
      setSettings((current) => ({ ...current, currency: "USD" }));
      setExchangeRate({ currency: "USD", rate: 1 });
      saveDevicePreferences(language, "USD");
      effectiveCurrency = "USD";
    }

    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ language, currency: effectiveCurrency }) });
    } catch {
      syncFailed = true;
    } finally {
      setLanguageSaving(false);
    }

    if (syncFailed) {
      setNotice({ tone: "info", message: translate(language, "preferencesSavedOnDevice") });
    }
  }

  async function resolveSearchAsset() {
    const existingAsset = assetFromSearch(searchTicker, searchResults, searchAssetType);
    if (existingAsset) return existingAsset;

    const query = searchTicker.trim();
    if (query.length < 2) return null;

    const data = await api<SearchResponse>(
      `/api/search?query=${encodeURIComponent(query)}&type=${searchAssetType}`
    );
    setSearchResults(data.results);
    return data.results[0] ?? null;
  }

  async function searchAsset(event: FormEvent) {
    event.preventDefault();
    const asset = await resolveSearchAsset();
    if (!asset) {
      setError(searchAssetType === "crypto" ? t("chooseMatchingCrypto") : t("chooseMatchingAsset"));
      return;
    }
    setSearchTicker(asset.ticker);
    setSearchResults([]);
    await loadDetail(asset);
  }

  async function addAssetToWatchlist(assetInput?: AssetIdentity, options: { openDetail?: boolean; switchView?: boolean } = {}) {
    const asset = assetInput ?? await resolveSearchAsset();
    if (!asset) {
      setError(searchAssetType === "crypto" ? t("chooseMatchingCrypto") : t("chooseMatchingAsset"));
      return;
    }
    const key = assetKey(asset);
    setBusy(`watchlist-${key}`);
    setError(null);
    try {
      await api("/api/watchlist", { method: "POST", body: JSON.stringify(asset) });
      setSearchTicker("");
      setSearchResults([]);
      await loadSummary();
      if (options.openDetail || (detail && assetKey(detail) === key)) await loadDetail(asset);
      if (options.switchView ?? true) setActiveView("watchlist");
      setNotice({ tone: "success", message: t("addedToWatchlist", { ticker: asset.ticker }) });
    } catch (watchlistError) {
      setError(errorMessage(watchlistError, t("requestFailed")));
    } finally {
      setBusy(null);
    }
  }

  function startPosition(asset: AssetIdentity, name?: string) {
    const ticker = normalizeTicker(asset.ticker);
    if (!ticker || (asset.assetType === "crypto" && !asset.assetId)) {
      setError(t("chooseAssetFirst"));
      return;
    }
    setQuickPosition({
      assetType: asset.assetType,
      assetId: asset.assetType === "crypto" ? asset.assetId ?? "" : ticker,
      ticker,
      name: name ?? ticker
    });
    setSearchTicker("");
    setSearchResults([]);
    setDetail(null);
    setActiveView("overview");
  }

  function startPositionFromSearch(result: TickerSearchResult) {
    setQuickPosition(result);
    setSearchTicker("");
    setSearchResults([]);
    setDetail(null);
    setActiveView("overview");
  }

  async function openSearchResult(result: TickerSearchResult) {
    setSearchTicker(result.ticker);
    setSearchResults([]);
    await loadDetail(result);
  }

  async function saveQuickPosition(form: PositionForm) {
    setBusy("quick-position");
    setError(null);
    try {
      const payload = {
        ...form,
        totalInvested: enteredAmountToUsd(form.totalInvested, exchangeRate.rate)
      };
      const saved = await api<SavedPosition>("/api/lots", { method: "POST", body: JSON.stringify(payload) });
      setQuickPosition(null);
      await loadSummary();
      setActiveView("overview");
      const adjustment = saved.splitAdjustment;
      setNotice({
        tone: "success",
        message:
          adjustment.factor !== 1
            ? t("splitPositionAdded", {
                ticker: normalizeTicker(form.ticker),
                original: formatNumber(adjustment.originalShares, 4),
                adjusted: formatNumber(adjustment.adjustedShares, 4)
              })
            : t("addedToPortfolioNotice", { ticker: normalizeTicker(form.ticker) })
      });
    } catch (positionError) {
      setError(errorMessage(positionError, t("requestFailed")));
    } finally {
      setBusy(null);
    }
  }

  async function deleteWatchlistItem(item: Pick<WatchlistItem, "id" | "assetType" | "assetId" | "ticker">) {
    if (!window.confirm(t("confirmRemoveWatchlist", { ticker: item.ticker }))) return;
    setError(null);
    try {
      await api(`/api/watchlist/${item.id}`, { method: "DELETE" });
      if (detail && assetKey(detail) === assetKey(item)) {
        setDetail((current) => current ? { ...current, inWatchlist: false, watchlistId: undefined } : current);
      }
      await loadSummary();
      setNotice({ tone: "info", message: t("removedFromWatchlistNotice", { ticker: item.ticker }) });
    } catch (deleteError) {
      setError(errorMessage(deleteError, t("requestFailed")));
    }
  }

  async function deleteLot(id: string, asset: AssetIdentity) {
    if (!window.confirm(t("confirmDeleteLot", { ticker: asset.ticker }))) return;
    setError(null);
    try {
      await api(`/api/lots/${id}`, { method: "DELETE" });
      await Promise.all([loadSummary(), loadDetail(asset)]);
      setNotice({ tone: "info", message: t("purchaseLotDeleted", { ticker: asset.ticker }) });
    } catch (deleteError) {
      setError(errorMessage(deleteError, t("requestFailed")));
    }
  }

  async function updateLot(
    id: string,
    asset: AssetIdentity,
    form: PositionUpdateForm
  ) {
    setBusy(`lot-${id}`);
    setError(null);
    try {
      const payload = {
        ...form,
        totalInvested: enteredAmountToUsd(form.totalInvested, exchangeRate.rate)
      };
      await api(`/api/lots/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await Promise.all([loadSummary(), loadDetail(asset)]);
      setNotice({ tone: "success", message: t("purchaseLotUpdated", { ticker: asset.ticker }) });
    } catch (updateError) {
      setError(errorMessage(updateError, t("requestFailed")));
      throw updateError;
    } finally {
      setBusy(null);
    }
  }

  async function removeHolding(holding: Holding) {
    if (!holding.lots.length) return;
    if (!window.confirm(t("confirmRemovePortfolio", { ticker: holding.ticker }))) return;

    const key = assetKey(holding);
    setBusy(`remove-${key}`);
    setError(null);
    try {
      await Promise.all(holding.lots.map((lot) => api(`/api/lots/${lot.id}`, { method: "DELETE" })));
      if (detail && assetKey(detail) === key) setDetail(null);
      await loadSummary();
      setNotice({ tone: "info", message: t("removedFromPortfolioNotice", { ticker: holding.ticker }) });
    } catch (deleteError) {
      setError(errorMessage(deleteError, t("requestFailed")));
    } finally {
      setBusy(null);
    }
  }

  function toggleFavorite(asset: AssetIdentity) {
    const key = assetKey(asset);
    setFavoriteTickers((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function showAllHoldings() {
    setActiveView("holdings");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    async function loadInitialSettings() {
      const device = readDevicePreferences();
      let stored: Partial<Settings> = {};
      let serverAvailable = true;

      try {
        stored = await api<Partial<Settings>>("/api/settings");
      } catch {
        serverAvailable = false;
      }

      const currency = isCurrencyCode(stored.currency)
        ? stored.currency
        : isCurrencyCode(device.currency)
          ? device.currency
          : "USD";
      const language: LanguageCode = isLanguageCode(stored.language)
        ? stored.language
        : isLanguageCode(device.language)
          ? device.language
          : "en";
      const hasSavedLanguage = isLanguageCode(stored.language) || isLanguageCode(device.language);
      const nextSettings = { ...defaultSettings, ...stored, currency, language };
      let effectiveCurrency = currency;

      setShowLanguagePrompt(!hasSavedLanguage);
      if (hasSavedLanguage) saveDevicePreferences(language, currency);

      try {
        await loadExchangeRate(currency);
        setSettings(nextSettings);
      } catch {
        setSettings({ ...nextSettings, currency: "USD" });
        setExchangeRate({ currency: "USD", rate: 1 });
        if (hasSavedLanguage) saveDevicePreferences(language, "USD");
        effectiveCurrency = "USD";
      }

      if (serverAvailable && !isLanguageCode(stored.language) && hasSavedLanguage) {
        void api("/api/settings", {
          method: "PUT",
          body: JSON.stringify({ language, currency: effectiveCurrency })
        }).catch(() => undefined);
      }

      if (window.sessionStorage.getItem("portfolio-backup-restored") === "true") {
        window.sessionStorage.removeItem("portfolio-backup-restored");
        setNotice({ tone: "success", message: translate(language, "backupRestored") });
      }
    }

    void loadInitialSettings();
    loadSummary();
    const id = window.setInterval(() => loadSummary(true), 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [loadExchangeRate, loadSummary, t]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("portfolio-favorites");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavoriteTickers(
            parsed
              .map(String)
              .map((item) => {
                if (item.startsWith("crypto:")) return item.toLowerCase();
                if (item.startsWith("stock:")) return `stock:${normalizeTicker(item.slice(6))}`;
                return `stock:${normalizeTicker(item)}`;
              })
              .filter(Boolean)
          );
        }
      }
    } catch {
      setFavoriteTickers([]);
    } finally {
      favoritesLoaded.current = true;
    }
  }, []);

  useEffect(() => {
    if (!favoritesLoaded.current) return;
    window.localStorage.setItem("portfolio-favorites", JSON.stringify(favoriteTickers));
  }, [favoriteTickers]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    const query = searchTicker.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchingSymbols(false);
      return;
    }

    let cancelled = false;
    const id = window.setTimeout(async () => {
      setSearchingSymbols(true);
      try {
        const data = await api<SearchResponse>(
          `/api/search?query=${encodeURIComponent(query)}&type=${searchAssetType}`
        );
        if (!cancelled) {
          setSearchResults(data.results);
          setError(null);
        }
      } catch (searchError) {
        if (!cancelled) {
          setSearchResults([]);
          setError(errorMessage(searchError, t("requestFailed")));
        }
      } finally {
        if (!cancelled) setSearchingSymbols(false);
      }
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [searchAssetType, searchTicker, t]);

  const allocationData = useMemo(
    () => {
      const totalValue = summary?.totalValue ?? 0;
      return summary?.holdings.map((holding) => ({
        key: assetKey(holding),
        ticker: holding.ticker,
        name: holding.companyName ?? holding.ticker,
        value: Number(holding.currentValue.toFixed(2)),
        percent: totalValue ? (holding.currentValue / totalValue) * 100 : 0
      })) ?? [];
    },
    [summary?.holdings, summary?.totalValue]
  );

  const favorites = useMemo(() => new Set(favoriteTickers), [favoriteTickers]);

  const sortedHoldings = useMemo(() => {
    const holdings = summary?.holdings ?? [];
    return sortWithFavorites(holdings, favorites, (a, b) => {
      if (holdingSort === "ticker") return a.ticker.localeCompare(b.ticker);
      if (holdingSort === "return") return b.gainLossPercent - a.gainLossPercent;
      if (holdingSort === "day") return b.dailyPercent - a.dailyPercent;
      return b.currentValue - a.currentValue;
    });
  }, [favorites, holdingSort, summary?.holdings]);

  const sortedWatchlist = useMemo(() => {
    const watchlist = summary?.watchlist ?? [];
    return sortWithFavorites(watchlist, favorites, (a, b) => {
      if (watchlistSort === "ticker") return a.ticker.localeCompare(b.ticker);
      if (watchlistSort === "price") return b.currentPrice - a.currentPrice;
      return b.dailyPercent - a.dailyPercent;
    });
  }, [favorites, summary?.watchlist, watchlistSort]);

  const dayChangePercent = useMemo(() => {
    const previousValue = (summary?.totalValue ?? 0) - (summary?.dayChangeEstimate ?? 0);
    return previousValue ? ((summary?.dayChangeEstimate ?? 0) / previousValue) * 100 : 0;
  }, [summary?.dayChangeEstimate, summary?.totalValue]);

  const performanceData = useMemo(
    () =>
      summary?.holdings.map((holding) => ({
        ticker: holding.ticker,
        value: Number(holding.currentValue.toFixed(2)),
        cost: Number(holding.totalCost.toFixed(2)),
        gain: Number(holding.gainLoss.toFixed(2))
      })) ?? [],
    [summary]
  );

  const portfolioHistory = useMemo(() => {
    const holdings = summary?.holdings ?? [];
    const dates = Array.from(new Set(holdings.flatMap((holding) => holding.chart?.map((point) => point.date) ?? [])))
      .sort((a, b) => {
        const aTime = Date.parse(a);
        const bTime = Date.parse(b);
        return Number.isNaN(aTime) || Number.isNaN(bTime) ? a.localeCompare(b) : aTime - bTime;
      });

    return dates
      .map((date) => ({
        date,
        value: holdings.reduce((total, holding) => {
          const shares = holding.lots.reduce(
            (sum, lot) => lot.purchaseDate.slice(0, 10) <= date ? sum + lot.shares : sum,
            0
          );
          const price = holding.chart?.length
            ? lastPriceOnOrBefore(holding.chart, date)
            : holding.currentPrice;
          return total + (price ?? 0) * shares;
        }, 0)
      }))
      .filter((point) => point.value > 0);
  }, [summary?.holdings]);

  const recentPurchases = useMemo(
    () =>
      (summary?.holdings ?? [])
        .flatMap((holding) =>
          holding.lots.map((lot) => ({
            holding,
            lot,
            total: (lot.originalShares ?? lot.shares) * (lot.originalPurchasePrice ?? lot.purchasePrice)
          }))
        )
        .sort((a, b) => new Date(b.lot.purchaseDate).getTime() - new Date(a.lot.purchaseDate).getTime())
        .slice(0, 4),
    [summary?.holdings]
  );

  const navItems: Array<{ view: View; label: string; icon: LucideIcon; meta?: string }> = [
    { view: "overview", label: t("dashboard"), icon: LayoutDashboard },
    { view: "holdings", label: t("portfolio"), icon: Briefcase, meta: String(summary?.holdings.length ?? 0) },
    { view: "watchlist", label: t("watchlist"), icon: BellPlus, meta: String(summary?.watchlist.length ?? 0) },
    { view: "analytics", label: t("analytics"), icon: BarChart3 },
    { view: "settings", label: t("settings"), icon: Settings2 }
  ];

  return (
    <LanguageContext.Provider value={{ language: settings.language, locale, t }}>
      <CurrencyContext.Provider value={exchangeRate}>
        <main className={cn("min-h-screen overflow-x-clip bg-background", densityClass)}>
          {isDesktopViewport === null ? <div className="min-h-screen bg-background" aria-hidden="true" /> : null}

          {isDesktopViewport === false ? <MobilePortfolioApp
            activeView={activeView}
            onNavigate={setActiveView}
            summary={summary}
            holdings={sortedHoldings}
            watchlist={sortedWatchlist}
            allocationData={allocationData}
            performanceData={performanceData}
            portfolioHistory={portfolioHistory}
            recentPurchases={recentPurchases}
            loading={loading}
            refreshing={refreshing}
            clock={clock}
            darkMode={isDarkMode}
            error={error}
            notice={notice}
            quickPosition={quickPosition}
            busy={busy}
            favorites={favorites}
            holdingSort={holdingSort}
            watchlistSort={watchlistSort}
            settings={settings}
            currencyLoading={currencyLoading}
            searchInputRef={mobileSearchInputRef}
            searchAssetType={searchAssetType}
            searchTicker={searchTicker}
            searchResults={searchResults}
            searchingSymbols={searchingSymbols}
            onDismissError={() => setError(null)}
            onDismissNotice={() => setNotice(null)}
            onRefresh={() => loadSummary(true, true)}
            onToggleTheme={() => saveSettings({ theme: isDarkMode ? "light" : "dark" })}
            onSelectAsset={loadDetail}
            onRemoveHolding={removeHolding}
            onToggleFavorite={toggleFavorite}
            onDeleteWatchlist={deleteWatchlistItem}
            onStartPosition={startPosition}
            onCancelQuickPosition={() => setQuickPosition(null)}
            onSaveQuickPosition={saveQuickPosition}
            onHoldingSortChange={setHoldingSort}
            onWatchlistSortChange={setWatchlistSort}
            onSaveSettings={saveSettings}
            onSearchAsset={searchAsset}
            onSearchAssetTypeChange={(assetType) => {
              setSearchAssetType(assetType);
              setSearchTicker("");
              setSearchResults([]);
              setError(null);
            }}
            onSearchTickerChange={setSearchTicker}
            onSelectSearchResult={openSearchResult}
            onAddSearchResultWatchlist={(result) => addAssetToWatchlist(result)}
            onAddSearchResultPosition={startPositionFromSearch}
          /> : null}

          {isDesktopViewport === true ? <div className="mx-auto hidden min-h-screen w-full max-w-[1600px] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
            <PortfolioSidebar
              activeView={activeView}
              navItems={navItems}
              summary={summary}
              watchlist={sortedWatchlist}
              darkMode={isDarkMode}
              onNavigate={setActiveView}
              onSelectWatchlist={loadDetail}
              onToggleTheme={() => saveSettings({ theme: isDarkMode ? "light" : "dark" })}
            />

            <div className="min-w-0 px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6 lg:px-8">
              <header className="grid gap-4 border-b pb-5 xl:grid-cols-[minmax(260px,1fr)_minmax(440px,640px)_auto] xl:items-start">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
                    {activeView === "overview" ? t("welcomeBack") : navItems.find((item) => item.view === activeView)?.label}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeView === "overview"
                      ? t("portfolioToday")
                      : activeView === "holdings"
                        ? t("positionsTracked", { count: summary?.holdings.length ?? 0 })
                        : activeView === "watchlist"
                          ? t("symbolsSaved", { count: summary?.watchlist.length ?? 0 })
                          : activeView === "analytics"
                            ? t("portfolioPerformance")
                            : t("settings")}
                  </p>
                  <div className="mt-3">
                    <RefreshStatus summary={summary} refreshing={refreshing} clock={clock} />
                  </div>
                </div>

                <TopAssetSearch
                  searchInputRef={searchInputRef}
                  assetType={searchAssetType}
                  setAssetType={(assetType) => {
                    setSearchAssetType(assetType);
                    setSearchTicker("");
                    setSearchResults([]);
                    setError(null);
                  }}
                  ticker={searchTicker}
                  setTicker={setSearchTicker}
                  results={searchResults}
                  searching={searchingSymbols}
                  busy={busy}
                  onSearch={searchAsset}
                  onSelectResult={openSearchResult}
                  onAddResultWatchlist={(result) => addAssetToWatchlist(result)}
                  onAddResultPosition={startPositionFromSearch}
                />

                <div className="flex gap-2 xl:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="relative"
                    title={t("watchlist")}
                    onClick={() => setActiveView("watchlist")}
                  >
                    <BellPlus className="h-4 w-4" />
                    {summary?.watchlist.length ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" /> : null}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => loadSummary(true, true)}
                    loading={refreshing}
                    title={t("refreshPrices")}
                    aria-label={t("refreshPrices")}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </header>

              <div className="mt-5 grid gap-5">
                {quickPosition ? (
                  <QuickPositionForm
                    result={quickPosition}
                    busy={busy === "quick-position"}
                    onCancel={() => setQuickPosition(null)}
                    onSave={saveQuickPosition}
                  />
                ) : null}

                <div className="grid gap-2" aria-live="polite">
                  {error ? <StatusBanner tone="error" message={error} onClose={() => setError(null)} /> : null}
                  {notice ? <StatusBanner tone={notice.tone} message={notice.message} onClose={() => setNotice(null)} /> : null}
                </div>

                {activeView === "overview" ? (
                  <>
                    <section className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 2xl:grid-cols-4">
                      <Metric title={t("portfolioValue")} value={money(summary?.totalValue)} icon={WalletCards} tone="primary" />
                      <Metric
                        title={t("totalReturn")}
                        value={money(summary?.gainLoss)}
                        change={formatPercent(summary?.gainLossPercent, locale)}
                        positive={(summary?.gainLoss ?? 0) >= 0}
                        icon={(summary?.gainLoss ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight}
                        tone={(summary?.gainLoss ?? 0) >= 0 ? "gain" : "loss"}
                      />
                      <Metric
                        title={t("today")}
                        value={money(summary?.dayChangeEstimate)}
                        change={formatPercent(dayChangePercent, locale)}
                        positive={(summary?.dayChangeEstimate ?? 0) >= 0}
                        icon={CircleDollarSign}
                        tone={(summary?.dayChangeEstimate ?? 0) >= 0 ? "gain" : "loss"}
                      />
                      <Metric title={t("totalInvested")} value={money(summary?.totalCost)} icon={Briefcase} tone="warning" />
                    </section>

                    <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
                      <PortfolioPerformancePanel data={portfolioHistory} />
                      <TopHoldingsPanel
                        holdings={sortedHoldings.slice(0, 5)}
                        loading={loading}
                        onSelect={loadDetail}
                        onViewAll={showAllHoldings}
                        onAdd={focusPortfolioSearch}
                      />
                    </section>

                    <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                      <AllocationPanel allocationData={allocationData} totalValue={summary?.totalValue ?? 0} />
                      <RecentPurchasesPanel
                        purchases={recentPurchases}
                        onSelect={(holding) => loadDetail(holding)}
                        onViewAll={showAllHoldings}
                      />
                    </section>
                  </>
                ) : null}

                {activeView === "holdings" ? (
                  <Panel>
                    <PanelHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="font-semibold">{t("myPortfolio")}</h2>
                        <p className="text-xs text-muted-foreground">{t("positionsCount", { count: summary?.holdings.length ?? 0 })}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <SortSelect
                          value={holdingSort}
                          label={t("sortPortfolio")}
                          options={[
                            { value: "value", label: t("value") },
                            { value: "return", label: t("return") },
                            { value: "day", label: t("today") },
                            { value: "ticker", label: "A-Z" }
                          ]}
                          onChange={(value) => setHoldingSort(value as HoldingSort)}
                        />
                        <Button type="button" size="sm" onClick={focusPortfolioSearch}>
                          <Plus className="h-4 w-4" />
                          {t("addAsset")}
                        </Button>
                      </div>
                    </PanelHeader>
                    <PanelBody className="overflow-hidden p-0">
                      <HoldingsTable
                        holdings={sortedHoldings}
                        loading={loading}
                        onSelect={loadDetail}
                        onRemove={removeHolding}
                        busy={busy}
                        favorites={favorites}
                        onToggleFavorite={toggleFavorite}
                        onAdd={focusPortfolioSearch}
                      />
                    </PanelBody>
                  </Panel>
                ) : null}

                {activeView === "watchlist" ? (
                  <Panel>
                    <PanelHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="font-semibold">{t("watchlist")}</h2>
                        <p className="text-xs text-muted-foreground">{t("symbolsSaved", { count: summary?.watchlist.length ?? 0 })}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <SortSelect
                          value={watchlistSort}
                          label={t("sortWatchlist")}
                          options={[
                            { value: "day", label: t("today") },
                            { value: "price", label: t("price") },
                            { value: "ticker", label: "A-Z" }
                          ]}
                          onChange={(value) => setWatchlistSort(value as WatchlistSort)}
                        />
                        <Button type="button" size="sm" onClick={focusPortfolioSearch}>
                          <Plus className="h-4 w-4" />
                          {t("addAsset")}
                        </Button>
                      </div>
                    </PanelHeader>
                    <PanelBody className="p-0">
                      <div className="divide-y">
                        {sortedWatchlist.map((item) => (
                          <WatchlistRow
                            key={item.id}
                            item={item}
                            onSelect={() => loadDetail(item)}
                            onDelete={() => deleteWatchlistItem(item)}
                            onAddPosition={() => startPosition(item, item.companyName)}
                            favorite={favorites.has(assetKey(item))}
                            onToggleFavorite={() => toggleFavorite(item)}
                          />
                        ))}
                      </div>
                      {!summary?.watchlist.length && !loading ? (
                        <EmptyState
                          icon={BellPlus}
                          title={t("watchlistEmpty")}
                          description={t("watchlistEmptyDescription")}
                          actionLabel={t("findAsset")}
                          onAction={focusPortfolioSearch}
                        />
                      ) : null}
                      {loading ? <LoadingRows /> : null}
                    </PanelBody>
                  </Panel>
                ) : null}

                {activeView === "analytics" ? (
                  <section className="grid min-w-0 gap-4">
                    <PortfolioPerformancePanel data={portfolioHistory} />
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <AllocationPanel allocationData={allocationData} totalValue={summary?.totalValue ?? 0} />
                      <PerformancePanel performanceData={performanceData} />
                    </div>
                  </section>
                ) : null}

                {activeView === "settings" ? (
                  <SettingsPanel settings={settings} currencyLoading={currencyLoading} saveSettings={saveSettings} />
                ) : null}

                <footer className="flex flex-wrap items-center justify-between gap-2 border-t py-4 text-[11px] text-muted-foreground">
                  <span>Polygon · Frankfurter</span>
                  <a
                    className="inline-flex items-center gap-1 transition hover:text-foreground"
                    href="https://www.coingecko.com/en/api"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("cryptoDataBy")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </footer>
              </div>
            </div>
          </div> : null}

          {detail ? (
            <AssetDetailPanel
              detail={detail}
              tab={detailTab}
              setTab={setDetailTab}
              busy={busy}
              onClose={() => setDetail(null)}
              onRefresh={() => loadDetail(detail, true)}
              onAddWatchlist={() => addAssetToWatchlist(detail, { openDetail: true, switchView: false })}
              onRemoveWatchlist={() =>
                detail.watchlistId
                  ? deleteWatchlistItem({ id: detail.watchlistId, assetType: detail.assetType, assetId: detail.assetId, ticker: detail.ticker })
                  : Promise.resolve()
              }
              onAddPosition={() => startPosition(detail, detail.companyName)}
              onDeleteLot={(id) => deleteLot(id, detail)}
              onUpdateLot={(id, form) => updateLot(id, detail, form)}
            />
          ) : null}

          {showLanguagePrompt ? (
            <LanguagePrompt
              initialLanguage={settings.language}
              initialCurrency={settings.currency}
              busy={languageSaving}
              onContinue={completeLanguageSelection}
            />
          ) : null}
        </main>
      </CurrencyContext.Provider>
    </LanguageContext.Provider>
  );
}

function MobilePortfolioApp({
  activeView,
  onNavigate,
  summary,
  holdings,
  watchlist,
  allocationData,
  performanceData,
  portfolioHistory,
  recentPurchases,
  loading,
  refreshing,
  clock,
  darkMode,
  error,
  notice,
  quickPosition,
  busy,
  favorites,
  holdingSort,
  watchlistSort,
  settings,
  currencyLoading,
  searchInputRef,
  searchAssetType,
  searchTicker,
  searchResults,
  searchingSymbols,
  onDismissError,
  onDismissNotice,
  onRefresh,
  onToggleTheme,
  onSelectAsset,
  onRemoveHolding,
  onToggleFavorite,
  onDeleteWatchlist,
  onStartPosition,
  onCancelQuickPosition,
  onSaveQuickPosition,
  onHoldingSortChange,
  onWatchlistSortChange,
  onSaveSettings,
  onSearchAsset,
  onSearchAssetTypeChange,
  onSearchTickerChange,
  onSelectSearchResult,
  onAddSearchResultWatchlist,
  onAddSearchResultPosition
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  summary: PortfolioSummary | null;
  holdings: Holding[];
  watchlist: WatchlistItem[];
  allocationData: Array<{ key: string; ticker: string; name: string; value: number; percent: number }>;
  performanceData: Array<{ ticker: string; value: number; cost: number; gain: number }>;
  portfolioHistory: Array<{ date: string; value: number }>;
  recentPurchases: Array<{ holding: Holding; lot: PositionLot; total: number }>;
  loading: boolean;
  refreshing: boolean;
  clock: number;
  darkMode: boolean;
  error: string | null;
  notice: Notice | null;
  quickPosition: TickerSearchResult | null;
  busy: string | null;
  favorites: Set<string>;
  holdingSort: HoldingSort;
  watchlistSort: WatchlistSort;
  settings: Settings;
  currencyLoading: boolean;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchAssetType: AssetType;
  searchTicker: string;
  searchResults: TickerSearchResult[];
  searchingSymbols: boolean;
  onDismissError: () => void;
  onDismissNotice: () => void;
  onRefresh: () => Promise<void>;
  onToggleTheme: () => Promise<void>;
  onSelectAsset: (asset: AssetIdentity) => Promise<void>;
  onRemoveHolding: (holding: Holding) => Promise<void>;
  onToggleFavorite: (asset: AssetIdentity) => void;
  onDeleteWatchlist: (item: Pick<WatchlistItem, "id" | "assetType" | "assetId" | "ticker">) => Promise<void>;
  onStartPosition: (asset: AssetIdentity, name?: string) => void;
  onCancelQuickPosition: () => void;
  onSaveQuickPosition: (form: PositionForm) => Promise<void>;
  onHoldingSortChange: (sort: HoldingSort) => void;
  onWatchlistSortChange: (sort: WatchlistSort) => void;
  onSaveSettings: (settings: Partial<Settings>) => Promise<void>;
  onSearchAsset: (event: FormEvent) => Promise<void>;
  onSearchAssetTypeChange: (assetType: AssetType) => void;
  onSearchTickerChange: (ticker: string) => void;
  onSelectSearchResult: (result: TickerSearchResult) => Promise<void>;
  onAddSearchResultWatchlist: (result: TickerSearchResult) => Promise<void>;
  onAddSearchResultPosition: (result: TickerSearchResult) => void;
}) {
  const { t } = useLanguage();
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const modalOpen = searchOpen || moreOpen || activityOpen;

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  function navigate(view: View) {
    setMoreOpen(false);
    setActivityOpen(false);
    onNavigate(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSearch() {
    setMoreOpen(false);
    setSearchOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  const title = activeView === "overview"
    ? t("dashboard")
    : activeView === "holdings"
      ? t("portfolio")
      : activeView === "watchlist"
        ? t("watchlist")
        : activeView === "analytics"
          ? t("analytics")
          : t("settings");
  const moreActive = activeView === "watchlist" || activeView === "settings";

  return (
    <div className="min-h-screen bg-background lg:hidden">
      <div className="mx-auto min-h-screen w-full max-w-lg pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <header className="sticky top-0 z-20 border-b bg-background/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-3xl font-semibold">{title}</h1>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-md border bg-card text-muted-foreground transition hover:text-primary"
                title={t("searchAssets")}
                aria-label={t("searchAssets")}
                onClick={openSearch}
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="relative flex h-11 w-11 items-center justify-center rounded-md border bg-card text-muted-foreground transition hover:text-primary"
                title={t("watchlist")}
                aria-label={t("watchlist")}
                onClick={() => navigate("watchlist")}
              >
                <BellPlus className="h-5 w-5" />
                {watchlist.length ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" /> : null}
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 px-3 py-4">
          <div className="grid gap-2" aria-live="polite">
            {error ? <StatusBanner tone="error" message={error} onClose={onDismissError} /> : null}
            {notice ? <StatusBanner tone={notice.tone} message={notice.message} onClose={onDismissNotice} /> : null}
          </div>

          {quickPosition ? (
            <QuickPositionForm
              result={quickPosition}
              busy={busy === "quick-position"}
              onCancel={onCancelQuickPosition}
              onSave={onSaveQuickPosition}
            />
          ) : null}

          {activeView === "overview" ? (
            <MobileDashboardOverview
              summary={summary}
              holdings={holdings}
              allocationData={allocationData}
              portfolioHistory={portfolioHistory}
              recentPurchases={recentPurchases}
              loading={loading}
              refreshing={refreshing}
              clock={clock}
              onSelectAsset={onSelectAsset}
              onViewHoldings={() => navigate("holdings")}
              onViewWatchlist={() => navigate("watchlist")}
              onOpenActivity={() => setActivityOpen(true)}
            />
          ) : null}

          {activeView === "holdings" ? (
            <Panel>
              <PanelHeader className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{t("myPortfolio")}</h2>
                  <p className="text-xs text-muted-foreground">{t("positionsCount", { count: holdings.length })}</p>
                </div>
                <Button type="button" size="icon" title={t("addAsset")} aria-label={t("addAsset")} onClick={openSearch}>
                  <Plus className="h-4 w-4" />
                </Button>
              </PanelHeader>
              <div className="border-y px-4 py-3">
                <SortSelect
                  value={holdingSort}
                  label={t("sortPortfolio")}
                  options={[
                    { value: "value", label: t("value") },
                    { value: "return", label: t("return") },
                    { value: "day", label: t("today") },
                    { value: "ticker", label: "A-Z" }
                  ]}
                  onChange={(value) => onHoldingSortChange(value as HoldingSort)}
                />
              </div>
              <PanelBody className="overflow-hidden p-0">
                <HoldingsTable
                  holdings={holdings}
                  loading={loading}
                  onSelect={onSelectAsset}
                  onRemove={onRemoveHolding}
                  busy={busy}
                  favorites={favorites}
                  onToggleFavorite={onToggleFavorite}
                  onAdd={openSearch}
                />
              </PanelBody>
            </Panel>
          ) : null}

          {activeView === "watchlist" ? (
            <Panel>
              <PanelHeader className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{t("watchlist")}</h2>
                  <p className="text-xs text-muted-foreground">{t("symbolsSaved", { count: watchlist.length })}</p>
                </div>
                <Button type="button" size="icon" title={t("addAsset")} aria-label={t("addAsset")} onClick={openSearch}>
                  <Plus className="h-4 w-4" />
                </Button>
              </PanelHeader>
              <div className="border-y px-4 py-3">
                <SortSelect
                  value={watchlistSort}
                  label={t("sortWatchlist")}
                  options={[
                    { value: "day", label: t("today") },
                    { value: "price", label: t("price") },
                    { value: "ticker", label: "A-Z" }
                  ]}
                  onChange={(value) => onWatchlistSortChange(value as WatchlistSort)}
                />
              </div>
              <PanelBody className="p-0">
                <div className="divide-y">
                  {watchlist.map((item) => (
                    <WatchlistRow
                      key={item.id}
                      item={item}
                      onSelect={() => onSelectAsset(item)}
                      onDelete={() => onDeleteWatchlist(item)}
                      onAddPosition={() => onStartPosition(item, item.companyName)}
                      favorite={favorites.has(assetKey(item))}
                      onToggleFavorite={() => onToggleFavorite(item)}
                    />
                  ))}
                </div>
                {!watchlist.length && !loading ? (
                  <EmptyState
                    icon={BellPlus}
                    title={t("watchlistEmpty")}
                    description={t("watchlistEmptyDescription")}
                    actionLabel={t("findAsset")}
                    onAction={openSearch}
                  />
                ) : null}
                {loading ? <LoadingRows /> : null}
              </PanelBody>
            </Panel>
          ) : null}

          {activeView === "analytics" ? (
            <div className="grid gap-4">
              <MobilePortfolioHero summary={summary} data={portfolioHistory} refreshing={refreshing} clock={clock} />
              <MobileAllocationCard allocationData={allocationData} totalValue={summary?.totalValue ?? 0} />
              <PerformancePanel performanceData={performanceData} />
            </div>
          ) : null}

          {activeView === "settings" ? (
            <SettingsPanel settings={settings} currencyLoading={currencyLoading} saveSettings={onSaveSettings} />
          ) : null}
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
        aria-label={t("mainNavigation")}
      >
        <div className="mx-auto grid h-[72px] max-w-lg grid-cols-4 px-2">
          <MobileNavButton icon={LayoutDashboard} label={t("dashboard")} active={activeView === "overview"} onClick={() => navigate("overview")} />
          <MobileNavButton icon={Briefcase} label={t("portfolio")} active={activeView === "holdings"} onClick={() => navigate("holdings")} />
          <MobileNavButton icon={BarChart3} label={t("analytics")} active={activeView === "analytics"} onClick={() => navigate("analytics")} />
          <MobileNavButton icon={Ellipsis} label={t("more")} active={moreActive || moreOpen} onClick={() => setMoreOpen(true)} />
        </div>
      </nav>

      {searchOpen ? (
        <div className="fixed inset-0 z-50 bg-background p-3 pt-[max(1rem,env(safe-area-inset-top))]" role="dialog" aria-modal="true" aria-label={t("searchAssets")}>
          <div className="mx-auto grid w-full max-w-lg gap-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{t("searchAssets")}</h2>
              <Button type="button" variant="secondary" size="icon" title={t("dismiss")} aria-label={t("dismiss")} onClick={() => setSearchOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <TopAssetSearch
              inputId="mobile-asset-search"
              searchInputRef={searchInputRef}
              assetType={searchAssetType}
              setAssetType={onSearchAssetTypeChange}
              ticker={searchTicker}
              setTicker={onSearchTickerChange}
              results={searchResults}
              searching={searchingSymbols}
              busy={busy}
              onSearch={async (event) => {
                await onSearchAsset(event);
                setSearchOpen(false);
              }}
              onSelectResult={async (result) => {
                setSearchOpen(false);
                await onSelectSearchResult(result);
              }}
              onAddResultWatchlist={async (result) => {
                setSearchOpen(false);
                await onAddSearchResultWatchlist(result);
              }}
              onAddResultPosition={(result) => {
                setSearchOpen(false);
                onAddSearchResultPosition(result);
              }}
            />
          </div>
        </div>
      ) : null}

      {moreOpen ? (
        <MobileSheet title={t("more")} onClose={() => setMoreOpen(false)}>
          <div className="grid grid-cols-2 gap-2">
            <MobileSheetAction icon={BellPlus} label={t("watchlist")} onClick={() => navigate("watchlist")} />
            <MobileSheetAction icon={Settings2} label={t("settings")} onClick={() => navigate("settings")} />
            <MobileSheetAction icon={Search} label={t("addAsset")} onClick={openSearch} />
            <MobileSheetAction icon={RefreshCw} label={t("refreshPrices")} loading={refreshing} onClick={() => void onRefresh()} />
            <MobileSheetAction
              icon={darkMode ? Sun : Moon}
              label={darkMode ? t("light") : t("dark")}
              onClick={() => {
                setMoreOpen(false);
                void onToggleTheme();
              }}
            />
          </div>
        </MobileSheet>
      ) : null}

      {activityOpen ? (
        <MobileSheet title={t("recentPurchases")} onClose={() => setActivityOpen(false)}>
          <MobilePurchaseList purchases={recentPurchases} onSelectAsset={onSelectAsset} onClose={() => setActivityOpen(false)} />
        </MobileSheet>
      ) : null}
    </div>
  );
}

function MobileDashboardOverview({
  summary,
  holdings,
  allocationData,
  portfolioHistory,
  recentPurchases,
  loading,
  refreshing,
  clock,
  onSelectAsset,
  onViewHoldings,
  onViewWatchlist,
  onOpenActivity
}: {
  summary: PortfolioSummary | null;
  holdings: Holding[];
  allocationData: Array<{ key: string; ticker: string; name: string; value: number; percent: number }>;
  portfolioHistory: Array<{ date: string; value: number }>;
  recentPurchases: Array<{ holding: Holding; lot: PositionLot; total: number }>;
  loading: boolean;
  refreshing: boolean;
  clock: number;
  onSelectAsset: (asset: AssetIdentity) => Promise<void>;
  onViewHoldings: () => void;
  onViewWatchlist: () => void;
  onOpenActivity: () => void;
}) {
  const { formatCompactMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();
  const previousValue = (summary?.totalValue ?? 0) - (summary?.dayChangeEstimate ?? 0);
  const dayPercent = previousValue ? ((summary?.dayChangeEstimate ?? 0) / previousValue) * 100 : 0;

  return (
    <div className="grid gap-4">
      <MobilePortfolioHero summary={summary} data={portfolioHistory} refreshing={refreshing} clock={clock} />

      <section className="grid grid-cols-3 gap-2" aria-label={t("portfolioSnapshot")}>
        <MobileMiniMetric
          title={t("totalReturn")}
          value={formatCompactMoney(summary?.gainLoss)}
          change={formatPercent(summary?.gainLossPercent, locale)}
          positive={(summary?.gainLoss ?? 0) >= 0}
          icon={(summary?.gainLoss ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight}
        />
        <MobileMiniMetric
          title={t("today")}
          value={formatCompactMoney(summary?.dayChangeEstimate)}
          change={formatPercent(dayPercent, locale)}
          positive={(summary?.dayChangeEstimate ?? 0) >= 0}
          icon={CircleDollarSign}
        />
        <MobileMiniMetric title={t("totalInvested")} value={formatCompactMoney(summary?.totalCost)} icon={WalletCards} tone="warning" />
      </section>

      <MobileTopHoldings holdings={holdings.slice(0, 3)} loading={loading} onSelectAsset={onSelectAsset} onViewAll={onViewHoldings} />

      <section className="grid grid-cols-2 gap-2">
        <MobileQuickLink icon={Star} label={t("watchlist")} meta={t("symbolsSaved", { count: summary?.watchlist.length ?? 0 })} onClick={onViewWatchlist} />
        <MobileQuickLink icon={Activity} label={t("recentPurchases")} meta={t("entriesCount", { count: recentPurchases.length })} onClick={onOpenActivity} />
      </section>

      <MobileAllocationCard allocationData={allocationData} totalValue={summary?.totalValue ?? 0} />
    </div>
  );
}

function MobilePortfolioHero({
  summary,
  data,
  refreshing,
  clock
}: {
  summary: PortfolioSummary | null;
  data: Array<{ date: string; value: number }>;
  refreshing: boolean;
  clock: number;
}) {
  const [range, setRange] = useState<"week" | "month" | "quarter" | "year" | "all">("month");
  const { formatMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();
  const visibleData = filterChartRange(data, range);
  const chartValues = visibleData.map((point) => point.value);
  const dataMin = chartValues.length ? Math.min(...chartValues) : 0;
  const dataMax = chartValues.length ? Math.max(...chartValues) : 1;
  const spread = Math.max(dataMax - dataMin, dataMax * 0.04, 1);
  const domain: [number, number] = [Math.max(0, dataMin - spread * 0.12), dataMax + spread * 0.12];
  const dayChange = summary?.dayChangeEstimate ?? 0;
  const previousValue = (summary?.totalValue ?? 0) - dayChange;
  const dayPercent = previousValue ? (dayChange / previousValue) * 100 : 0;

  return (
    <Panel className="overflow-hidden border-border/80 bg-card/95">
      <PanelBody className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t("portfolioValue")}</p>
            <p className="mt-2 truncate text-4xl font-semibold tabular-nums">{formatMoney(summary?.totalValue)}</p>
            <p className={cn("mt-2 text-base font-semibold tabular-nums", dayChange >= 0 ? "text-gain" : "text-loss")}>
              {dayChange >= 0 ? "+" : ""}{formatMoney(dayChange)} ({formatPercent(dayPercent, locale)})
              <span className="ml-2 font-normal text-muted-foreground">{t("today")}</span>
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
            {dayChange >= 0 ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
          </span>
        </div>

        <div className="mt-4 h-[150px]">
          {visibleData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={visibleData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <YAxis domain={domain} hide />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.25} fill="hsl(var(--primary))" fillOpacity={0.16} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{t("noChartData")}</div>
          )}
        </div>

        <div className="mt-2 grid grid-cols-5 gap-1 rounded-lg bg-muted/45 p-1">
          {([
            ["week", "1W"],
            ["month", "1M"],
            ["quarter", "3M"],
            ["year", "1Y"],
            ["all", "ALL"]
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn("h-9 rounded-md text-xs font-medium text-muted-foreground", range === value && "bg-primary/18 text-primary")}
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-center">
          <RefreshStatus summary={summary} refreshing={refreshing} clock={clock} compact />
        </div>
      </PanelBody>
    </Panel>
  );
}

function MobileMiniMetric({
  title,
  value,
  change,
  positive = true,
  icon: Icon,
  tone = "primary"
}: {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: LucideIcon;
  tone?: "primary" | "warning";
}) {
  return (
    <div className="flex min-h-[132px] min-w-0 flex-col rounded-lg border bg-card p-2.5">
      <p className="min-h-9 text-xs leading-4 text-muted-foreground">{title}</p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums">{value}</p>
      <div className="mt-auto flex items-end justify-between gap-1 pt-2">
        {change ? <span className={cn("text-[11px] font-semibold", positive ? "text-gain" : "text-loss")}>{change}</span> : <span />}
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", tone === "warning" ? "bg-violet-500/[0.12] text-violet-500" : positive ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss")}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function MobileTopHoldings({
  holdings,
  loading,
  onSelectAsset,
  onViewAll
}: {
  holdings: Holding[];
  loading: boolean;
  onSelectAsset: (asset: AssetIdentity) => Promise<void>;
  onViewAll: () => void;
}) {
  const { formatMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();

  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("topHoldings")}</h2>
        <button type="button" className="text-sm font-medium text-primary" onClick={onViewAll}>{t("viewAll")}</button>
      </PanelHeader>
      <PanelBody className="p-0">
        {holdings.length ? (
          <div className="divide-y">
            {holdings.map((holding) => (
              <button
                key={assetKey(holding)}
                type="button"
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left"
                onClick={() => void onSelectAsset(holding)}
              >
                <AssetAvatar asset={holding} />
                <span className="min-w-0">
                  <span className="block font-semibold">{holding.ticker}</span>
                  <span className="block text-xs leading-4 text-muted-foreground">{holding.companyName ?? holding.ticker}</span>
                </span>
                <span className="text-right">
                  <span className="block font-medium tabular-nums">{formatMoney(holding.currentValue)}</span>
                  <span className={cn("block text-xs font-semibold", holding.dailyPercent >= 0 ? "text-gain" : "text-loss")}>
                    {formatPercent(holding.dailyPercent, locale)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : loading ? <LoadingRows /> : <EmptyState icon={Briefcase} title={t("noPositions")} description={t("noPositionsDescription")} />}
      </PanelBody>
    </Panel>
  );
}

function MobileQuickLink({ icon: Icon, label, meta, onClick }: { icon: LucideIcon; label: string; meta: string; onClick: () => void }) {
  return (
    <button type="button" className="grid min-h-[92px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-card p-3 text-left" onClick={onClick}>
      <Icon className="h-8 w-8 text-primary" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-4">{label}</span>
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{meta}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function MobileAllocationCard({
  allocationData,
  totalValue
}: {
  allocationData: Array<{ key: string; ticker: string; name: string; value: number; percent: number }>;
  totalValue: number;
}) {
  const { formatCompactMoney, formatMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();

  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("allocation")}</h2>
        <span className="text-sm font-medium text-primary">{t("holdingsByValue")}</span>
      </PanelHeader>
      <PanelBody>
        {allocationData.length ? (
          <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-3">
            <div className="relative h-[140px] w-[140px]">
              <PieChart width={140} height={140}>
                <Pie data={allocationData} dataKey="value" nameKey="ticker" cx="50%" cy="50%" innerRadius={44} outerRadius={66} paddingAngle={1} stroke="none" isAnimationActive={false}>
                  {allocationData.map((item, index) => <Cell key={item.key} fill={allocationColors[index % allocationColors.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
              </PieChart>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-sm font-semibold tabular-nums">{formatCompactMoney(totalValue)}</span>
                <span className="text-[10px] text-muted-foreground">{t("value")}</span>
              </div>
            </div>
            <div className="min-w-0 space-y-2.5">
              {allocationData.slice(0, 5).map((item, index) => (
                <div key={item.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 text-xs">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: allocationColors[index % allocationColors.length] }} />
                  <span className="min-w-0">
                    <span className="block font-medium">{item.ticker}</span>
                    <span className="block text-[10px] leading-3 text-muted-foreground">{item.name}</span>
                  </span>
                  <span className="font-medium tabular-nums">{formatPercent(item.percent, locale)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState icon={Briefcase} title={t("noAllocation")} description={t("noAllocationDescription")} />
        )}
      </PanelBody>
    </Panel>
  );
}

function MobileNavButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", active && "text-primary")} aria-current={active ? "page" : undefined} onClick={onClick}>
      <Icon className="h-6 w-6" />
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

function MobileSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/55" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0" aria-label={t("dismiss")} onClick={onClose} />
      <section className="relative z-10 mx-auto max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-t-lg border-x border-t bg-card px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Button type="button" variant="secondary" size="icon" title={t("dismiss")} aria-label={t("dismiss")} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}

function MobileSheetAction({ icon: Icon, label, onClick, loading = false }: { icon: LucideIcon; label: string; onClick: () => void; loading?: boolean }) {
  return (
    <button type="button" className="flex min-h-[82px] flex-col items-start justify-between rounded-lg border bg-background/50 p-3 text-left font-medium" onClick={onClick} disabled={loading}>
      <Icon className={cn("h-5 w-5 text-primary", loading && "animate-spin")} />
      <span>{label}</span>
    </button>
  );
}

function MobilePurchaseList({
  purchases,
  onSelectAsset,
  onClose
}: {
  purchases: Array<{ holding: Holding; lot: PositionLot; total: number }>;
  onSelectAsset: (asset: AssetIdentity) => Promise<void>;
  onClose: () => void;
}) {
  const { formatMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();

  if (!purchases.length) {
    return <EmptyState icon={Activity} title={t("noRecentPurchases")} description={t("noPurchaseLotsDescription")} />;
  }

  return (
    <div className="divide-y">
      {purchases.map(({ holding, lot, total }) => (
        <button
          key={lot.id}
          type="button"
          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left"
          onClick={async () => {
            onClose();
            await onSelectAsset(holding);
          }}
        >
          <AssetAvatar asset={holding} />
          <span className="min-w-0">
            <span className="block font-semibold">{holding.ticker}</span>
            <span className="block truncate text-xs text-muted-foreground">{t("boughtAmount", { amount: formatNumber(lot.originalShares ?? lot.shares, 4), unit: holding.assetType === "crypto" ? holding.ticker : t("sharesUnit") })}</span>
          </span>
          <span className="text-right">
            <span className="block font-medium tabular-nums">-{formatMoney(total)}</span>
            <span className="block text-xs text-muted-foreground">{purchaseDateLabel(lot.purchaseDate, locale)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function PortfolioSidebar({
  activeView,
  navItems,
  summary,
  watchlist,
  darkMode,
  onNavigate,
  onSelectWatchlist,
  onToggleTheme
}: {
  activeView: View;
  navItems: Array<{ view: View; label: string; icon: LucideIcon; meta?: string }>;
  summary: PortfolioSummary | null;
  watchlist: WatchlistItem[];
  darkMode: boolean;
  onNavigate: (view: View) => void;
  onSelectWatchlist: (item: WatchlistItem) => Promise<void>;
  onToggleTheme: () => Promise<void>;
}) {
  const { formatMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();

  return (
    <aside className="relative z-30 border-b bg-card/55 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
      <div className="flex h-full min-h-0 flex-col gap-4 p-3 sm:p-4 lg:p-5">
        <div className="flex items-center justify-between gap-3 lg:h-14 lg:justify-start">
          <button type="button" className="flex items-center gap-3" onClick={() => onNavigate("overview")}>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/12 text-primary">
              <BarChart3 className="h-6 w-6" />
            </span>
            <span className="text-xl font-semibold">{t("portfolio")}</span>
          </button>
          <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 lg:hidden"
            title={t("toggleTheme")}
            aria-label={t("toggleTheme")}
            onClick={() => void onToggleTheme()}
          >
            {darkMode ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          </button>
        </div>

        <nav className="grid grid-cols-5 gap-1 lg:grid-cols-1" aria-label={t("mainNavigation")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                className={cn(
                  "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground lg:h-11 lg:flex-row lg:justify-between lg:gap-3 lg:px-3 lg:text-sm",
                  active && "bg-primary/12 text-primary hover:bg-primary/12 hover:text-primary"
                )}
                aria-current={active ? "page" : undefined}
                onClick={() => onNavigate(item.view)}
              >
                <span className="flex min-w-0 flex-col items-center gap-1 lg:flex-row lg:gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="max-w-full truncate">{item.label}</span>
                </span>
                {item.meta ? <span className="hidden text-xs opacity-75 lg:inline">{item.meta}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto hidden min-h-0 grid-rows-[1fr_auto] gap-4 lg:grid">
          <section className="self-end rounded-lg border bg-background/35 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("portfolioSnapshot")}</h2>
              <span className="text-xs text-primary">{summary?.holdings.length ?? 0}</span>
            </div>
            <div className="divide-y">
              {watchlist.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-3 text-left"
                  onClick={() => void onSelectWatchlist(item)}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">{item.ticker}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{formatMoney(item.currentPrice)}</span>
                  </span>
                  <span className={cn("text-xs font-semibold", item.dailyPercent >= 0 ? "text-gain" : "text-loss")}>
                    {formatPercent(item.dailyPercent, locale)}
                  </span>
                </button>
              ))}
              {!watchlist.length ? (
                <div className="grid grid-cols-2 gap-3 py-3 text-xs">
                  <span>
                    <span className="block text-muted-foreground">{t("value")}</span>
                    <span className="mt-1 block font-semibold">{formatMoney(summary?.totalValue)}</span>
                  </span>
                  <span>
                    <span className="block text-muted-foreground">{t("return")}</span>
                    <span className={cn("mt-1 block font-semibold", (summary?.gainLoss ?? 0) >= 0 ? "text-gain" : "text-loss")}>
                      {formatPercent(summary?.gainLossPercent, locale)}
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <button
            type="button"
            className="grid h-[52px] grid-cols-[1fr_auto_1fr] items-center rounded-lg border bg-muted/45 px-4"
            title={t("toggleTheme")}
            aria-label={t("toggleTheme")}
            aria-pressed={darkMode}
            onClick={() => void onToggleTheme()}
          >
            <Sun className={cn("h-4 w-4 justify-self-start", !darkMode ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("relative h-6 w-11 rounded-full border transition", darkMode ? "bg-primary/20" : "bg-background")}>
              <span className={cn("absolute top-0.5 h-[18px] w-[18px] rounded-full bg-primary transition", darkMode ? "left-5" : "left-0.5")} />
            </span>
            <Moon className={cn("h-4 w-4 justify-self-end", darkMode ? "text-primary" : "text-muted-foreground")} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function PortfolioPerformancePanel({ data }: { data: Array<{ date: string; value: number }> }) {
  const [range, setRange] = useState<"week" | "month" | "all">("month");
  const { formatCompactMoney, formatMoney } = useCurrencyDisplay();
  const { t } = useLanguage();
  const visibleData = filterChartRange(data, range);
  const chartValues = visibleData.map((point) => point.value);
  const dataMin = chartValues.length ? Math.min(...chartValues) : 0;
  const dataMax = chartValues.length ? Math.max(...chartValues) : 1;
  const dataSpread = Math.max(dataMax - dataMin, dataMax * 0.04, 1);
  const yDomain: [number, number] = [Math.max(0, dataMin - dataSpread * 0.2), dataMax + dataSpread * 0.2];

  return (
    <Panel className="min-h-[390px]">
      <PanelHeader className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t("portfolioPerformance")}</h2>
        <div className="flex rounded-md bg-muted/55 p-1">
          {([
            ["week", t("oneWeek")],
            ["month", t("oneMonth")],
            ["all", t("allTime")]
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn("h-8 min-w-10 rounded px-2 text-xs font-medium text-muted-foreground", range === value && "bg-primary/18 text-primary")}
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </PanelHeader>
      <PanelBody className="h-[320px] pt-2">
        {visibleData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart data={visibleData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis
                domain={yDomain}
                tickFormatter={(value) => formatCompactMoney(Number(value))}
                tickLine={false}
                axisLine={false}
                width={58}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <Tooltip
                formatter={(value) => formatMoney(Number(value))}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Area type="monotone" dataKey="value" name={t("portfolioValue")} stroke="hsl(var(--primary))" strokeWidth={2.5} fill="hsl(var(--primary))" fillOpacity={0.14} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={LineChart} title={t("noChartData")} description={t("noChartDescription")} />
        )}
      </PanelBody>
    </Panel>
  );
}

function AssetAvatar({ asset }: { asset: Pick<AssetIdentity, "assetType" | "ticker"> }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-primary">
      {asset.assetType === "crypto" ? <Bitcoin className="h-5 w-5 text-warning" /> : asset.ticker.slice(0, 1)}
    </span>
  );
}

function TopHoldingsPanel({
  holdings,
  loading,
  onSelect,
  onViewAll,
  onAdd
}: {
  holdings: Holding[];
  loading: boolean;
  onSelect: (holding: Holding) => Promise<void>;
  onViewAll: () => void;
  onAdd: () => void;
}) {
  const { formatMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();

  return (
    <Panel className="min-h-[390px]">
      <PanelHeader className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t("topHoldings")}</h2>
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={onViewAll}>{t("viewAll")}</button>
      </PanelHeader>
      <PanelBody className="p-0">
        {loading ? <LoadingRows /> : null}
        {!loading ? holdings.map((holding) => (
          <button
            key={assetKey(holding)}
            type="button"
            className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
            onClick={() => void onSelect(holding)}
          >
            <AssetAvatar asset={holding} />
            <span className="min-w-0">
              <span className="block font-semibold">{holding.ticker}</span>
              <span className="block truncate text-xs text-muted-foreground">{holding.companyName}</span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold tabular-nums">{formatMoney(holding.currentValue)}</span>
              <span className={cn("text-xs font-medium tabular-nums", holding.dailyPercent >= 0 ? "text-gain" : "text-loss")}>
                {formatPercent(holding.dailyPercent, locale)}
              </span>
            </span>
          </button>
        )) : null}
        {!loading && !holdings.length ? (
          <EmptyState icon={Briefcase} title={t("noPositions")} description={t("noPositionsDescription")} actionLabel={t("addAsset")} onAction={onAdd} />
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function RecentPurchasesPanel({
  purchases,
  onSelect,
  onViewAll
}: {
  purchases: Array<{ holding: Holding; lot: PositionLot; total: number }>;
  onSelect: (holding: Holding) => void;
  onViewAll: () => void;
}) {
  const { formatMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();

  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t("recentPurchases")}</h2>
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={onViewAll}>{t("viewAll")}</button>
      </PanelHeader>
      <PanelBody className="p-0">
        {purchases.map(({ holding, lot, total }) => {
          const amount = lot.originalShares ?? lot.shares;
          const unit = holding.assetType === "crypto" ? holding.ticker : t("sharesUnit");
          return (
            <button
              key={lot.id}
              type="button"
              className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t px-4 py-3 text-left first:border-t-0 hover:bg-muted/40"
              onClick={() => onSelect(holding)}
            >
              <AssetAvatar asset={holding} />
              <span className="min-w-0">
                <span className="block font-semibold">{holding.ticker}</span>
                <span className="block truncate text-xs text-muted-foreground">{t("boughtAmount", { amount: formatNumber(amount, 4), unit })}</span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-semibold text-loss">-{formatMoney(total)}</span>
                <span className="block text-xs text-muted-foreground">{purchaseDateLabel(lot.purchaseDate, locale)}</span>
              </span>
            </button>
          );
        })}
        {!purchases.length ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("noRecentPurchases")}</p> : null}
      </PanelBody>
    </Panel>
  );
}

function LanguagePrompt({
  initialLanguage,
  initialCurrency,
  busy,
  onContinue
}: {
  initialLanguage: LanguageCode;
  initialCurrency: CurrencyCode;
  busy: boolean;
  onContinue: (language: LanguageCode, currency: CurrencyCode) => Promise<void>;
}) {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(initialLanguage);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(initialCurrency);
  const prompt = (key: TranslationKey) => translate(selectedLanguage, key);
  const currencyNames = new Intl.DisplayNames([languageLocale(selectedLanguage)], { type: "currency" });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 min-h-full overflow-y-auto overscroll-contain bg-foreground/35 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:grid sm:place-items-center">
      <form
        className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] rounded-lg border bg-card p-5 shadow-2xl sm:max-w-md sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-prompt-title"
        onSubmit={(event) => {
          event.preventDefault();
          void onContinue(selectedLanguage, selectedCurrency);
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Languages className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="language-prompt-title" className="break-words text-lg font-semibold">{prompt("chooseLanguage")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{prompt("chooseLanguageDescription")}</p>
          </div>
        </div>

        <label className="mt-5 grid gap-2 text-sm font-medium">
          <span>{prompt("language")}</span>
          <span className="relative">
            <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <select
              className="h-12 w-full min-w-0 appearance-none rounded-md border bg-background pl-10 pr-10 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25"
              value={selectedLanguage}
              disabled={busy}
              onChange={(event) => setSelectedLanguage(event.target.value as LanguageCode)}
            >
              {supportedLanguages.map((language) => (
                <option key={language.code} value={language.code}>{language.nativeName}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </span>
        </label>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>{prompt("currency")}</span>
          <span className="relative">
            <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <select
              className="h-12 w-full min-w-0 appearance-none rounded-md border bg-background pl-10 pr-10 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25"
              value={selectedCurrency}
              disabled={busy}
              onChange={(event) => setSelectedCurrency(event.target.value as CurrencyCode)}
            >
              {supportedCurrencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currencyNames.of(currency.code) ?? currency.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </span>
        </label>

        <Button type="submit" className="mt-5 w-full" loading={busy}>
          {prompt("continue")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function RefreshStatus({
  summary,
  refreshing,
  clock,
  compact = false
}: {
  summary: PortfolioSummary | null;
  refreshing: boolean;
  clock: number;
  compact?: boolean;
}) {
  const { locale, t } = useLanguage();
  const state = priceStatus(summary, refreshing, clock);
  const labels: Record<PriceStatusState, TranslationKey> = {
    refreshing: "refreshingPrices",
    loading: "loadingPrices",
    waiting: "priceStatusWaiting",
    fresh: "priceStatusFresh",
    cached: "priceStatusCached",
    stale: "priceStatusStale"
  };
  const dotColor: Record<PriceStatusState, string> = {
    refreshing: "bg-primary",
    loading: "bg-muted-foreground",
    waiting: "bg-muted-foreground",
    fresh: "bg-gain",
    cached: "bg-warning",
    stale: "bg-loss"
  };
  const updatedAt = summary ? Date.parse(summary.updatedAt) : Number.NaN;
  const updatedText = Number.isFinite(updatedAt)
    ? t("updatedTime", { time: new Date(updatedAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) })
    : null;
  const label = t(labels[state]);
  const helpText = summary && summary.holdings.length + summary.watchlist.length > 0 ? t("priceStatusHelp") : label;

  if (compact) {
    return (
      <div className="flex min-w-0 items-center justify-center gap-2 text-[11px] text-muted-foreground" role="status" title={helpText}>
        <span className="relative flex h-2 w-2 shrink-0">
          {refreshing ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" /> : null}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotColor[state])} />
        </span>
        <span className="truncate">{label}{updatedText && state !== "waiting" ? ` · ${updatedText}` : ""}</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2" role="status" title={helpText}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {refreshing ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" /> : null}
        <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", dotColor[state])} />
      </span>
      <span className="min-w-0 text-right text-xs">
        <span className="block font-semibold text-foreground">{label}</span>
        <span className="hidden text-muted-foreground sm:block">
          {updatedText && state !== "waiting" ? `${updatedText} · ${relativeRefreshText(summary?.updatedAt, clock, t)}` : label}
        </span>
      </span>
    </div>
  );
}

function StatusBanner({
  tone,
  message,
  onClose
}: {
  tone: "error" | "success" | "info";
  message: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const Icon = tone === "success" ? CircleCheck : tone === "info" ? Clock3 : Activity;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm",
        tone === "error" && "border-destructive/35 bg-destructive/10 text-destructive",
        tone === "success" && "border-gain/35 bg-gain/10 text-gain",
        tone === "info" && "border-primary/30 bg-primary/10 text-foreground"
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title={t("dismiss")} onClick={onClose}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function SortSelect({
  value,
  label,
  options,
  onChange
}: {
  value: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative min-w-0">
      <span className="sr-only">{label}</span>
      <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <select
        className="h-11 min-w-24 appearance-none rounded-md border bg-background py-0 pl-8 pr-7 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25 sm:h-8"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        title={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-muted-foreground" />
    </label>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full min-h-44 flex-col items-center justify-center px-5 py-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" className="mt-4" size="sm" onClick={onAction}>
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function LoadingRows() {
  const { t } = useLanguage();
  return (
    <div className="grid gap-3 p-4" aria-label={t("loadingMarketData")}>
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-14 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

function TopAssetSearch({
  inputId = "asset-search",
  searchInputRef,
  assetType,
  setAssetType,
  ticker,
  setTicker,
  results,
  searching,
  busy,
  onSearch,
  onSelectResult,
  onAddResultWatchlist,
  onAddResultPosition
}: {
  inputId?: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  assetType: AssetType;
  setAssetType: (value: AssetType) => void;
  ticker: string;
  setTicker: (value: string) => void;
  results: TickerSearchResult[];
  searching: boolean;
  busy: string | null;
  onSearch: (event: FormEvent) => Promise<void>;
  onSelectResult: (result: TickerSearchResult) => Promise<void>;
  onAddResultWatchlist: (result: TickerSearchResult) => Promise<void>;
  onAddResultPosition: (result: TickerSearchResult) => void;
}) {
  const { t } = useLanguage();
  const resolvedAsset = assetFromSearch(ticker, results, assetType);
  const showResults = searching || results.length > 0;

  return (
    <form className="relative z-40 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-2" onSubmit={onSearch}>
      <div className="grid grid-cols-2 rounded-lg border bg-muted/45 p-1" aria-label={t("assetType")}>
        <button
          type="button"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition",
            assetType === "stock" && "bg-background text-foreground shadow-sm"
          )}
          aria-pressed={assetType === "stock"}
          aria-label={t("stocksEtfs")}
          title={t("stocksEtfs")}
          onClick={() => setAssetType("stock")}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="sr-only">{t("stocksEtfs")}</span>
        </button>
        <button
          type="button"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition",
            assetType === "crypto" && "bg-background text-foreground shadow-sm"
          )}
          aria-pressed={assetType === "crypto"}
          aria-label={t("crypto")}
          title={t("crypto")}
          onClick={() => setAssetType("crypto")}
        >
          <Bitcoin className="h-3.5 w-3.5" />
          <span className="sr-only">{t("crypto")}</span>
        </button>
      </div>
      <div className="contents">
        <label className="relative min-w-0" htmlFor={inputId}>
          <span className="sr-only">{t("searchAssets")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
          <input
            ref={searchInputRef}
            id={inputId}
            className="h-12 w-full rounded-lg border bg-card pl-10 pr-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25"
            placeholder={assetType === "crypto" ? t("searchCryptoPlaceholder") : t("searchStockPlaceholder")}
            value={ticker}
            onChange={(event) => setTicker(event.target.value)}
            autoComplete="off"
          />
        </label>
        <Button
          type="submit"
          className="h-12 w-12 px-0"
          loading={Boolean(resolvedAsset && busy === `detail-${assetKey(resolvedAsset)}`)}
          title={assetType === "crypto" ? t("viewCrypto") : t("viewStock")}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">{assetType === "crypto" ? t("viewCrypto") : t("viewStock")}</span>
        </Button>
      </div>
      {showResults ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 grid max-h-[70vh] gap-2 overflow-y-auto rounded-lg border bg-card p-2 shadow-2xl">
          {searching ? (
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              {t("searching")}
            </div>
          ) : null}
          {!searching && results.length
            ? results.map((result) => (
                <div key={assetKey(result)} className="grid gap-2 rounded-md border bg-background/40 p-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <button type="button" className="group flex min-w-0 items-center justify-between gap-3 rounded-md p-1 text-left" onClick={() => onSelectResult(result)}>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {result.assetType === "crypto" ? <Bitcoin className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-primary">{result.ticker}</span>
                        {result.type ? <span className="rounded border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{result.type}</span> : null}
                        {result.exchange || result.market ? <span className="text-xs text-muted-foreground">{result.exchange ?? result.market}</span> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-foreground">{result.name}</span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                  <div className="grid gap-2 min-[420px]:grid-cols-2">
                    <Button className="w-full" type="button" variant="secondary" size="sm" onClick={() => onAddResultPosition(result)}>
                      <Briefcase className="h-4 w-4" />
                      {t("addToPortfolio")}
                    </Button>
                    <Button className="w-full" type="button" size="sm" onClick={() => onAddResultWatchlist(result)} loading={busy === `watchlist-${assetKey(result)}`}>
                      <BellPlus className="h-4 w-4" />
                      {t("watchlist")}
                    </Button>
                  </div>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </form>
  );
}

function splitRatioLabel(split: StockSplit) {
  return `${formatNumber(split.splitTo, 4)}-for-${formatNumber(split.splitFrom, 4)}`;
}

function purchaseDateLabel(value: string, locale: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(locale);
}

function QuickPositionForm({
  result,
  busy,
  onCancel,
  onSave
}: {
  result: TickerSearchResult;
  busy: boolean;
  onCancel: () => void;
  onSave: (form: PositionForm) => Promise<void>;
}) {
  const { currency, formatEnteredMoney } = useCurrencyDisplay();
  const { t } = useLanguage();
  const today = toDateInputValue(new Date());
  const [form, setForm] = useState({
    assetType: result.assetType,
    assetId: result.assetId,
    ticker: result.ticker,
    shares: "",
    totalInvested: "",
    purchaseDate: today,
    notes: ""
  });
  const [splitOptionsOpen, setSplitOptionsOpen] = useState(false);
  const [splitPreview, setSplitPreview] = useState<SplitPreview | null>(null);
  const [checkingSplits, setCheckingSplits] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitCheckKey, setSplitCheckKey] = useState(0);

  useEffect(() => {
    setForm({
      assetType: result.assetType,
      assetId: result.assetId,
      ticker: result.ticker,
      shares: "",
      totalInvested: "",
      purchaseDate: today,
      notes: ""
    });
    setSplitOptionsOpen(false);
    setSplitPreview(null);
    setSplitError(null);
  }, [result.assetId, result.assetType, result.ticker, today]);

  useEffect(() => {
    if (result.assetType !== "stock" || !splitOptionsOpen || !form.purchaseDate || form.purchaseDate >= today) {
      setSplitPreview(null);
      setSplitError(null);
      setCheckingSplits(false);
      return;
    }

    let cancelled = false;
    setCheckingSplits(true);
    setSplitError(null);
    api<SplitPreview>(
      `/api/stocks/${encodeURIComponent(form.ticker)}/splits?from=${encodeURIComponent(form.purchaseDate)}`
    )
      .then((preview) => {
        if (!cancelled) setSplitPreview(preview);
      })
      .catch((previewError) => {
        if (!cancelled) {
          setSplitPreview(null);
          setSplitError(errorMessage(previewError, t("unableCheckSplits")));
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingSplits(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.purchaseDate, form.ticker, result.assetType, splitCheckKey, splitOptionsOpen, t, today]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave({ ...form, adjustForSplits: result.assetType === "stock" && splitOptionsOpen });
  }

  const originalShares = Number(form.shares);
  const totalInvested = Number(form.totalInvested);
  const originalPrice = originalShares > 0 ? totalInvested / originalShares : 0;
  const adjustedShares = splitPreview ? originalShares * splitPreview.factor : 0;
  const adjustedPrice = splitPreview ? originalPrice / splitPreview.factor : 0;
  const hasSplits = Boolean(splitPreview?.splits.length);

  return (
    <Panel className="border-primary/30">
      <PanelHeader className="flex items-center justify-between gap-3 bg-primary/[0.04]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {result.assetType === "crypto" ? <Bitcoin className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">{t("addToMyPortfolio")}</h2>
            <p className="truncate text-xs text-muted-foreground">{result.name}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" title={t("cancel")} onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </PanelHeader>
      <PanelBody>
        <form className="grid gap-3" onSubmit={submit}>
          <div className="flex w-fit items-center gap-2 rounded-md border bg-muted/45 px-3 py-2 text-sm font-semibold">
            <LockKeyhole className="h-4 w-4 text-muted-foreground" />
            <span className="text-primary">{form.ticker}</span>
            <span className="text-xs font-medium text-muted-foreground">{result.assetType === "crypto" ? t("cryptoSelected") : t("selected")}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={result.assetType === "crypto" ? t("amount") : t("shares")} type="number" step={result.assetType === "crypto" ? "any" : "0.0001"} min="0.00000001" value={form.shares} onChange={(event) => setForm({ ...form, shares: event.target.value })} required />
            <Field label={t("purchaseDate")} type="date" max={toDateInputValue(new Date())} value={form.purchaseDate} onInput={(event) => setForm({ ...form, purchaseDate: event.currentTarget.value })} required />
            <Field label={t("totalInvestedAuto", { currency })} type="number" step={currency === "JPY" ? "1" : "0.01"} min="0" placeholder={t("totalAmountPaid")} value={form.totalInvested} onChange={(event) => setForm({ ...form, totalInvested: event.target.value })} />
          </div>
          {result.assetType === "stock" ? <div className="border-y py-1">
            <button
              type="button"
              className="flex min-h-10 w-full items-center justify-between gap-3 px-1 text-left text-sm font-medium"
              aria-expanded={splitOptionsOpen}
              aria-controls="split-adjustment-options"
              onClick={() => setSplitOptionsOpen((open) => !open)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <GitFork className="h-4 w-4 shrink-0 text-primary" />
                <span>{t("boughtBeforeSplit")}</span>
                <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", splitOptionsOpen && "rotate-180")} />
            </button>

            {splitOptionsOpen ? (
              <div id="split-adjustment-options" className="grid gap-2 px-1 pb-3 pt-2" aria-live="polite">
                {form.purchaseDate >= today ? (
                  <p className="text-xs text-muted-foreground">{t("chooseOriginalPurchaseDate")}</p>
                ) : checkingSplits ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {t("checkingSplitHistory")}
                  </p>
                ) : splitError ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-loss">{splitError}</p>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setSplitCheckKey((key) => key + 1)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      {t("retry")}
                    </Button>
                  </div>
                ) : hasSplits && splitPreview ? (
                  <div className="grid gap-1 border-l-2 border-primary pl-3">
                    <p className="text-sm font-semibold">
                      {splitPreview.splits.length === 1
                        ? t("splitFound", { ratio: splitRatioLabel(splitPreview.splits[0]) })
                        : t("splitsFound", { count: splitPreview.splits.length })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {originalShares > 0
                        ? t("originalSharesBecome", { original: formatNumber(originalShares, 4), adjusted: formatNumber(adjustedShares, 4) })
                        : t("enterOriginalShares")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {totalInvested > 0
                        ? t("totalStaysSame", { total: formatEnteredMoney(totalInvested), cost: formatEnteredMoney(adjustedPrice) })
                        : t("purchasePriceAdjusted")}
                    </p>
                  </div>
                ) : splitPreview ? (
                  <p className="text-xs text-muted-foreground">{t("noSplitsFound")}</p>
                ) : null}
              </div>
            ) : null}
          </div> : null}
          <TextareaField className="min-h-16" label={t("notesOptional")} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={busy} disabled={checkingSplits}>
              <Briefcase className="h-4 w-4" />
              {t("saveToPortfolio")}
            </Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

function Metric({
  title,
  value,
  change,
  positive = true,
  icon: Icon,
  tone = "primary"
}: {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: LucideIcon;
  tone?: "primary" | "warning" | "gain" | "loss";
}) {
  const { t } = useLanguage();
  const iconTone = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-violet-500/[0.12] text-violet-500",
    gain: "bg-gain/10 text-gain",
    loss: "bg-loss/10 text-loss"
  }[tone];

  return (
    <Panel className="min-w-0 overflow-hidden">
      <PanelBody className="min-h-32 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 whitespace-nowrap text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
          </div>
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", iconTone)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {change ? (
          <span className={cn("mt-2 inline-flex items-center gap-1 text-xs font-semibold sm:text-sm", positive ? "text-gain" : "text-loss")}>
            {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {change}
          </span>
        ) : <span className="mt-2 block text-xs text-muted-foreground">{t("acrossAllPositions")}</span>}
      </PanelBody>
    </Panel>
  );
}

function HoldingsTable({
  holdings,
  loading,
  onSelect,
  onRemove,
  busy,
  favorites,
  onToggleFavorite,
  onAdd
}: {
  holdings: Holding[];
  loading: boolean;
  onSelect: (holding: Holding) => void;
  onRemove: (holding: Holding) => Promise<void>;
  busy: string | null;
  favorites: Set<string>;
  onToggleFavorite: (holding: Holding) => void;
  onAdd: () => void;
}) {
  const { formatMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();
  if (loading) return <LoadingRows />;
  if (!holdings.length) {
    return (
      <EmptyState
        icon={Briefcase}
        title={t("noPositions")}
        description={t("noPositionsDescription")}
        actionLabel={t("addAsset")}
        onAction={onAdd}
      />
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-3 font-medium"><span className="sr-only">{t("favorite")}</span></th>
              <th className="px-3 py-3 font-medium">{t("symbol")}</th>
              <th className="px-3 py-3 font-medium">{t("quantity")}</th>
              <th className="px-3 py-3 font-medium">{t("averageCost")}</th>
              <th className="px-3 py-3 font-medium">{t("price")}</th>
              <th className="px-3 py-3 font-medium">{t("value")}</th>
              <th className="px-3 py-3 font-medium">{t("return")}</th>
              <th className="px-3 py-3 font-medium">{t("today")}</th>
              <th className="px-3 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => {
              const favorite = favorites.has(assetKey(holding));
              return (
                <tr key={assetKey(holding)} className="border-t transition hover:bg-muted/35">
                  <td className="px-2 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title={favorite ? t("removeFavorite", { ticker: holding.ticker }) : t("addFavorite", { ticker: holding.ticker })}
                      aria-pressed={favorite}
                      onClick={() => onToggleFavorite(holding)}
                    >
                      <Star className={cn("h-4 w-4", favorite && "fill-warning text-warning")} />
                    </Button>
                  </td>
                  <td className="px-3 py-3">
                    <button className="text-left" onClick={() => onSelect(holding)}>
                      <span className="flex items-center gap-1.5 font-semibold text-primary">
                        {holding.assetType === "crypto" ? <Bitcoin className="h-3.5 w-3.5 text-warning" /> : null}
                        {holding.ticker}
                      </span>
                      <span className="block max-w-52 truncate text-xs text-muted-foreground">{holding.companyName}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{formatNumber(holding.shares, 4)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatMoney(holding.averageCost)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatMoney(holding.currentPrice)}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums">{formatMoney(holding.currentValue)}</td>
                  <td className={cn("px-3 py-3 font-medium tabular-nums", holding.gainLoss >= 0 ? "text-gain" : "text-loss")}>
                    <span className="block">{formatMoney(holding.gainLoss)}</span>
                    <span className="text-xs">{formatPercent(holding.gainLossPercent, locale)}</span>
                  </td>
                  <td className={cn("px-3 py-3 font-medium tabular-nums", holding.dailyChange >= 0 ? "text-gain" : "text-loss")}>
                    {formatPercent(holding.dailyPercent, locale)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button type="button" variant="ghost" size="icon" title={t("manageAsset", { ticker: holding.ticker })} onClick={() => onSelect(holding)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title={t("removeFromPortfolio", { ticker: holding.ticker })}
                      loading={busy === `remove-${assetKey(holding)}`}
                      onClick={() => onRemove(holding)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y md:hidden">
        {holdings.map((holding) => {
          const favorite = favorites.has(assetKey(holding));
          return (
            <article key={assetKey(holding)} className="p-3">
              <div className="flex items-start gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={favorite ? t("removeFavorite", { ticker: holding.ticker }) : t("addFavorite", { ticker: holding.ticker })}
                  aria-pressed={favorite}
                  onClick={() => onToggleFavorite(holding)}
                >
                  <Star className={cn("h-4 w-4", favorite && "fill-warning text-warning")} />
                </Button>
                <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(holding)}>
                  <span className="flex items-center gap-2">
                    {holding.assetType === "crypto" ? <Bitcoin className="h-3.5 w-3.5 shrink-0 text-warning" /> : null}
                    <span className="font-semibold text-primary">{holding.ticker}</span>
                    <span className="truncate text-xs text-muted-foreground">{holding.companyName}</span>
                  </span>
                  <span className="mt-1 block text-lg font-semibold tabular-nums">{formatMoney(holding.currentValue)}</span>
                  <span className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <span>
                      <span className="block text-muted-foreground">{holding.assetType === "crypto" ? t("amount") : t("shares")}</span>
                      <span className="font-medium tabular-nums">{formatNumber(holding.shares, 4)}</span>
                    </span>
                    <span>
                      <span className="block text-muted-foreground">{t("return")}</span>
                      <span className={cn("font-semibold tabular-nums", holding.gainLoss >= 0 ? "text-gain" : "text-loss")}>
                        {formatPercent(holding.gainLossPercent, locale)}
                      </span>
                    </span>
                    <span>
                      <span className="block text-muted-foreground">{t("today")}</span>
                      <span className={cn("font-semibold tabular-nums", holding.dailyChange >= 0 ? "text-gain" : "text-loss")}>
                        {formatPercent(holding.dailyPercent, locale)}
                      </span>
                    </span>
                  </span>
                </button>
                <div className="grid gap-1">
                  <Button type="button" variant="ghost" size="icon" title={t("manageAsset", { ticker: holding.ticker })} onClick={() => onSelect(holding)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={t("removeFromPortfolio", { ticker: holding.ticker })}
                    loading={busy === `remove-${assetKey(holding)}`}
                    onClick={() => onRemove(holding)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function WatchlistRow({
  item,
  onSelect,
  onDelete,
  onAddPosition,
  favorite,
  onToggleFavorite
}: {
  item: WatchlistItem;
  onSelect: () => void;
  onDelete: () => Promise<void>;
  onAddPosition: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const { formatMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 px-2 py-3 transition hover:bg-muted/35 sm:gap-2 sm:px-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={favorite ? t("removeFavorite", { ticker: item.ticker }) : t("addFavorite", { ticker: item.ticker })}
        aria-pressed={favorite}
        onClick={onToggleFavorite}
      >
        <Star className={cn("h-4 w-4", favorite && "fill-warning text-warning")} />
      </Button>
      <button className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md p-1 text-left" onClick={onSelect}>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-semibold text-primary">
            {item.assetType === "crypto" ? <Bitcoin className="h-3.5 w-3.5 text-warning" /> : null}
            {item.ticker}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{item.companyName ?? item.notes}</span>
        </span>
        <span className="text-right">
          <span className="block font-semibold tabular-nums">{formatMoney(item.currentPrice)}</span>
          <span className={cn("text-xs font-semibold tabular-nums", item.dailyChange >= 0 ? "text-gain" : "text-loss")}>
            {formatPercent(item.dailyPercent, locale)}
          </span>
        </span>
      </button>
      <div className="flex items-center">
        <Button type="button" variant="ghost" size="icon" title={t("addAssetToPortfolio", { ticker: item.ticker })} onClick={onAddPosition}>
          <Briefcase className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" title={t("removeFromWatchlist", { ticker: item.ticker })} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AllocationPanel({
  allocationData,
  totalValue
}: {
  allocationData: Array<{ key: string; ticker: string; name: string; value: number; percent: number }>;
  totalValue?: number;
}) {
  const { formatMoney } = useCurrencyDisplay();
  const { t } = useLanguage();
  const allocationTotal = totalValue ?? allocationData.reduce((total, entry) => total + entry.value, 0);
  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between">
        <h2 className="font-semibold">{t("allocation")}</h2>
      </PanelHeader>
      <PanelBody className="grid min-h-[300px] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(190px,0.95fr)] md:items-center">
        {allocationData.length ? (
          <>
            <div className="relative h-60 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie data={allocationData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
                    {allocationData.map((entry, index) => (
                      <Cell key={entry.key} fill={allocationColors[index % allocationColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatMoney(Number(value))}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-semibold tabular-nums">{formatMoney(allocationTotal)}</span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">{t("value")}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("holdingsByValue")}</p>
              <div className="no-scrollbar grid max-h-56 gap-1 overflow-y-auto">
                {allocationData.map((entry, index) => (
                  <div key={entry.key} className="flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: allocationColors[index % allocationColors.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-xs font-semibold leading-4 text-foreground">{entry.name}</p>
                      <p className="text-[11px] text-muted-foreground">{entry.ticker}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold tabular-nums">{formatMoney(entry.value)}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">{entry.percent.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <EmptyState icon={BarChart3} title={t("noAllocation")} description={t("noAllocationDescription")} />
        )}
      </PanelBody>
    </Panel>
  );
}

function PerformancePanel({ performanceData }: { performanceData: Array<{ ticker: string; value: number; cost: number; gain: number }> }) {
  const { formatCompactMoney, formatMoney } = useCurrencyDisplay();
  const { t } = useLanguage();
  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between">
        <h2 className="font-semibold">{t("valueVsCost")}</h2>
        <LineChart className="h-4 w-4 text-primary" />
      </PanelHeader>
      <PanelBody className="h-72">
        {performanceData.length ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="ticker" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => formatCompactMoney(Number(value))} tickLine={false} axisLine={false} width={56} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Bar dataKey="cost" name={t("totalInvested")} fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="value" name={t("value")} fill="#0891b2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={LineChart} title={t("noPerformance")} description={t("noPerformanceDescription")} />
        )}
      </PanelBody>
    </Panel>
  );
}

function SettingsPanel({
  settings,
  currencyLoading,
  saveSettings
}: {
  settings: Settings;
  currencyLoading: boolean;
  saveSettings: (next: Partial<Settings>) => Promise<void>;
}) {
  const { locale, t } = useLanguage();
  const currencyNames = new Intl.DisplayNames([locale], { type: "currency" });
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [backupBusy, setBackupBusy] = useState<"export" | "restore" | null>(null);
  const [backupStatus, setBackupStatus] = useState<{ tone: "error" | "success" | "info"; message: string } | null>(null);

  async function downloadBackup() {
    setBackupBusy("export");
    setBackupStatus(null);
    try {
      const backup = await api<PortfolioBackupFile>("/api/backup");
      let favorites: string[] = [];
      try {
        const stored = JSON.parse(window.localStorage.getItem("portfolio-favorites") ?? "[]");
        if (Array.isArray(stored)) favorites = stored.map(String);
      } catch {
        favorites = [];
      }

      const blob = new Blob([JSON.stringify({ ...backup, favorites }, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `my-portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
      setBackupStatus({ tone: "success", message: t("backupDownloaded") });
    } catch (backupError) {
      setBackupStatus({ tone: "error", message: errorMessage(backupError, t("backupDownloadFailed")) });
    } finally {
      setBackupBusy(null);
    }
  }

  async function restoreBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBackupStatus(null);

    try {
      if (file.size > 2 * 1024 * 1024) throw new Error(t("backupTooLarge"));
      const contents = await file.text();
      const backup = JSON.parse(contents) as unknown;
      if (
        !backup ||
        typeof backup !== "object" ||
        (backup as { format?: unknown }).format !== "my-portfolio-backup" ||
        (backup as { version?: unknown }).version !== 1
      ) {
        throw new Error(t("invalidBackupFile"));
      }
      if (!window.confirm(t("confirmRestoreBackup"))) return;

      setBackupBusy("restore");
      const response = await api<BackupRestoreResponse>("/api/backup", {
        method: "POST",
        body: JSON.stringify(backup)
      });
      window.localStorage.setItem("portfolio-favorites", JSON.stringify(response.restored.favorites));
      window.sessionStorage.setItem("portfolio-backup-restored", "true");
      window.location.reload();
    } catch (backupError) {
      const fallback = backupError instanceof SyntaxError ? t("invalidBackupFile") : t("backupRestoreFailed");
      setBackupStatus({ tone: "error", message: errorMessage(backupError, fallback) });
      setBackupBusy(null);
    }
  }

  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between">
        <h2 className="font-semibold">{t("settings")}</h2>
        <Settings2 className="h-4 w-4 text-primary" />
      </PanelHeader>
      <PanelBody className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <ControlGroup title={t("theme")}>
          <SegmentedControl
            value={settings.theme}
            options={[
              { value: "light", icon: Sun, label: t("light") },
              { value: "dark", icon: Moon, label: t("dark") },
              { value: "system", icon: Settings2, label: t("system") }
            ]}
            onChange={(value) => saveSettings({ theme: value as Settings["theme"] })}
          />
        </ControlGroup>
        <ControlGroup title={t("accent")}>
          <AccentSwatches value={settings.accent} onChange={(accent) => saveSettings({ accent })} />
        </ControlGroup>
        <ControlGroup title={t("currency")}>
          <label className="relative w-full max-w-xs">
            <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <select
              className="h-11 w-full appearance-none rounded-md border bg-background py-0 pl-10 pr-9 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25"
              value={settings.currency}
              disabled={currencyLoading}
              aria-label={t("displayCurrency")}
              onChange={(event) => saveSettings({ currency: event.target.value as CurrencyCode })}
            >
              {supportedCurrencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currencyNames.of(currency.code) ?? currency.name}
                </option>
              ))}
            </select>
            {currencyLoading ? (
              <RefreshCw className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : (
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
          </label>
        </ControlGroup>
        <ControlGroup title={t("language")}>
          <label className="relative w-full max-w-xs">
            <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <select
              className="h-11 w-full appearance-none rounded-md border bg-background py-0 pl-10 pr-9 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25"
              value={settings.language}
              aria-label={t("language")}
              onChange={(event) => saveSettings({ language: event.target.value as LanguageCode })}
            >
              {supportedLanguages.map((language) => (
                <option key={language.code} value={language.code}>{language.nativeName}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </label>
        </ControlGroup>
      </PanelBody>
      <div className="grid gap-4 border-t px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <DatabaseBackup className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">{t("backupRestore")}</h3>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{t("backupDescription")}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
            {t("backupPrivacy")}
          </p>
        </div>
        <div className="flex flex-col gap-2 min-[420px]:flex-row">
          <Button type="button" variant="secondary" loading={backupBusy === "export"} disabled={backupBusy !== null} onClick={() => void downloadBackup()}>
            <Download className="h-4 w-4" />
            {t("downloadBackup")}
          </Button>
          <Button type="button" variant="secondary" loading={backupBusy === "restore"} disabled={backupBusy !== null} onClick={() => restoreInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {t("restoreBackup")}
          </Button>
          <input
            ref={restoreInputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            aria-label={t("restoreBackup")}
            onChange={restoreBackup}
          />
        </div>
        {backupStatus ? (
          <div className="lg:col-span-2">
            <StatusBanner tone={backupStatus.tone} message={backupStatus.message} onClose={() => setBackupStatus(null)} />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function ControlGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function StockFact({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="min-w-0 px-2 py-3 text-center sm:px-3">
      <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-semibold tabular-nums sm:text-base", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>
        {value}
      </p>
    </div>
  );
}

function EditLotForm({
  lot,
  assetType,
  busy,
  onCancel,
  onSave
}: {
  lot: PositionLot;
  assetType: AssetType;
  busy: boolean;
  onCancel: () => void;
  onSave: (form: PositionUpdateForm) => Promise<void>;
}) {
  const { currency, toDisplayValue } = useCurrencyDisplay();
  const { t } = useLanguage();
  const splitAdjusted = lot.splitFactor !== 1;
  const usdTotal = (lot.originalShares ?? lot.shares) * (lot.originalPurchasePrice ?? lot.purchasePrice);
  const displayTotal = toDisplayValue(usdTotal);
  const [form, setForm] = useState({
    shares: String(lot.originalShares ?? lot.shares),
    totalInvested: currency === "JPY" ? String(Math.round(displayTotal)) : displayTotal.toFixed(2),
    purchaseDate: lot.purchaseDate.slice(0, 10),
    notes: lot.notes ?? "",
    adjustForSplits: splitAdjusted
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave(form);
  }

  return (
    <form className="grid gap-3 rounded-md border border-primary/30 bg-primary/[0.04] p-3" onSubmit={submit}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          {t("editPurchase")}
        </span>
        <Button type="button" variant="ghost" size="icon" title={t("cancel")} onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <Field label={assetType === "crypto" ? t("amount") : splitAdjusted ? t("originalShares") : t("shares")} type="number" min="0.00000001" step={assetType === "crypto" ? "any" : "0.0001"} value={form.shares} onChange={(event) => setForm({ ...form, shares: event.target.value })} required />
        <Field label={t("totalInvestedCurrency", { currency })} type="number" min="0" step={currency === "JPY" ? "1" : "0.01"} value={form.totalInvested} onChange={(event) => setForm({ ...form, totalInvested: event.target.value })} required />
        <div className="min-w-0 min-[420px]:col-span-2">
          <Field label={t("purchaseDate")} type="date" max={toDateInputValue(new Date())} value={form.purchaseDate} onInput={(event) => setForm({ ...form, purchaseDate: event.currentTarget.value })} required />
        </div>
      </div>
      <TextareaField className="min-h-16" label={t("notesOptional")} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>{t("cancel")}</Button>
        <Button type="submit" size="sm" loading={busy}>
          <Check className="h-4 w-4" />
          {t("saveChanges")}
        </Button>
      </div>
    </form>
  );
}

function AssetDetailPanel({
  detail,
  tab,
  setTab,
  busy,
  onClose,
  onRefresh,
  onAddWatchlist,
  onRemoveWatchlist,
  onAddPosition,
  onDeleteLot,
  onUpdateLot
}: {
  detail: AssetDetail;
  tab: "overview" | "news";
  setTab: (tab: "overview" | "news") => void;
  busy: string | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onAddWatchlist: () => Promise<void>;
  onRemoveWatchlist: () => Promise<void>;
  onAddPosition: () => void;
  onDeleteLot: (id: string) => Promise<void>;
  onUpdateLot: (
    id: string,
    form: PositionUpdateForm
  ) => Promise<void>;
}) {
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const { formatCompactMoney, formatMoney } = useCurrencyDisplay();
  const { locale, t } = useLanguage();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="ml-auto h-[100dvh] w-full max-w-2xl overflow-y-auto border-l bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("manageAsset", { ticker: detail.ticker })}
      >
        <div className="sticky top-0 z-10 border-b bg-card/95 px-4 py-4 backdrop-blur sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {detail.assetType === "crypto" ? <Bitcoin className="h-4 w-4 text-warning" /> : null}
                <span className="font-semibold text-primary">{detail.ticker}</span>
                <span className="text-xs text-muted-foreground">
                  {detail.assetType === "crypto"
                    ? detail.profile?.marketCapRank ? t("cryptoRank", { rank: detail.profile.marketCapRank }) : t("cryptoMarket")
                    : detail.profile?.exchange ?? t("market")}
                </span>
              </div>
              <h2 className="mt-0.5 truncate text-xl font-semibold sm:text-2xl">{detail.companyName ?? detail.ticker}</h2>
            </div>
            <Button type="button" variant="ghost" size="icon" title={t("closeDetails")} onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold tabular-nums min-[380px]:text-3xl">{formatMoney(detail.currentPrice)}</p>
              <p className={cn("mt-1 flex items-center gap-1 text-sm font-semibold tabular-nums", detail.dailyChange >= 0 ? "text-gain" : "text-loss")}>
                {detail.dailyChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {formatMoney(detail.dailyChange)} ({formatPercent(detail.dailyPercent, locale)})
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {detail.marketTime
                ? t("priceDate", { date: new Date(detail.marketTime).toLocaleDateString(locale) })
                : t("latestAvailablePrice")}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onAddPosition}>
              <Briefcase className="h-4 w-4" />
              {t("addPosition")}
            </Button>
            {detail.inWatchlist ? (
              <Button type="button" variant="secondary" size="sm" onClick={onRemoveWatchlist}>
                <BellOff className="h-4 w-4" />
                {t("removeWatchlist")}
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="sm" loading={busy === `watchlist-${assetKey(detail)}`} onClick={onAddWatchlist}>
                <BellPlus className="h-4 w-4" />
                {t("addWatchlist")}
              </Button>
            )}
            <Button type="button" variant="secondary" size="icon" title={t("refreshPrice")} loading={busy === `detail-${assetKey(detail)}`} onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 flex gap-1 border-b-0">
            <button
              type="button"
              className={cn("flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted sm:h-9", tab === "overview" && "bg-primary text-primary-foreground hover:bg-primary")}
              onClick={() => setTab("overview")}
            >
              <LayoutDashboard className="h-4 w-4" />
              {t("overview")}
            </button>
            {detail.assetType === "stock" ? <button
              type="button"
              className={cn("flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted sm:h-9", tab === "news" && "bg-primary text-primary-foreground hover:bg-primary")}
              onClick={() => setTab("news")}
            >
              <Newspaper className="h-4 w-4" />
              {t("news")}
            </button> : null}
          </div>
        </div>

        {tab === "overview" ? (
          <div className="grid gap-5 p-4 sm:p-5">
            <section className="grid grid-cols-3 divide-x rounded-lg border bg-background/35">
              <StockFact
                label={detail.assetType === "crypto" && detail.profile?.marketCap ? t("marketCap") : t("previousClose")}
                value={detail.assetType === "crypto" && detail.profile?.marketCap ? formatCompactMoney(detail.profile.marketCap) : formatMoney(detail.previousClose)}
              />
              <StockFact label={t("dayMove")} value={formatPercent(detail.dailyPercent, locale)} tone={detail.dailyPercent >= 0 ? "gain" : "loss"} />
              <StockFact label={t("purchaseLots")} value={String(detail.lots.length)} />
            </section>

            <Panel>
              <PanelHeader className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{t("priceHistory")}</h3>
                  <p className="text-xs text-muted-foreground">{detail.assetType === "crypto" ? t("thirtyDayTrend") : t("latestDailyCloses")}</p>
                </div>
                <LineChart className="h-4 w-4 text-primary" />
              </PanelHeader>
              <PanelBody className="h-64 sm:h-72">
                {detail.chart?.length ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={detail.chart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} />
                      <YAxis domain={["dataMin - 3", "dataMax + 3"]} tickFormatter={(value) => formatCompactMoney(Number(value))} tickLine={false} axisLine={false} width={64} />
                      <Tooltip formatter={(value) => formatMoney(Number(value))} />
                      <Area type="monotone" dataKey="price" name={t("price")} stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={LineChart} title={t("noChartData")} description={t("noChartDescription")} />
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{t("purchaseLots")}</h3>
                  <p className="text-xs text-muted-foreground">{t("entriesCount", { count: detail.lots.length })}</p>
                </div>
                <Briefcase className="h-4 w-4 text-primary" />
              </PanelHeader>
              <PanelBody className="grid gap-2">
                {detail.lots.map((lot) =>
                  editingLotId === lot.id ? (
                    <EditLotForm
                      key={lot.id}
                      lot={lot}
                      assetType={detail.assetType}
                      busy={busy === `lot-${lot.id}`}
                      onCancel={() => setEditingLotId(null)}
                      onSave={async (form) => {
                        await onUpdateLot(lot.id, form);
                        setEditingLotId(null);
                      }}
                    />
                  ) : (
                    <div key={lot.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="font-medium tabular-nums">
                          {t("holdingAtPrice", {
                            amount: formatNumber(lot.shares, detail.assetType === "crypto" ? 8 : 4),
                            unit: detail.assetType === "crypto" ? detail.ticker : t("sharesUnit"),
                            price: formatMoney(lot.purchasePrice)
                          })}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {purchaseDateLabel(lot.purchaseDate, locale)} {lot.notes ? `- ${lot.notes}` : ""}
                        </p>
                        {detail.assetType === "stock" && lot.splitFactor !== 1 && lot.originalShares !== undefined && lot.originalPurchasePrice !== undefined ? (
                          <p className="mt-1 text-xs font-medium text-primary">
                            {t("originallyTotal", {
                              shares: formatNumber(lot.originalShares, 4),
                              total: formatMoney(lot.originalShares * lot.originalPurchasePrice)
                            })}
                            {lot.splits.length === 1
                              ? ` - ${t("splitAdjusted", { ratio: splitRatioLabel(lot.splits[0]) })}`
                              : ` - ${t("splitsApplied", { count: lot.splits.length })}`}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center">
                        <Button type="button" variant="ghost" size="icon" title={t("editPurchaseLot")} onClick={() => setEditingLotId(lot.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" title={t("deletePurchaseLot")} onClick={() => onDeleteLot(lot.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                )}
                {!detail.lots.length ? (
                  <EmptyState icon={Briefcase} title={t("noPurchaseLots")} description={t("noPurchaseLotsDescription")} actionLabel={t("addPosition")} onAction={onAddPosition} />
                ) : null}
              </PanelBody>
            </Panel>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:p-5">
            {(detail.news ?? []).map((item) => (
              <a
                key={item.id}
                className="group rounded-md border p-4 transition hover:border-primary/40 hover:bg-muted/35"
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      {item.source} - {new Date(item.datetime).toLocaleDateString(locale)}
                    </span>
                    <span className="mt-1 block font-semibold">{item.headline}</span>
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                </span>
                {item.summary ? <span className="mt-2 line-clamp-3 block text-sm leading-6 text-muted-foreground">{item.summary}</span> : null}
              </a>
            ))}
            {!detail.news?.length ? (
              <EmptyState icon={Newspaper} title={t("noRecentNews")} description={t("noRecentNewsDescription")} />
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

function SegmentedControl({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ value: string; label: string; icon: LucideIcon }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-md border bg-card p-1">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            className={cn("flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition", value === option.value && "bg-primary text-primary-foreground")}
            title={option.label}
            aria-label={option.label}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function AccentSwatches({ value, onChange }: { value: Settings["accent"]; onChange: (value: Settings["accent"]) => void }) {
  const { t } = useLanguage();
  const swatches: Array<{ value: Settings["accent"]; color: string }> = [
    { value: "emerald", color: "bg-emerald-600" },
    { value: "blue", color: "bg-blue-600" },
    { value: "rose", color: "bg-rose-600" },
    { value: "amber", color: "bg-amber-500" }
  ];
  return (
    <div className="inline-flex rounded-md border bg-card p-1">
      {swatches.map((swatch) => (
        <button
          key={swatch.value}
          type="button"
          className={cn("m-0.5 h-7 w-7 rounded border border-transparent", swatch.color, value === swatch.value && "ring-2 ring-ring ring-offset-2 ring-offset-background")}
          title={t(swatch.value)}
          aria-label={t(swatch.value)}
          aria-pressed={value === swatch.value}
          onClick={() => onChange(swatch.value)}
        />
      ))}
    </div>
  );
}
