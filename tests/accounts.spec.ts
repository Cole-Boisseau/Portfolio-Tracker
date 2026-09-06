import { test, expect, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// PGlite multiplexes clients over one connection, so disable persistent prepared statements.
const prisma = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:postgres@127.0.0.1:15432/postgres?connection_limit=1&pgbouncer=true" } } });
const users = ["test-alice", "test-bob"];

async function login(context: BrowserContext, user = "test-alice") {
  await context.addCookies([{
    name: "authjs.session-token", value: `session-${user}`,
    domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax"
  }]);
}

test.beforeEach(async () => {
  for (const id of users) {
    await prisma.user.upsert({ where: { id }, create: { id, name: id, email: `${id}@example.test` }, update: {} });
    await prisma.session.upsert({
      where: { sessionToken: `session-${id}` },
      create: { sessionToken: `session-${id}`, userId: id, expires: new Date(Date.now() + 3600_000) },
      update: { expires: new Date(Date.now() + 3600_000) }
    });
    await prisma.positionLot.deleteMany({ where: { userId: id } });
    await prisma.watchlistItem.deleteMany({ where: { userId: id } });
    await prisma.appSetting.deleteMany({ where: { userId: id } });
  }
});
test.afterAll(() => prisma.$disconnect());

test("all portfolio and market routes reject anonymous requests", async ({ request, page }) => {
  const routes = ["/api/lots", "/api/watchlist", "/api/settings", "/api/summary", "/api/backup", "/api/search?query=AAPL", "/api/stocks/AAPL", "/api/stocks/AAPL/splits?from=2018-01-01", "/api/crypto/bitcoin", "/api/exchange-rate?currency=USD"];
  for (const path of routes) expect((await request.get(path)).status(), path).toBe(401);
  for (const [method, path] of [["POST", "/api/lots"], ["PATCH", "/api/lots/unknown"], ["DELETE", "/api/lots/unknown"], ["POST", "/api/watchlist"], ["DELETE", "/api/watchlist/unknown"], ["PUT", "/api/settings"], ["POST", "/api/summary"], ["POST", "/api/backup"], ["POST", "/api/stocks/AAPL/refresh"]]) {
    expect((await request.fetch(path, { method, data: {} })).status(), `${method} ${path}`).toBe(401);
  }
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
});

test("purchases, watchlists, details, and settings are private to their owner", async ({ context, browser }) => {
  await login(context);
  const bob = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  await login(bob, "test-bob");
  try {
    const created = await context.request.post("/api/lots", { data: { ticker: "AAPL", shares: 4, totalInvested: 2000, purchaseDate: "2018-01-01" } });
    expect(created.status()).toBe(201);
    const lot = await created.json();
    const watched = await context.request.post("/api/watchlist", { data: { ticker: "AAPL" } });
    expect(watched.status()).toBe(201);
    const item = await watched.json();
    expect((await bob.request.get("/api/lots")).ok()).toBeTruthy();
    expect(await (await bob.request.get("/api/lots")).json()).toEqual([]);
    expect(await (await bob.request.get("/api/watchlist")).json()).toEqual([]);
    const details = await (await bob.request.get("/api/stocks/AAPL")).json();
    expect(details.lots).toEqual([]);
    expect(details.inWatchlist).toBe(false);
    expect((await bob.request.patch(`/api/lots/${lot.id}`, { data: { shares: 999 } })).status()).toBe(404);
    await bob.request.delete(`/api/lots/${lot.id}`, { data: {} });
    await bob.request.delete(`/api/watchlist/${item.id}`, { data: {} });
    expect(await prisma.positionLot.count({ where: { id: lot.id } })).toBe(1);
    expect(await prisma.watchlistItem.count({ where: { id: item.id } })).toBe(1);
    expect((await bob.request.post("/api/watchlist", { data: { ticker: "AAPL" } })).status()).toBe(201);
    await context.request.put("/api/settings", { data: { language: "en", currency: "USD" } });
    await bob.request.put("/api/settings", { data: { language: "fr", currency: "EUR" } });
    expect(await (await context.request.get("/api/settings")).json()).toMatchObject({ language: "en", currency: "USD" });
    expect(await (await bob.request.get("/api/settings")).json()).toMatchObject({ language: "fr", currency: "EUR" });
    expect((await (await context.request.get("/api/summary")).json()).totalCost).toBe(2000);
    expect((await (await bob.request.get("/api/summary")).json()).holdings).toEqual([]);
  } finally {
    await bob.close();
  }
});

test("restoring a legacy backup preserves original investment and other accounts", async ({ context }) => {
  await login(context);
  await prisma.positionLot.create({ data: { userId: "test-bob", ticker: "MSFT", shares: 2, purchasePrice: 100, purchaseDate: new Date("2020-01-01") } });
  const backup = {
    format: "my-portfolio-backup", version: 1, exportedAt: new Date().toISOString(),
    lots: [{ assetType: "stock", ticker: "VGT", shares: 4, purchasePrice: 500, purchaseDate: "2018-01-01T00:00:00.000Z", splitFactor: 8, splits: [] }],
    watchlist: [{ assetType: "crypto", assetId: "bitcoin", ticker: "BTC" }],
    settings: { language: "en", currency: "USD" }, favorites: ["stock:VGT"]
  };
  const restored = await context.request.post("/api/backup", { data: { ...backup, userId: "test-bob" } });
  expect(restored.status()).toBe(200);
  expect(await prisma.positionLot.count({ where: { userId: "test-bob" } })).toBe(1);
  const own = await prisma.positionLot.findFirstOrThrow({ where: { userId: "test-alice" } });
  expect(own.shares * own.purchasePrice).toBe(2000);
  expect(own.shares * own.splitFactor).toBe(32);
  const exported = await (await context.request.get("/api/backup")).json();
  expect(exported.lots).toHaveLength(1);
  expect(exported.lots[0].ticker).toBe("VGT");
  expect(exported.watchlist[0].assetId).toBe("bitcoin");
  expect(JSON.stringify(exported)).not.toContain("test-bob");
  const invalid = await context.request.post("/api/backup", { data: { ...backup, watchlist: [backup.watchlist[0], backup.watchlist[0]] } });
  expect(invalid.status()).toBe(400);
  expect(await prisma.positionLot.count({ where: { userId: "test-alice" } })).toBe(1);
});

test("onboarding fits the screen, survives a save failure, and can sign out", async ({ page, context }, testInfo) => {
  await login(context);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath("onboarding.png"), fullPage: true });
  await page.route("**/api/settings", (route) => route.request().method() === "PUT"
    ? route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Temporary test failure"}' })
    : route.continue());
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Welcome back|Dashboard/ }).first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.unroute("**/api/settings");
  const more = page.getByRole("button", { name: "More", exact: true });
  if (await more.isVisible()) await more.click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.request.get("/api/backup")).status()).toBe(401);
  expect(errors).toEqual([]);
});

test("cross-site mutations and expired sessions are rejected", async ({ context }) => {
  await login(context);
  const denied = await context.request.put("/api/settings", { headers: { "sec-fetch-site": "cross-site" }, data: { language: "fr" } });
  expect(denied.status()).toBe(403);
  await prisma.session.update({ where: { sessionToken: "session-test-alice" }, data: { expires: new Date(0) } });
  expect((await context.request.get("/api/lots")).status()).toBe(401);
});
