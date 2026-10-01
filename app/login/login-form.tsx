"use client";

import { useActionState, useState } from "react";
import { passwordSignIn, register, googleSignIn } from "./actions";

export default function LoginForm({ googleConfigured, configured }: { googleConfigured: boolean; configured: boolean }) {
  const [creating, setCreating] = useState(false);
  const [loginState, loginAction, loginPending] = useActionState(passwordSignIn, {});
  const [registerState, registerAction, registerPending] = useActionState(register, {});
  const pending = loginPending || registerPending;
  const error = creating ? registerState.error : loginState.error;
  const field = "mt-2 min-h-12 w-full rounded-md border border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary";
  return (
    <div className="mt-7">
      <form action={creating ? registerAction : loginAction} className="space-y-5">
        <div>
          <label htmlFor="username" className="text-sm font-medium">Username</label>
          <input className={field} id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={32} required disabled={pending} />
          {creating ? <p className="mt-2 text-xs text-muted-foreground">3–32 letters, numbers, dots, hyphens or underscores.</p> : null}
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input className={field} id="password" name="password" type="password" autoComplete={creating ? "new-password" : "current-password"} minLength={creating ? 12 : undefined} maxLength={128} required disabled={pending} />
          {creating ? <p className="mt-2 text-xs text-muted-foreground">Use at least 12 characters.</p> : null}
        </div>
        {creating ? <div>
          <label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</label>
          <input className={field} id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={pending} />
        </div> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <button disabled={!configured || pending} type="submit" className="min-h-12 w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Please wait…" : creating ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        {creating ? "Already have an account? " : "New here? "}
        <button type="button" disabled={pending} onClick={() => setCreating(!creating)} className="font-medium text-primary underline underline-offset-4">
          {creating ? "Sign in" : "Create an account"}
        </button>
      </p>
      <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
      <form action={googleSignIn}>
        <button disabled={!configured || !googleConfigured || pending} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-3 font-medium disabled:opacity-50" type="submit">
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.1Z" /><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.4A20 20 0 0 0 24 44Z" /><path fill="#FBBC05" d="M12.6 27.4a12 12 0 0 1 0-7.5v-5.4H5.7a20 20 0 0 0 0 18.3l6.9-5.4Z" /><path fill="#EA4335" d="M24 11.9c3 0 5.6 1 7.7 3l5.7-5.7A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.7 14.5l6.9 5.4A12 12 0 0 1 24 11.9Z" /></svg>
          Continue with Google
        </button>
      </form>
      {!googleConfigured ? <p role="status" className="mt-3 text-center text-xs text-muted-foreground">Google sign-in is being set up. You can use a username and password.</p> : null}
    </div>
  );
}
