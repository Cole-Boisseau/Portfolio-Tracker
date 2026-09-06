import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  density: z.enum(["compact", "comfortable"]).optional(),
  accent: z.enum(["emerald", "blue", "rose", "amber"]).optional(),
  currency: z.enum(["USD", "EUR", "JPY", "GBP", "CNY", "CHF", "AUD", "CAD", "HKD", "SGD"]).optional(),
  language: z.enum(["en", "es", "fr", "pt", "zh-CN", "de", "ja"]).optional()
});

type SettingRow = {
  key: string;
  value: string;
};

export const GET = withUser(async (_request, _context, userId) => {
  const settings = (await prisma.appSetting.findMany({ where: { userId } })) as SettingRow[];
  return NextResponse.json(
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  );
});

export const PUT = withUser(async (request, _context, userId) => {
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction(
    Object.entries(parsed.data).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key, value: String(value) },
        update: { value: String(value) }
      })
    )
  );

  return NextResponse.json({ ok: true });
});
