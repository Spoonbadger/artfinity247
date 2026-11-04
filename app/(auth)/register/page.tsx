import { Suspense } from "react";
import type { Metadata } from "next";
import RegisterFlow from "@/components/auth/RegisterFlow";

export const metadata: Metadata = { title: "Claim your page" };

export default function Page() {
  return (
    <div className="sm:pt-4">
      <Suspense>
        <RegisterFlow />
      </Suspense>
    </div>
  );
}
