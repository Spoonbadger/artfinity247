import { Suspense } from "react";
import type { Metadata } from "next";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";

export const metadata: Metadata = { title: "Change password" };

export default function Page() {
  return (
    <div className="pt-4 sm:pt-10">
      <Suspense>
        <ChangePasswordForm />
      </Suspense>
    </div>
  );
}
