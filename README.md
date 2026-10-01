# My Portfolio

A stock, ETF, and cryptocurrency portfolio tracker built with Next.js, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

## Publish the website

Follow [DEPLOYMENT.md](DEPLOYMENT.md) to connect **GitHub + Vercel + Neon**. Sign in with a username and password, or Google once configured. Vercel runs the website and Neon stores the data. GitHub Pages is not compatible with this app's server routes.

Each signed-in account owns its holdings, watchlist, settings, and backups. All data and market API routes require authentication. Market prices are shared cached public data; personal records are never shared.

## Existing SQLite portfolios

Keep your old database. Export it before switching:

```bash
npm run db:export-sqlite
```

The JSON backup is written to the ignored `backups/` folder. Restore it from Settings after signing in to the new website. This preserves purchase dates, original investment, and split adjustments.

## Development

Use Node.js 22.13 or later. Copy `.env.example` to `.env.local` and configure PostgreSQL, AUTH_SECRET, and your market keys as described in [DEPLOYMENT.md](DEPLOYMENT.md). Google OAuth is optional until its credentials are ready.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Codespaces includes a separate PostgreSQL service and forwards port 3000. Existing Codespaces need a container rebuild after this upgrade and development OAuth credentials.

## Features

- Username/password registration, optional Google sign-in, and private portfolios for each account
- Stocks, ETFs, and crypto in one portfolio and watchlist
- Company or coin-name search
- Current value, cost basis, gain/loss, allocation, charts, and news
- Original purchase entry and stock split adjustments
- Manual refresh and cached 30-minute price refreshes
- Desktop and mobile layouts, light/dark mode, seven languages, and ten currencies
- Account-scoped backup and restore

Polygon supplies stocks and ETFs, CoinGecko supplies cryptocurrencies, and Frankfurter supplies exchange rates. Keys remain on the server and are never included in backups or committed to GitHub. Codespaces secrets must be configured separately in Vercel.

## Checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec playwright install chromium webkit
pnpm test
pnpm build
```

Tests use an isolated PostgreSQL instance and local test sessions. They cover registration, password login, sign-out, invalid credentials, ownership isolation and the Google redirect. The real Google OAuth round trip must be checked after adding production credentials.
