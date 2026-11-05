import type { Metadata } from "next";
import { Swatch } from "@/components/af/Brush";
import { DabRow } from "@/components/browse/PageHead";
import { prisma } from "@/lib/prisma";
import ReportForm, { type ReportArt } from "./ReportForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Report art", description: "Tell us about copied, misrepresented or harmful art on Artfinity." };

const STEPS: [string, string, string][] = [
  ["var(--af-scan)", "We read it", "A person reviews every report within 2 business days."],
  ["var(--af-coral)", "We act", "If it’s infringing or breaks our rules, we take it down."],
  ["var(--af-sticker)", "We tell you", "You’ll get an email with what we decided."],
];

export default async function ReportPage({ searchParams }: { searchParams: { art?: string } }) {
  const slug = typeof searchParams.art === "string" ? searchParams.art.trim().slice(0, 200) : "";
  const row = slug
    ? await prisma.artwork
        .findFirst({
          where: { slug, status: "APPROVED" },
          select: { slug: true, title: true, imageUrl: true, sensitive: true, artist: { select: { artist_name: true, name: true } } },
        })
        .catch(() => null)
    : null;
  const art: ReportArt | null = row
    ? { slug: row.slug!, title: row.title, imageUrl: row.imageUrl, sensitive: row.sensitive ?? [], artist: row.artist.artist_name || row.artist.name }
    : null;

  return (
    <div className="pb-24">
      <section className="mx-auto max-w-[1240px] px-4 pb-8 pt-10 sm:px-6 md:pt-16">
        <div className="mb-4 flex items-center gap-2.5"><DabRow /><span className="eyebrow">Report art</span></div>
        <h1 className="display text-[48px] sm:text-[80px]">Something not right?</h1>
        <p className="mt-4 max-w-[48ch] text-[18px] text-ink-2">Artists should get paid for their own work. Tell us what you saw and we’ll look into it.</p>
      </section>
      <section className="mx-auto grid max-w-[1240px] items-start gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:gap-12">
        <ol className="order-last grid gap-5 lg:order-none">
          {STEPS.map(([color, title, sub]) => (
            <li key={title} className="grid grid-cols-[56px_1fr] gap-4 border-t-[3px] border-ink pt-4">
              <Swatch color={color} className="h-10" />
              <div className="grid min-w-0 gap-1">
                <h2 className="display text-[26px]">{title}</h2>
                <p className="text-[15.5px] text-ink-2">{sub}</p>
              </div>
            </li>
          ))}
          <p className="border-t border-line pt-4 text-[14.5px] text-ink-2">
            Reports go to our team, not the artist. If we take something down, the artist hears why and can reply.
          </p>
        </ol>
        <ReportForm art={art} />
      </section>
    </div>
  );
}
