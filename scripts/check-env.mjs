import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const required = ["DATABASE_URL", "DIRECT_URL", "AUTH_SECRET", "POLYGON_API_KEY", "COINGECKO_API_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim() || /your[_-]|replace[_-]|example\.com/i.test(process.env[name]));
if (missing.length) {
  console.error(`Add these environment variables before deploying: ${missing.join(", ")}. See DEPLOYMENT.md.`);
  process.exit(1);
}
if (process.env.AUTH_SECRET.length < 32) {
  console.error("AUTH_SECRET must be a randomly generated value of at least 32 characters.");
  process.exit(1);
}
for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  try {
    const url = new URL(process.env[name]);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) throw new Error();
    if (url.hostname.endsWith(".neon.tech") && !["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode"))) throw new Error();
  } catch {
    console.error(`${name} must be a PostgreSQL connection with a database name. Neon connections must require SSL.`);
    process.exit(1);
  }
}
if (process.env.AUTH_TRUST_HOST !== "true") {
  console.error("Set AUTH_TRUST_HOST to true when deploying behind Vercel's trusted proxy.");
  process.exit(1);
}
if (!["polygon", "finnhub"].includes(process.env.MARKET_PROVIDER || "polygon")) {
  console.error("Use MARKET_PROVIDER=polygon or finnhub for deployment. Demo prices are only for local development.");
  process.exit(1);
}
if (process.env.MARKET_PROVIDER === "finnhub" && (!process.env.FINNHUB_API_KEY?.trim() || /your[_-]|replace[_-]/i.test(process.env.FINNHUB_API_KEY))) {
  console.error("Add FINNHUB_API_KEY when using the Finnhub provider.");
  process.exit(1);
}
if (Boolean(process.env.AUTH_GOOGLE_ID) !== Boolean(process.env.AUTH_GOOGLE_SECRET)) {
  console.error("Set both AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or leave both unset for username/password sign-in.");
  process.exit(1);
}
console.log("Deployment environment is configured. Secret values are hidden.");
if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
  console.warn("Google sign-in is not configured yet. Username and password sign-in is available.");
}
