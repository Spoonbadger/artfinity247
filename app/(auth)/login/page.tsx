import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <div className="pt-4 sm:pt-10">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
