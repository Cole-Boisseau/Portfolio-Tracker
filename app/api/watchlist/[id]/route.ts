import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const DELETE = withUser(async (_request, context: { params: Promise<{ id: string }> }, userId) => {
  const { id } = await context.params;
  await prisma.watchlistItem.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
});
