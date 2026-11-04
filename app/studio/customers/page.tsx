import Link from "next/link";
import { Mail } from "lucide-react";
import { PaintChip } from "@/components/af/Brush";
import { StudioPage } from "@/components/studio/StudioPage";
import CustomerList, { type CustomerRow } from "@/components/crm/CustomerList";
import { requireArtist } from "../_lib/data";
import { customerHref, getCustomers, maskEmail } from "./_lib";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const artist = await requireArtist("/studio/customers");
  const customers = await getCustomers(artist.id);

  const rows: CustomerRow[] = customers.map((c) => {
    const latest = c.orders[0]?.items[0];
    return {
      email: c.email,
      href: customerHref(c.email),
      masked: maskEmail(c.email),
      name: c.name,
      city: c.city,
      first: c.first.toISOString(),
      last: c.last.toISOString(),
      orders: c.orders.length,
      prints: c.prints,
      spentCents: c.spentCents,
      stage: c.stage,
      repeat: c.repeat,
      thumb: latest?.imageUrl || null,
      thumbTitle: latest?.title || "",
      pieces: Array.from(new Set(c.orders.flatMap((o) => o.items.map((i) => i.title)))),
    };
  });
  const prints = customers.reduce((n, c) => n + c.prints, 0);
  const repeat = customers.filter((c) => c.repeat).length;
  const inTransit = customers.filter((c) => c.stage !== "delivered").length;

  return (
    <StudioPage
      title="Customers"
      sub={customers.length ? `${customers.length} ${customers.length === 1 ? "person owns" : "people own"} your work.` : undefined}
      actions={
        <Link href="/studio/emails" className="btn btn-ghost btn-sm">
          <Mail className="h-4 w-4" aria-hidden="true" />Automated emails
        </Link>
      }
    >
      {customers.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-[4px] border-2 border-dashed border-line bg-wall px-6 py-16 text-center">
          <h2 className="display text-[34px]">No buyers yet.</h2>
          <p className="text-ink-2">They will show up here after the first sale.</p>
          <Link href="/studio/qr" className="btn btn-blue">Print codes</Link>
        </div>
      ) : (
        <>
          <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <PaintChip color="#c98a5a" value={customers.length} label="customers" note="Raw sienna" />
            <PaintChip color="#e8743b" value={prints} label="prints out in the world" note="Cadmium" />
            <PaintChip color="#ffd43b" value={repeat} label={repeat === 1 ? "repeat buyer" : "repeat buyers"} note="Hansa yellow" />
            <PaintChip color="#2b37f0" value={inTransit} label="still waiting on a print" note="Ultramarine" />
          </section>
          <CustomerList rows={rows} />
        </>
      )}
    </StudioPage>
  );
}
