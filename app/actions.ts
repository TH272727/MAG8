"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { insertSignup } from "@/lib/db";

export interface ActionState {
  ok: boolean;
  message: string;
}

export async function subscribeEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.email().max(200).safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) {
    return { ok: false, message: "That doesn't look like an email address — check it and try again." };
  }
  const isNew = insertSignup(parsed.data);
  return {
    ok: true,
    message: isNew ? "You're on the list." : "Already on the list — you're set.",
  };
}

export async function adminLogin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  if (!token || !tokenMatches(token)) {
    return { ok: false, message: "Wrong token. Check ADMIN_TOKEN on the server." };
  }
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin");
}
