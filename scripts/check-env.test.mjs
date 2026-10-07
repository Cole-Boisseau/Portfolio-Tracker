import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const valid = {
  DATABASE_URL: "postgresql://test:test@db-pooler.neon.tech/portfolio?sslmode=require",
  DIRECT_URL: "postgresql://test:test@db.neon.tech/portfolio?sslmode=require",
  AUTH_SECRET: "deployment-validation-test-secret-only",
  AUTH_TRUST_HOST: "true",
  POLYGON_API_KEY: "deployment-test-polygon",
  COINGECKO_API_KEY: "deployment-test-coingecko",
  MARKET_PROVIDER: "polygon",
  AUTH_GOOGLE_ID: "",
  AUTH_GOOGLE_SECRET: "",
  FINNHUB_API_KEY: ""
};

function check(overrides = {}) {
  const result = spawnSync(process.execPath, ["scripts/check-env.mjs"], {
    env: { ...process.env, ...valid, ...overrides }, encoding: "utf8"
  });
  assert.ifError(result.error);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(valid.AUTH_SECRET), "Secrets must not appear in diagnostics");
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("valid configuration supports password-only or complete Google sign-in", () => {
  assert.equal(check().status, 0);
  assert.equal(check({ AUTH_GOOGLE_ID: "test-client", AUTH_GOOGLE_SECRET: "test-client-secret" }).status, 0);
});

for (const [name, overrides, diagnostic] of [
  ["missing database", { DATABASE_URL: "" }, "DATABASE_URL"],
  ["blank API key", { COINGECKO_API_KEY: "   " }, "COINGECKO_API_KEY"],
  ["SQLite database", { DATABASE_URL: "file:./dev.db" }, "PostgreSQL"],
  ["invalid migration connection", { DIRECT_URL: "https://db.neon.tech/portfolio" }, "DIRECT_URL"],
  ["missing database name", { DIRECT_URL: "postgresql://test:test@db.neon.tech/?sslmode=require" }, "DIRECT_URL"],
  ["missing database path", { DIRECT_URL: "postgresql://test:test@db.neon.tech?sslmode=require" }, "DIRECT_URL"],
  ["unencrypted Neon connection", { DATABASE_URL: "postgresql://test:test@db.neon.tech/portfolio?sslmode=disable" }, "SSL"],
  ["short session secret", { AUTH_SECRET: "short" }, "32 characters"],
  ["untrusted proxy", { AUTH_TRUST_HOST: "" }, "AUTH_TRUST_HOST"],
  ["demo market prices", { MARKET_PROVIDER: "demo" }, "MARKET_PROVIDER"],
  ["unknown market provider", { MARKET_PROVIDER: "polgyon" }, "MARKET_PROVIDER"],
  ["missing Finnhub key", { MARKET_PROVIDER: "finnhub" }, "FINNHUB_API_KEY"],
  ["partial Google credentials", { AUTH_GOOGLE_ID: "test-client" }, "both AUTH_GOOGLE_ID"]
]) {
  test(`deployment refuses ${name}`, () => {
    const result = check(overrides);
    assert.equal(result.status, 1);
    assert.ok(result.output.includes(diagnostic), result.output);
  });
}
