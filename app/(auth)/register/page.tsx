import { Suspense } from "react";
import type { Metadata } from "next";
import RegisterFlow from "@/components/auth/RegisterFlow";
import { enabledProviders } from "@/lib/oauth/providers";

export const metadata: Metadata = { title: "Claim your page" };
// Which sign-in buttons show depends on env vars read at request time.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="sm:pt-4">
      <Suspense>
        <RegisterFlow providers={enabledProviders()} />
      </Suspense>
    </div>
  );
}
