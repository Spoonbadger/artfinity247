import { Suspense } from "react";
import type { Metadata } from "next";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "New password" };

export default function Page() {
  return (
    <div className="pt-4 sm:pt-10">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
