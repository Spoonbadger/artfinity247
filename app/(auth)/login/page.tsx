import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";
import { enabledProviders } from "@/lib/oauth/providers";

export const metadata: Metadata = { title: "Log in" };
// Which sign-in buttons show depends on env vars read at request time.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="pt-4 sm:pt-10">
      <Suspense>
        <LoginForm providers={enabledProviders()} />
      </Suspense>
    </div>
  );
}
