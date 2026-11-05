import { Suspense } from "react";
import type { Metadata } from "next";
import crypto from "crypto";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "New password" };
export const dynamic = "force-dynamic";

/** Checks the emailed link before showing the form, so an expired or used link says so right away. */
async function linkStatus(token: string | undefined): Promise<"ok" | "missing" | "expired" | "used"> {
  if (!token) return "missing";
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, select: { expiresAt: true } }).catch(() => null);
  if (!record) return "used";
  return record.expiresAt < new Date() ? "expired" : "ok";
}

export default async function Page({ searchParams }: { searchParams: { token?: string } }) {
  const status = await linkStatus(searchParams.token);
  return (
    <div className="pt-4 sm:pt-10">
      <Suspense>
        <ResetPasswordForm status={status} />
      </Suspense>
    </div>
  );
}
