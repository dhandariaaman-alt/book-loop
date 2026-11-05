import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Choose a new password">
      {token ? (
        <ResetForm token={token} />
      ) : (
        <p className="text-sm text-muted">
          This link is missing its reset code.{" "}
          <Link href="/forgot-password" className="text-brand hover:underline">Request a new link</Link>.
        </p>
      )}
    </AuthShell>
  );
}
