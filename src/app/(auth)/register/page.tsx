import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { googleEnabled } from "@/auth";
import { getSession } from "@/lib/session";
import { googleSignInAction } from "@/app/actions/auth";
import { AuthShell, GoogleIcon } from "@/components/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if ((await getSession())?.user) redirect("/dashboard");

  return (
    <AuthShell title="Join BookLoop" subtitle="Start sharing books with people nearby.">
      {googleEnabled && (
        <>
          <form action={googleSignInAction}>
            <input type="hidden" name="callbackUrl" value="/settings/profile?welcome=1" />
            <button className="btn-secondary w-full">
              <GoogleIcon /> Sign up with Google
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <hr className="flex-1 border-border" /> or <hr className="flex-1 border-border" />
          </div>
        </>
      )}
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already a member?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
