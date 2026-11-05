"use server";

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mail";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  safeRedirect,
} from "@/lib/validation";

export type FormState = { error?: string; success?: string };

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 5, 60 * 60_000)) {
    return { error: "Too many sign-up attempts. Please try again later." };
  }

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, username, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true },
  });
  if (existing) {
    return {
      error: existing.email === email ? "An account with this email already exists." : "That username is taken.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, username, passwordHash, profile: { create: {} } },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/settings/profile?welcome=1" });
  } catch (e) {
    if (e instanceof AuthError) return { success: "Account created. Please sign in." };
    throw e; // Next.js redirect
  }
  return {};
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 20, 15 * 60_000) || !rateLimit(`login:${parsed.data.email}`, 8, 15 * 60_000)) {
    return { error: "Too many sign-in attempts. Please wait a few minutes." };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (e) {
    if (e instanceof CredentialsSignin && e.code === "suspended") {
      return { error: "This account has been suspended. Contact support if you think this is a mistake." };
    }
    if (e instanceof AuthError) return { error: "Incorrect email or password." };
    throw e;
  }
  return {};
}

export async function googleSignInAction(formData: FormData) {
  await signIn("google", { redirectTo: safeRedirect(formData.get("callbackUrl")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ip = await clientIp();
  if (!rateLimit(`forgot:${ip}`, 5, 60 * 60_000)) {
    return { error: "Too many requests. Please try again later." };
  }

  // Same reply whether or not the account exists, so emails can't be probed.
  const generic = { success: "If that email has a BookLoop password, a reset link is on its way." };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, passwordHash: true, status: true },
  });
  if (!user?.passwordHash || user.status !== "ACTIVE") return generic;

  const token = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expires: new Date(Date.now() + 60 * 60_000) },
    }),
  ]);

  const base = process.env.APP_URL ?? "http://localhost:3000";
  await sendMail({
    to: user.email,
    subject: "Reset your BookLoop password",
    text: `Someone asked to reset your BookLoop password.\n\nReset it here (valid for 1 hour):\n${base}/reset-password?token=${token}\n\nIf this wasn't you, you can ignore this email.`,
  });
  return generic;
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.usedAt || record.expires < new Date()) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } }),
  ]);
  return { success: "Your password has been updated. You can sign in now." };
}
