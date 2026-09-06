import { NextResponse } from "next/server";
import { auth } from "@/auth";

type UserHandler<Context> = (request: Request, context: Context, userId: string) => Promise<Response>;

// Every portfolio and market endpoint authenticates here before touching data or provider quotas.
export function withUser<Context = unknown>(handler: UserHandler<Context>) {
  return async (request: Request, context: Context) => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
      }

      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        // JSON requests cannot be submitted by cross-site HTML forms.
        const contentType = request.headers.get("content-type")?.split(";")[0].trim();
        if (contentType !== "application/json" || request.headers.get("sec-fetch-site") === "cross-site") {
          return NextResponse.json({ error: "This request is not allowed." }, { status: 403 });
        }
      }

      const response = await handler(request, context, session.user.id);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch {
      return NextResponse.json(
        { error: "Your portfolio could not be saved or loaded. Please try again shortly." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
  };
}
