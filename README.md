# Portfolio Tracker

A local-first stock, ETF, and cryptocurrency portfolio tracker built with Next.js, TypeScript, Tailwind CSS, Prisma, SQLite, and Recharts.

## Market Data

- Polygon supplies stock and ETF prices, company details, historical prices, splits, charts, and news.
- CoinGecko supplies crypto search, batched USD prices, 24-hour changes, one-year charts, and historical purchase prices.
- Frankfurter supplies keyless daily exchange rates for the display currency setting.
- Both providers are isolated behind server-side services and locally cached. The browser never receives either API key.

## Setup

1. Create `.env` from `.env.example`.
2. Add `POLYGON_API_KEY` for stocks and a free CoinGecko Demo key as `COINGECKO_API_KEY` for crypto.
3. Install dependencies and prepare the database.

```bash
corepack enable
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## GitHub Codespaces

The repository includes a dev-container that installs dependencies, generates the Prisma client, prepares SQLite, and forwards port `3000` automatically.

Before creating a codespace, add these repository secrets under **Settings > Secrets and variables > Codespaces**:

- `POLYGON_API_KEY`
- `COINGECKO_API_KEY`

Create the codespace, wait for setup to finish, and run:

```bash
pnpm dev
```

The development command automatically generates Prisma and applies pending database migrations. Open the forwarded **Portfolio Tracker** port when Codespaces prompts you; it opens as a full browser page on desktop and mobile. Portfolio entries are stored in that codespace's local SQLite database, so use the app's Backup & Restore controls before deleting or rebuilding a codespace.

If a dependency install was interrupted, repair it with:

```bash
rm -rf node_modules package-lock.json
pnpm install --frozen-lockfile
pnpm dev
```

## Features

- Stocks, ETFs, and crypto in one portfolio and watchlist
- Company or coin-name search, without requiring a ticker
- Current price, daily dollar change, daily percentage change, charts, and last-updated time
- Purchase lots with total invested, purchase date, notes, and automatic historical price lookup
- Stock split adjustments that preserve the original amount invested
- Portfolio value, cost basis, gain/loss, allocation, and performance views
- A USD-default display currency setting with ten widely traded currency choices; saved portfolio amounts remain in USD
- A first-launch language chooser with English, Spanish, French, Portuguese, Simplified Chinese, German, and Japanese; language can be changed later in Settings
- Batched crypto refreshes and 30-minute local quote caching to protect free API allowances
- Manual refresh plus automatic refresh every 30 minutes
- Versioned JSON backup and restore for holdings, watchlist, favorites, and preferences
- Visible fresh, cached, and stale price-status indicators
- Local SQLite storage and server-only API credentials
