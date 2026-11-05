import type { Metadata } from "next";
import Link from "next/link";
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
      <div>
        <p className="eyebrow">Settings</p>
        <h1 className="display text-[44px] sm:text-[56px]">Code print prices</h1>
        <p className="text-[14px] text-ink-2">
          Artists can have us print the codes in their print queue: laminated, pre-cut and mailed. They pay what it costs us, and the page tells them so (&ldquo;At cost:
          we don&apos;t make money on these&rdquo;). Set what one card costs to print, laminate and cut in each format, plus postage. Orders are in{" "}
          <Link href="/admin/code-orders" className="font-semibold text-scan">Code orders</Link>.
        </p>
      </div>
      {placeholder && (
        <p role="status" className="rounded-xl border border-sticker bg-sticker/20 p-4 text-[14px]">
          <b>Placeholder prices: set by Craig.</b> These are guesses so the page works. Artists see them now; save the real costs below.
        </p>
      )}
      <CodePrintsForm value={value} placeholder={placeholder} />
    </div>
  );
}
