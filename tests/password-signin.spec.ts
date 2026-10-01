import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";

const prisma = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:postgres@127.0.0.1:15432/postgres?connection_limit=1&pgbouncer=true" } } });
test.afterAll(() => prisma.$disconnect());

test("registration, password login, invalid credentials and sign-out work", async ({ page, context }, testInfo) => {
  const username = `signup-${testInfo.project.name}`;
  await prisma.user.deleteMany({ where: { username } });
  await prisma.authAttempt.deleteMany();
  await page.goto("/login");
  await expect(page.getByText("Continue with GitHub")).toHaveCount(0);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username.toUpperCase());
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
  await page.getByLabel("Confirm password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  const saved = await prisma.user.findUniqueOrThrow({ where: { username } });
  expect(saved.passwordHash).toMatch(/^scrypt:32768:8:3:/);
  expect(saved.passwordHash).not.toContain("correct horse");
  expect((await context.request.get("/api/lots")).status()).toBe(200);
  const csrf = await (await context.request.get("/api/auth/csrf")).json();
  await context.request.post("/api/auth/signout", { form: { csrfToken: csrf.csrfToken } });
  expect((await context.request.get("/api/lots")).status()).toBe(401);
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("incorrect password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Unable to sign in" })).toBeVisible();
  expect((await context.request.get("/api/lots")).status()).toBe(401);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  expect((await context.request.get("/api/lots")).status()).toBe(200);
  const rateKey = createHmac("sha256", "local-integration-tests-only-not-a-deployment-secret").update(`login-user:${username}`).digest("hex");
  await prisma.authAttempt.update({ where: { key: rateKey }, data: { count: 20, resetAt: new Date(Date.now() + 900_000) } });
  const nextCsrf = await (await context.request.get("/api/auth/csrf")).json();
  await context.request.post("/api/auth/signout", { form: { csrfToken: nextCsrf.csrfToken } });
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Unable to sign in" })).toBeVisible();
  expect((await context.request.get("/api/lots")).status()).toBe(401);
  await prisma.authAttempt.update({ where: { key: rateKey }, data: { resetAt: new Date(0) } });
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
});

test("duplicate usernames cannot replace an existing account", async ({ page, context }, testInfo) => {
  const username = `existing-${testInfo.project.name}`;
  await prisma.user.upsert({ where: { username }, create: { username, name: "original", passwordHash: null }, update: {} });
  await prisma.authAttempt.deleteMany();
  await page.goto("/login");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("another strong password");
  await page.getByLabel("Confirm password").fill("another strong password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "username is unavailable" })).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { username } })).passwordHash).toBeNull();
  expect((await context.request.get("/api/lots")).status()).toBe(401);
});

test("the Google OAuth flow uses the Google callback", async ({ page }) => {
  await page.goto("/login");
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({ contentType: "text/html", body: "Google OAuth test destination" }));
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/accounts\.google\.com/);
  const url = new URL(page.url());
  expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3100/api/auth/callback/google");
});
