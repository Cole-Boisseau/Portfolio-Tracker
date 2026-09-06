import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Tests use an in-memory PostgreSQL instance, never a developer or Neon database.
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 15432, maxConnections: 10 });
await server.start();
const env = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:15432/postgres?connection_limit=1&pgbouncer=true",
  DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:15432/postgres?connection_limit=1",
  AUTH_SECRET: "local-integration-tests-only-not-a-deployment-secret",
  AUTH_GITHUB_ID: "test-oauth-client",
  AUTH_GITHUB_SECRET: "test-oauth-secret",
  AUTH_URL: "http://127.0.0.1:3100",
  AUTH_TRUST_HOST: "true",
  MARKET_PROVIDER: "demo",
  POLYGON_API_KEY: "",
  COINGECKO_API_KEY: ""
};
let app;
async function stop() {
  app?.kill();
  await server.stop();
  await db.close();
}
process.on("SIGTERM", () => void stop().finally(() => process.exit()));
process.on("SIGINT", () => void stop().finally(() => process.exit()));

try {
  await new Promise((resolve, reject) => {
    const migration = spawn(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], { env, stdio: "inherit" });
    migration.on("error", reject);
    migration.on("exit", (code) => code === 0 ? resolve() : reject(new Error("Test migrations failed")));
  });
  app = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3100"], { env, stdio: "inherit" });
  app.on("exit", () => void stop().finally(() => process.exit()));
} catch (error) {
  console.error(error);
  await stop();
  process.exit(1);
}
