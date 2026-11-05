import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin } from "lucide-react";
import { StudioPage } from "@/components/studio/StudioPage";
import Conversation, { type ThreadMessage, type ComposerOrder } from "@/components/crm/Conversation";
import OrderCard from "@/components/crm/OrderCard";
import { RepeatChip } from "@/components/crm/CustomerList";
import { usd, shortDate } from "@/components/crm/format";
import { displayName, firstName, requireArtist } from "../../_lib/data";
import { emailFromParam, getCustomer, getMessages } from "../_lib";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: { email: string } }) {
  const artist = await requireArtist("/studio/customers");
  const email = emailFromParam(params.email);
  if (!email) notFound();
  const [customer, messages] = await Promise.all([getCustomer(artist.id, email), getMessages(artist.id, email)]);
  if (!customer) notFound();

  const thread: ThreadMessage[] = messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    subject: m.subject,
    body: m.body,
    sentAt: m.sentAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    orderId: m.orderId,
  }));
  const orders: ComposerOrder[] = customer.orders.map((o) => ({
    id: o.id,
    label: `${o.items[0]?.title ?? "Order"}${o.items.length > 1 ? ` +${o.items.length - 1}` : ""}, ${shortDate(o.date)}`,
    title: o.items[0]?.title ?? "your print",
    stage: o.stage,
  }));

  return (
    <StudioPage
      title={customer.name}
      sub={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-2 hover:underline">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />{customer.email}
          </a>
          {customer.city && (
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{customer.city}</span>
          )}
          {customer.repeat && <RepeatChip />}
        </span>
      }
      actions={
        <Link href="/studio/customers" className="btn btn-ghost btn-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Customers
        </Link>
      }
    >
      <dl className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-white p-3 text-center sm:max-w-[520px] sm:gap-4 sm:p-4">
        {[
          { k: customer.orders.length === 1 ? "order" : "orders", v: customer.orders.length },
          { k: customer.prints === 1 ? "print" : "prints", v: customer.prints },
          { k: "spent with you", v: usd(customer.spentCents) },
        ].map((s) => (
          <div key={s.k} className="grid min-w-0 gap-0.5">
            <dt className="order-2 text-[12px] text-ink-2">{s.k}</dt>
            <dd className="display num order-1 text-[24px] [overflow-wrap:anywhere] sm:text-[28px]">{s.v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section aria-labelledby="orders-h" className="grid gap-3">
          <h2 id="orders-h" className="text-[20px] font-bold">
            Orders <span className="num text-[14px] font-semibold text-ink-2">since {shortDate(customer.first, true)}</span>
          </h2>
          {customer.orders.map((o) => (
            <OrderCard
              key={o.id}
              order={{
                id: o.id,
                date: o.date.toISOString(),
                stage: o.stage,
                spentCents: o.spentCents,
                items: o.items.map((i) => ({ id: i.id, title: i.title, imageUrl: i.imageUrl, size: i.size, framed: i.framed, quantity: i.quantity, priceCents: i.priceCents })),
                reprint: o.reprint,
              }}
            />
          ))}
        </section>

        <Conversation
          email={customer.email}
          buyerFirstName={customer.name.split(/\s+/)[0]}
          artistName={displayName(artist)}
          artistFirstName={firstName(artist)}
          orders={orders}
          initial={thread}
        />
      </div>
    </StudioPage>
  );
}
