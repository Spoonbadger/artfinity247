import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "../../_components/ui";
import { adminRoleOrRedirect } from "../../_components/gate";
import { codePrintPricing } from "@/lib/codePrints";
import CodePrintsForm from "./CodePrintsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Code print prices" };

/** What artists pay for printed, laminated, pre-cut QR codes mailed to them. At cost: Artfinity makes nothing. */
export default async function CodePrintsSettingsPage() {
  await adminRoleOrRedirect("/admin/settings/code-prints");
  const p = await codePrintPricing();
  const { placeholder, ...value } = p;
  return (
    <div className="grid max-w-[720px] gap-5">
      <PageHead
        level={2}
        title="Code print prices"
        sub={<>What one card costs us to print, laminate and cut, plus postage. Artists pay it at cost. <Link href="/admin/code-orders" className="font-semibold text-scan">Code orders</Link></>}
      />
      {placeholder && (
        <p role="status" className="rounded-xl border border-sticker bg-sticker/20 p-4 text-[14px]">
          <b>Placeholder prices: set by Craig.</b> These are guesses so the page works. Artists see them now; save the real costs below.
        </p>
      )}
      <CodePrintsForm value={value} placeholder={placeholder} />
    </div>
  );
}
