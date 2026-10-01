import { randomBytes, scrypt, timingSafeEqual, createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

const prefix = "scrypt:32768:8:3";
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, options, (error, result) => error ? reject(error) : resolve(result));
});

export function normalizeUsername(value: unknown) {
  if (typeof value !== "string") return null;
  const username = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) ? username : null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${prefix}:${salt}:${(await derive(password, salt)).toString("hex")}`;
}

export async function checkPassword(password: string, hash?: string | null) {
  // Unknown usernames and Google-only accounts do the same expensive work.
  const parts = hash?.split(":");
  const valid = parts?.length === 6 && parts.slice(0, 4).join(":") === prefix
    && /^[a-f0-9]{32}$/.test(parts[4]) && /^[a-f0-9]{128}$/.test(parts[5]);
  const actual = await derive(password, valid ? parts[4] : "00000000000000000000000000000000");
  const expected = valid ? Buffer.from(parts[5], "hex") : Buffer.alloc(64);
  return timingSafeEqual(actual, expected) && Boolean(valid);
}

export async function allowAuthAttempt(username: string, requestHeaders: Headers, registration = false) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const buckets = registration ? [[`register:${ip}`, 20] as const]
    : [[`login-user:${username}`, 20] as const, [`login-ip:${ip}`, 100] as const];
  for (const [identifier, limit] of buckets) {
    const key = createHmac("sha256", secret).update(identifier).digest("hex");
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "AuthAttempt" ("key", "count", "resetAt")
      VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "AuthAttempt"."resetAt" <= NOW() THEN 1 ELSE "AuthAttempt"."count" + 1 END,
        "resetAt" = CASE WHEN "AuthAttempt"."resetAt" <= NOW() THEN NOW() + INTERVAL '15 minutes' ELSE "AuthAttempt"."resetAt" END
      RETURNING "count"`;
    if (rows[0].count > limit) return false;
  }
  return true;
}
