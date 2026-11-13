import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import ReportForm, { type ReportArt } from "./ReportForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Report art", description: "Tell us about copied, misrepresented or harmful art on Artfinity." };

const STEPS: [string, string, string][] = [
  ["var(--af-scan)", "We read it", "A person reviews every report within 2 business days."],
  ["var(--af-coral)", "We act", "If it’s infringing or breaks our rules, we take it down."],
  ["var(--af-sticker)", "We tell you", "You’ll get an email with what we decided."],
];

const COUNTER_STEPS: [string, string, string][] = [
  ["var(--af-scan)", "We pass it on", "The person who filed the notice gets a copy of your counter-notice."],
  ["var(--af-sticker)", "We wait 10 business days", "That gives them time to go to court. Most don’t."],
  ["var(--af-earned)", "Your work goes back up", "Unless they tell us they’ve filed a lawsuit, we restore it within 14 business days."],
];

export default async function ReportPage({ searchParams }: { searchParams: { art?: string; type?: string } }) {
  const counter = searchParams.type === "counter";
  const slug = typeof searchParams.art === "string" ? searchParams.art.trim().slice(0, 200) : "";
  const user = counter ? await getUserFromCookie() : null;

  const row = slug
    ? await prisma.artwork
        .findFirst({
          // Counter-notices are about work that was taken down, so any status.
          where: counter ? { slug } : { slug, status: "APPROVED" },
          select: { slug: true, title: true, imageUrl: true, sensitive: true, artistId: true, artist: { select: { artist_name: true, name: true } } },
        })
        .catch(() => null)
    : null;
  // Only the artist (or an admin) may file a counter-notice for their own work.
  const canCounter = !!row && !!user && (user.id === row.artistId || user.role === "ADMIN");
  const art: ReportArt | null = row && (!counter || canCounter)
    ? { slug: row.slug!, title: row.title, imageUrl: row.imageUrl, sensitive: row.sensitive ?? [], artist: row.artist.artist_name || row.artist.name }
    : null;

  const steps = counter ? COUNTER_STEPS : STEPS;
  const next = `/report?type=counter${slug ? `&art=${encodeURIComponent(slug)}` : ""}`;

  return (
    <div className="pb-24">
      <section className="mx-auto max-w-[1240px] px-4 pb-8 pt-10 sm:px-6 md:pt-16">
        <h1 className="display text-[44px] sm:text-[64px]">{counter ? "Taken down by mistake?" : "Something not right?"}</h1>
        <p className="mt-3 max-w-[48ch] text-[17px] text-ink-2">
          {counter
            ? "If your work was removed after a copyright notice and it’s yours, you can file a counter-notice."
            : "Tell us what you saw. A person reviews every report."}
        </p>
      </section>
      <section className="mx-auto grid max-w-[1240px] items-start gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:gap-12">
        <ol className="order-last grid gap-5 lg:order-none">
          {steps.map(([, title, sub]) => (
            <li key={title} className="border-t border-line pt-4">
              <div className="grid min-w-0 gap-1">
                <h2 className="t-card">{title}</h2>
                <p className="t-muted">{sub}</p>
              </div>
            </li>
          ))}
          <p className="t-small border-t border-line pt-4">
            {counter ? "Only file this if you truly believe the takedown was wrong. False statements can carry legal penalties." : "Reports go to our team, not the artist. If we take something down, the artist hears why and can reply."}{" "}
            <Link href="/dmca" className="font-semibold text-ink underline-offset-2 hover:underline">How DMCA works here</Link>
          </p>
        </ol>
        {counter && !art ? (
          <div className="af-card grid justify-items-start gap-3 p-5 sm:p-7">
            <h2 className="t-card">{user ? "We couldn’t find that work" : "Log in first"}</h2>
            <p className="t-muted">
              {user
                ? "Open the link from your takedown email, or write to us from the contact page."
                : "Counter-notices come from the artist’s account. Log in and we’ll bring you back here."}
            </p>
            {user ? (
              <Link href="/contact" className="btn btn-ghost">Contact us</Link>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-blue">Log in</Link>
            )}
          </div>
        ) : (
          <ReportForm art={art} mode={counter ? "counter" : "report"} />
        )}
      </section>
    </div>
  );
}
