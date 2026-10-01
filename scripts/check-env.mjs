import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const required = ["DATABASE_URL", "DIRECT_URL", "AUTH_SECRET", "POLYGON_API_KEY", "COINGECKO_API_KEY"];
const missing = required.filter((name) => !process.env[name] || /your[_-]|replace[_-]|example\.com/i.test(process.env[name]));
if (missing.length) {
  console.error(`Add these environment variables before deploying: ${missing.join(", ")}. See DEPLOYMENT.md.`);
  process.exit(1);
}
if (process.env.AUTH_SECRET.length < 32) {
  console.error("AUTH_SECRET must be a randomly generated value of at least 32 characters.");
  process.exit(1);
}
console.log("Deployment environment is configured. Secret values are hidden.");
if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
  console.warn("Google sign-in is not configured yet. Username and password sign-in is available.");
}
