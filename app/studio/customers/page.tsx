import Link from "next/link";
import { Mail } from "lucide-react";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
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

  return (
    <StudioPage
      title="Customers"
      sub={customers.length ? `${customers.length} ${customers.length === 1 ? "person owns" : "people own"} ${prints} ${prints === 1 ? "print" : "prints"} of yours.` : undefined}
      actions={
        <Link href="/studio/emails" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">
          <Mail className="h-4 w-4" aria-hidden="true" />Buyer emails
        </Link>
      }
    >
      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          body="Buyers show up here with their orders and a spot for thank-you notes. Most first sales start with a QR code by the painting."
          action={{ label: "Print a QR code", href: "/studio/qr" }}
          secondary={{ label: "Set up buyer emails", href: "/studio/emails" }}
          help={{ label: "How customers work", href: "/help/growing/customers" }}
        />
      ) : (
        <CustomerList rows={rows} />
      )}
    </StudioPage>
  );
}
