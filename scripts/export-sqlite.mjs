import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Read-only export; this never connects to PostgreSQL or changes the old database.
const source = resolve(process.argv[2] ?? "prisma/dev.db");
const destination = resolve(process.argv[3] ?? `backups/portfolio-${Date.now()}.json`);
const db = new DatabaseSync(source, { readOnly: true });
const iso = (value) => new Date(typeof value === "bigint" ? Number(value) : value).toISOString();

try {
  const lots = db.prepare('SELECT * FROM "PositionLot" ORDER BY "createdAt"').all();
  const watchlist = db.prepare('SELECT * FROM "WatchlistItem" ORDER BY "createdAt"').all();
  const settings = db.prepare('SELECT "key", "value" FROM "AppSetting"').all();
  const allowed = new Set(["theme", "accent", "currency", "language"]);
  const backup = {
    format: "my-portfolio-backup", version: 1, exportedAt: new Date().toISOString(),
    lots: lots.map((lot) => ({
      assetType: lot.assetType ?? "stock", assetId: lot.assetId ?? lot.ticker,
      ticker: lot.ticker, shares: lot.shares, purchasePrice: lot.purchasePrice,
      purchaseDate: iso(lot.purchaseDate), notes: lot.notes,
      splitFactor: lot.splitFactor ?? 1,
      splits: lot.splitDetailsJson ? JSON.parse(lot.splitDetailsJson) : [],
      createdAt: iso(lot.createdAt)
    })),
    watchlist: watchlist.map((item) => ({
      assetType: item.assetType ?? "stock", assetId: item.assetId ?? item.ticker,
      ticker: item.ticker, notes: item.notes, createdAt: iso(item.createdAt)
    })),
    settings: Object.fromEntries(settings.filter((item) => allowed.has(item.key)).map((item) => [item.key, item.value])),
    favorites: []
  };
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(backup, null, 2), { flag: "wx", mode: 0o600 });
  console.log(`Exported ${lots.length} purchases and ${watchlist.length} watchlist items to ${destination}`);
} finally {
  db.close();
}
