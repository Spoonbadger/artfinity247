import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import HelpLink from "@/components/help/HelpLink";
import PaymentReturn from "@/components/payments/PaymentReturn";
import PrintCodes from "@/components/print/PrintCodes";
import { printablePieces } from "@/lib/printJob";
import { printPreset, type PresetParams } from "@/lib/printPreset";
import { codePrintPricing, confirmFromSession, isInfinity } from "@/lib/codePrints";
import { codeOrderNumber, type ShipAddress } from "@/lib/printQueueFormat";
import { artistIsPro } from "@/lib/qr/plan";
import { requireArtist, displayName } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Print codes" };

export default async function PrintCodesPage({ searchParams }: { searchParams: PresetParams & { paid?: string; session_id?: string; canceled?: string } }) {
  const artist = await requireArtist("/studio/print");

  // Back from Stripe: confirm the payment now in case the webhook hasn't arrived yet.
  if (searchParams.paid && searchParams.session_id) await confirmFromSession(searchParams.paid, searchParams.session_id, artist.id).catch(() => false);

  const [{ pieces }, { preset, note }, pricing, infinity, pro, lastOrder, back] = await Promise.all([
    printablePieces(artist.id),
    printPreset(artist.id, searchParams, { carryQueue: true }),
    codePrintPricing(),
    isInfinity(artist.id),
    artistIsPro(artist.id),
    prisma.codePrintOrder.findFirst({ where: { artistId: artist.id, status: { not: "canceled" } }, orderBy: { createdAt: "desc" } }),
    searchParams.paid || searchParams.canceled
      ? prisma.codePrintOrder.findFirst({ where: { artistId: artist.id, id: searchParams.paid || searchParams.canceled }, select: { id: true, status: true } })
      : null,
  ]);

  const address: ShipAddress = lastOrder
    ? { name: lastOrder.shipName, line1: lastOrder.shipLine1, line2: lastOrder.shipLine2 || "", city: lastOrder.shipCity, state: lastOrder.shipState, zip: lastOrder.shipZip }
    : { name: displayName(artist), line1: "", line2: "", city: artist.city || "", state: (await prisma.artist.findUnique({ where: { id: artist.id }, select: { state: true } }))?.state || "", zip: "" };
  const { placeholder: _p, ...prices } = pricing;

  return (
    <StudioPage
      title="Print codes"
      sub="Pick pieces, sizes and copies. We fit them on as few sheets as possible."
      actions={<><HelpLink href="/help/qr-codes/print-codes" /><Link href="/studio/codes" className="btn btn-ghost btn-sm">My codes</Link><Link href="/studio/qr" className="btn btn-ghost btn-sm">Design a code</Link></>}
    >
      {back && searchParams.paid && back.status !== "pending" && <PaymentReturn kind="paid" message={`Paid. Order ${codeOrderNumber(back.id)} is in`} description="Receipt sent to your email. Tracking follows when they ship." strip={["paid", "session_id"]} />}
      {back && searchParams.canceled && <PaymentReturn kind="canceled" message="Nothing was charged" description="Your pieces are still ticked below." strip={["canceled"]} />}
      <PrintCodes
        pieces={pieces}
        preset={preset}
        pro={pro}
        note={note}
        mail={{ pricing: prices, infinity, address, testMode: !process.env.STRIPE_SECRET_KEY }}
      />
    </StudioPage>
  );
}
