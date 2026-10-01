"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allowAuthAttempt, hashPassword, normalizeUsername } from "@/lib/password-auth";

export type LoginState = { error?: string };

export async function passwordSignIn(_: LoginState, form: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      username: form.get("username"), password: form.get("password"), redirectTo: "/"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Unable to sign in. Check your username and password, or try again in 15 minutes." };
    }
    throw error;
  }
  return {};
}

export async function register(_: LoginState, form: FormData): Promise<LoginState> {
  const username = normalizeUsername(form.get("username"));
  const password = form.get("password");
  if (!username) return { error: "Use 3–32 letters, numbers, dots, hyphens or underscores for your username." };
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return { error: "Choose a password with 12–128 characters." };
  }
  if (password !== form.get("confirmPassword")) return { error: "Your passwords do not match." };
  try {
    if (!await allowAuthAttempt(username, await headers(), true)) {
      return { error: "Too many attempts. Please try again in 15 minutes." };
    }
    if (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
      return { error: "That username is unavailable. Please choose another." };
    }
    await prisma.user.create({ data: { username, name: username, passwordHash: await hashPassword(password) } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { error: "That username is unavailable. Please choose another." };
    }
    return { error: "Your account could not be created. Please try again shortly." };
  }
  return passwordSignIn({}, form);
}

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/" });
}
