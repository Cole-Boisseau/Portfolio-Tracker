import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

test("authentication limits keep UTC expiry, clean old records, and trust Vercel's client address", async () => {
  // All queries use a fresh in-memory database, regardless of developer environment settings.
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 15434, maxConnections: 5 });
  let prisma;
  try {
    for (const directory of (await readdir("prisma/migrations", { withFileTypes: true })).filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await db.exec(await readFile(`prisma/migrations/${directory.name}/migration.sql`, "utf8"));
    }
    await server.start();
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:15434/postgres?connection_limit=1&pgbouncer=true";
    process.env.DIRECT_URL = process.env.DATABASE_URL;
    process.env.AUTH_SECRET = "isolated-rate-limit-test-secret-only";
    process.env.VERCEL = "1";
    const { allowAuthAttempt } = await import("../lib/password-auth.ts");
    ({ prisma } = await import("../lib/prisma.ts"));
    await prisma.$connect();
    await db.exec("SET TIME ZONE 'Pacific/Honolulu'");
    const key = (value) => createHmac("sha256", process.env.AUTH_SECRET).update(value).digest("hex");
    const headers = new Headers({ "x-vercel-forwarded-for": "192.0.2.1", "x-forwarded-for": "spoofed" });
    await prisma.authAttempt.create({ data: { key: "expired-test-row", count: 10, resetAt: new Date(0) } });
    const started = Date.now();
    assert.equal(await allowAuthAttempt("timezone-user", headers), true);
    assert.equal(await prisma.authAttempt.count({ where: { key: "expired-test-row" } }), 0);
    assert.equal(await prisma.authAttempt.count({ where: { key: key("login-ip:spoofed") } }), 0);
    const counter = await prisma.authAttempt.findUniqueOrThrow({ where: { key: key("login-user:timezone-user") } });
    assert.ok(Math.abs(counter.resetAt.getTime() - (started + 900_000)) < 10_000, "Expiry must be 15 minutes ahead in UTC, even in a non-UTC database");
    await prisma.authAttempt.update({ where: { key: counter.key }, data: { count: 20 } });
    assert.equal(await allowAuthAttempt("timezone-user", headers), false);
    await prisma.authAttempt.update({ where: { key: counter.key }, data: { resetAt: new Date(0) } });
    assert.equal(await allowAuthAttempt("timezone-user", headers), true);
    await prisma.authAttempt.update({ where: { key: key("login-ip:192.0.2.1") }, data: { count: 100 } });
    assert.equal(await allowAuthAttempt("another-user", headers), false);
    assert.equal(await prisma.authAttempt.count({ where: { key: key("login-user:another-user") } }), 0);
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
});
