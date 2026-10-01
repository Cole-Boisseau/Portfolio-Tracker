# Publish My Portfolio

Vercel runs the Next.js website and server routes. Neon stores PostgreSQL data independently of the Codespace. Sign-in uses a username and password, with an optional Google button. GitHub is used to store source code, not to sign in to the website.

## Production configuration

Keep the existing Vercel project and Neon database. Use a pooled Neon connection as `DATABASE_URL` and a direct connection as `DIRECT_URL`, both with `sslmode=require`.

Required Vercel Production environment variables:

- `DATABASE_URL`, `DIRECT_URL`
- `AUTH_SECRET`: at least 32 random characters; keep it unchanged across deployments
- `POLYGON_API_KEY`, `COINGECKO_API_KEY`
- `AUTH_TRUST_HOST=true`, `MARKET_PROVIDER=polygon`

`vercel.json` installs pnpm dependencies and runs `pnpm run build:vercel`. This validates configuration, applies committed migrations, generates Prisma, and builds Next.js. Use Node.js 22.x. Never commit secrets or prefix them with `NEXT_PUBLIC_`.

Users select **Create an account**, choose a unique username and a password of 12–128 characters, and then sign in. Usernames are case-insensitive. Passwords are salted and hashed with scrypt; repeated attempts are limited in the database. Auth.js uses encrypted JWT sessions lasting up to seven days. Signing out removes the browser session. Portfolios remain private to each user. Google-only users sign in through Google; no password is assigned to them automatically. Password-reset email delivery is not configured.

## Add Google sign-in later under your preferred email

1. Sign in to https://console.cloud.google.com/ using the Google account you want to own the setup. Accept its terms yourself and create a project, such as Portfolio Tracker. Basic Google OAuth setup does not require buying a paid hosting plan.
2. Open **Google Auth Platform** (or APIs & Services > OAuth consent screen). Configure the app's branding and choose an External audience if people outside a Google Workspace organization need to sign in. Use your preferred email for support and developer contact.
3. Request only the basic sign-in scopes: `openid`, email, and profile. Gmail, Drive, and other API access are unnecessary.
4. Under **Clients**, create an OAuth client with application type **Web application**.
5. Add this Authorized JavaScript origin:
   `https://portfolio-tracker-six-flame.vercel.app`
6. Add this exact Authorized redirect URI:
   `https://portfolio-tracker-six-flame.vercel.app/api/auth/callback/google`
7. Copy the client ID and client secret into this Vercel project's Production environment variables as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Keep the secret out of Git, screenshots, and chat. GitHub OAuth credentials cannot be reused for Google.
8. Redeploy the Vercel project. The Google button automatically becomes active when both variables are configured.
9. While Google's OAuth app is in Testing, add the intended Google accounts as test users. Before general release, switch the audience to Production and complete any review Google requests. Test Google login on the exact production domain above.

You can own the Google Cloud project with one Google account while visitors sign in with their own accounts. If you change the website domain, update the OAuth origin and redirect URI to match it exactly. For local development, create a separate development client or add `http://localhost:3000/api/auth/callback/google` to an appropriate development client. Do not send production database credentials to untrusted preview deployments.

Google setup is optional during deployment: a missing Google client disables that button and displays a setup message. Username/password login continues to work.

References: https://authjs.dev/getting-started/providers/google and https://developers.google.com/identity/protocols/oauth2/web-server

## Codespace / local backend

The devcontainer supplies a separate PostgreSQL 16 database. It is separate from Neon production. Set `AUTH_SECRET` and your market keys in Codespaces secrets, or use the ignored `.env.local` for local development. Optional Google credentials can be added later. After adding secrets, stop/start the Codespace to load them.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The dev command applies migrations before starting Next.js. Codespace port 3000 can remain private. The Vercel site and Neon database continue independently after a Codespace is stopped or deleted.

## Verification

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm exec playwright install chromium webkit
pnpm test
pnpm build
```

Tests use isolated in-memory PostgreSQL through PGlite, never the production database. They check anonymous access, registration, password login, incorrect credentials, duplicate usernames, expired sessions, private portfolios, backup restore, sign-out, and responsive onboarding.

## Transfer an old portfolio

Keep the recovery archive until you have checked your restored portfolio. Sign in to the new website, open Settings > Backup & Restore, and restore a portfolio backup. The existing repository also provides `npm run db:export-sqlite` for a nonempty old SQLite database under `prisma/dev.db`; it writes JSON into the ignored `backups/` directory. Legacy SQLite migrations remain in `prisma/legacy` and must not be applied to PostgreSQL.
