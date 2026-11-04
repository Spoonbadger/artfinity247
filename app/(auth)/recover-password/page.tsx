import { Suspense } from "react";
import type { Metadata } from "next";
import RecoverPasswordForm from "@/components/auth/RecoverPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <div className="pt-4 sm:pt-10">
      <Suspense>
        <RecoverPasswordForm />
      </Suspense>
    </div>
  );
}
