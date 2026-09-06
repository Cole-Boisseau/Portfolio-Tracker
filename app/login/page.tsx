import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { ChartNoAxesCombined, Github, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (session?.user?.id) redirect("/");
  const { error } = await searchParams;
  const configured = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET && process.env.AUTH_SECRET);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <ChartNoAxesCombined aria-hidden="true" className="mb-6 h-12 w-12 text-primary" />
        <h1 className="text-3xl font-semibold">My Portfolio</h1>
        <p className="mt-3 text-base text-muted-foreground">Sign in to your portfolio.</p>
        {error ? <p role="alert" className="mt-6 text-sm text-destructive">Sign-in did not finish. Please try again.</p> : null}
        {!configured ? <p role="status" className="mt-6 text-sm text-muted-foreground">Sign-in is being set up. Please check back shortly.</p> : null}
        <form className="mt-8" action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/" });
        }}>
          <button disabled={!configured} type="submit" className="flex min-h-12 w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50">
            <Github aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span>Continue with GitHub</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </button>
        </form>
      </div>
    </main>
  );
}
