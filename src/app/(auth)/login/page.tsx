import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, googleEnabled } from "@/auth";
import { googleSignInAction } from "@/app/actions/auth";
import { AuthShell, GoogleIcon } from "@/components/auth-shell";
import { safeRedirect } from "@/lib/validation";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "An account with this email already exists. Sign in with your email and password instead.",
  AccessDenied: "This account can't sign in right now.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const redirectTo = safeRedirect(callbackUrl);
  if ((await auth())?.user) redirect(redirectTo);

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to see books near you.">
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {ERRORS[error] ?? "Sign-in failed. Please try again."}
        </p>
      )}
      {googleEnabled && (
        <>
          <form action={googleSignInAction}>
            <input type="hidden" name="callbackUrl" value={redirectTo} />
            <button className="btn-secondary w-full">
              <GoogleIcon /> Continue with Google
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <hr className="flex-1 border-border" /> or <hr className="flex-1 border-border" />
          </div>
        </>
      )}
      <LoginForm callbackUrl={redirectTo} />
      <p className="mt-6 text-center text-sm text-muted">
        New to BookLoop?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
