import { normalizeTicker } from "@/lib/utils";

export type AssetType = "stock" | "crypto";

export type AssetIdentity = {
  assetType: AssetType;
  assetId?: string | null;
  ticker: string;
};

export function normalizeAssetType(value: unknown): AssetType {
  return value === "crypto" ? "crypto" : "stock";
}

export function normalizeCryptoId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function assetKey(asset: AssetIdentity) {
  if (asset.assetType === "crypto") {
    return `crypto:${normalizeCryptoId(asset.assetId ?? "")}`;
  }
  return `stock:${normalizeTicker(asset.ticker)}`;
}

export function assetLookupId(asset: AssetIdentity) {
  return asset.assetType === "crypto"
    ? normalizeCryptoId(asset.assetId ?? "")
    : normalizeTicker(asset.ticker);
}
