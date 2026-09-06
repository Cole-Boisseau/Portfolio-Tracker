import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

nextEnv.loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const url = process.env.DATABASE_URL;
if (!url?.match(/^postgres(ql)?:\/\//)) {
  console.error("Set DATABASE_URL and DIRECT_URL to PostgreSQL connections. For an existing SQLite portfolio, run npm run db:export-sqlite first. See DEPLOYMENT.md.");
  process.exit(1);
}
process.env.DIRECT_URL ||= url;
const result = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
  stdio: "inherit", env: process.env
});
if (result.error) console.error("Unable to start database migrations. Reinstall dependencies and try again.");
process.exit(result.status ?? 1);
