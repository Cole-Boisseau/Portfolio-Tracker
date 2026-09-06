import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import {
  BackupValidationError,
  createPortfolioBackup,
  portfolioBackupSchema,
  restorePortfolioBackup
} from "@/lib/backup";

export const dynamic = "force-dynamic";

const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

export const GET = withUser(async (_request, _context, userId) => {
  return NextResponse.json(await createPortfolioBackup(userId), {
    headers: { "Cache-Control": "no-store" }
  });
});

export const POST = withUser(async (request, _context, userId) => {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "That backup file is too large." }, { status: 413 });
  }

  const parsed = portfolioBackupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "This is not a valid My Portfolio backup file." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ ok: true, restored: await restorePortfolioBackup(userId, parsed.data) });
  } catch (error) {
    const validationError = error instanceof BackupValidationError;
    return NextResponse.json(
      { error: validationError ? error.message : "The backup could not be restored." },
      { status: validationError ? 400 : 500 }
    );
  }
});
