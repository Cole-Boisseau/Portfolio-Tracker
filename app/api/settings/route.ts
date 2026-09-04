import { NextResponse } from "next/server";
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

export async function GET() {
  const settings = (await prisma.appSetting.findMany()) as SettingRow[];
  return NextResponse.json(
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  );
}

export async function PUT(request: Request) {
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await Promise.all(
    Object.entries(parsed.data).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) }
      })
    )
  );

  return NextResponse.json({ ok: true });
}
