# Publish My Portfolio

GitHub stores the code. Vercel runs the Next.js website, Neon stores PostgreSQL data, and Auth.js handles GitHub sign-in. GitHub Pages cannot run this server-backed app.

## 1. Create the accounts

1. Visit https://vercel.com/signup, select the personal Hobby plan, and continue with your `Cole-Boisseau` GitHub account.
2. Grant Vercel access to `Cole-Boisseau/Portfolio-Tracker`.
3. Visit https://console.neon.tech/signup and continue with the same GitHub account. Choose the Free plan.
4. Create a Neon project called `portfolio-tracker`. PostgreSQL 16 is suitable. Pick a region near your Vercel deployment, ideally in the same cloud region.

Neon does not need access to your GitHub repository. Avoid creating a second database through the Vercel marketplace if you already created one in Neon.

## 2. Connect the database

In Neon's project dashboard, select **Connect** and the production branch/database:

- Enable connection pooling and copy the connection string for `DATABASE_URL`.
- Disable connection pooling and copy the direct connection string for `DIRECT_URL`.
- Keep `sslmode=require` in both URLs. Never post these strings or commit them to GitHub.

The app uses pooled connections for requests and the direct connection for migrations. A new database starts empty. No sample or existing personal data is published automatically.

## 3. Configure GitHub sign-in

1. In Vercel choose **Add New > Project**, import `Portfolio-Tracker`, and note the project name and intended production domain. Use the actual assigned domain, not a guessed name if it is taken.
2. Open https://github.com/settings/developers and select **OAuth Apps > New OAuth App**.
3. Name it `My Portfolio`.
4. Set **Homepage URL** to your production domain, for example `https://your-project.vercel.app`.
5. Set **Authorization callback URL** to that same domain followed by `/api/auth/callback/github`.
6. Register the application and generate a client secret. These become `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` below. They are not your GitHub password, a personal access token, or your Polygon key.

Use a separate OAuth app for localhost or Codespaces. GitHub OAuth apps have one callback URL. Production sign-in should always use the stable production domain; arbitrary Vercel preview URLs need their own OAuth configuration.

## 4. Add Vercel environment variables

In the import screen's **Environment Variables**, or the project's **Settings > Environment Variables**, add these for **Production**:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `AUTH_GITHUB_ID` | GitHub OAuth client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth client secret |
| `AUTH_SECRET` | Random secret generated below |
| `AUTH_TRUST_HOST` | `true` |
| `POLYGON_API_KEY` | Your existing stock-data key |
| `COINGECKO_API_KEY` | Your existing CoinGecko Demo key |
| `MARKET_PROVIDER` | `polygon` |

Generate `AUTH_SECRET` in your own terminal:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep the generated secret unchanged between deployments so existing sessions continue to work. Do not add `NEXT_PUBLIC_` to secret names. Leave `AUTH_URL` unset on Vercel unless explicitly overriding its detected origin.

GitHub Codespaces secrets are separate from Vercel's environment variables. The two market keys already added to Codespaces must also be added in Vercel. Do not use your production database for automatic preview deployments: configure a separate Neon development branch and OAuth app for previews, or leave previews unconfigured. Builds stop with a list of missing environment variable names rather than publishing a broken application.

## 5. Deploy

Keep **Framework Preset: Next.js** and **Root Directory: ./ **. `vercel.json` supplies the install and build commands. Select Node.js 22.x in the project's settings.

Click **Deploy**. The deployment validates configuration, applies the committed PostgreSQL migration, generates Prisma, and builds Next.js. After it completes, open the production domain and sign in with GitHub. Future pushes to `main` can deploy automatically through Vercel's GitHub integration.

If the final assigned domain differs from step 3, update both URLs in the GitHub OAuth app before signing in. Changing environment variables requires a new deployment.

## 6. Transfer your existing portfolio

On the old app, use **Settings > Backup & Restore > Download Backup** before replacing the old setup. Alternatively, from the checkout containing `prisma/dev.db`, use Node.js 22.13 or later:

```bash
npm run db:export-sqlite
```

This reads the SQLite database without modifying it and creates a JSON file under the ignored `backups/` directory. An optional source/output pair can be passed:

```bash
npm run db:export-sqlite -- prisma/dev.db backups/my-portfolio.json
```

Download that file from Codespaces if needed. Sign in to the new website with your account, open **Settings > Backup & Restore**, and restore it. Restore replaces only the signed-in user's holdings, watchlist, and preferences. The original share quantities, total invested, purchase dates, and split adjustments are retained. Browser-only favorites are included by the old app's download, but cannot be read from SQLite by the command.

Keep the old SQLite database and backup until you have checked the restored portfolio. The old SQLite migrations are archived in `prisma/legacy`; they must not be applied to PostgreSQL.

## Codespaces and local development

The updated dev-container includes its own PostgreSQL 16 service with a persistent Docker volume. It is separate from Neon production. For an existing Codespace: export your portfolio, pull `main`, and choose **Codespaces: Rebuild Container** from the command palette. Preserve/export data before deleting a Codespace or its database volume.

Add `AUTH_SECRET`, `AUTH_GITHUB_ID`, and `AUTH_GITHUB_SECRET` as Codespaces secrets, alongside the existing market keys. Use a development GitHub OAuth app whose callback is `https://YOUR-CODESPACE-3000.app.github.dev/api/auth/callback/github`. Set its homepage to the same forwarded origin. Stop/start the Codespace after adding secrets. Use the forwarded port URL in a full browser and keep its visibility private.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Both `pnpm dev` and `npm run dev` apply database migrations before starting Next.js. Outside Codespaces, create `.env.local` from `.env.example`, set your development PostgreSQL URLs and OAuth credentials, and run the same commands. Keep production and development databases separate.

## Verification

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec playwright install chromium
pnpm test
pnpm build
```

Browser tests start an isolated in-memory PostgreSQL database using PGlite. They verify anonymous access is blocked, users cannot modify each other's records, backup restore preserves cost basis and ownership, expired sessions are rejected, and onboarding/sign-out work in desktop and phone viewports. Tests use local database sessions; the real GitHub OAuth round trip must be checked after configuring the OAuth app on your actual domain.

References: [Vercel GitHub integration](https://vercel.com/docs/git/vercel-for-github), [Auth.js deployment](https://authjs.dev/getting-started/deployment), [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).
