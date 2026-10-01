import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ChartNoAxesCombined } from "lucide-react";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (session?.user?.id) redirect("/");
  const { error } = await searchParams;
  const configured = Boolean(process.env.AUTH_SECRET);
  const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <ChartNoAxesCombined aria-hidden="true" className="mb-6 h-12 w-12 text-primary" />
        <h1 className="text-3xl font-semibold">My Portfolio</h1>
        <p className="mt-3 text-base text-muted-foreground">Sign in to your portfolio.</p>
        {error ? <p role="alert" className="mt-6 text-sm text-destructive">Google sign-in did not finish. Please try again or sign in with your username.</p> : null}
        {!configured ? <p role="status" className="mt-6 text-sm text-muted-foreground">Sign-in is being set up. Please check back shortly.</p> : null}
        <LoginForm configured={configured} googleConfigured={googleConfigured} />
      </div>
    </main>
  );
}
