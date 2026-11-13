import type { Metadata } from "next";
import Link from "next/link";
import { artistPath } from "@/lib/urls";
import { artistDisplayName, artistFirstName, unsubscribe } from "@/lib/followers";
import RememberFollow from "@/components/follow/RememberFollow";
import FollowNote from "../FollowNote";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribed", robots: { index: false } };

// One click from the email unsubscribes; Resubscribe goes through the confirm link (same token).
export default async function UnsubscribePage({ searchParams }: { searchParams: { t?: string } }) {
  const t = searchParams.t || "";
  const f = t ? await unsubscribe(t) : null;
  if (!f) {
    return (
      <FollowNote title="We couldn't find that">
        <p className="text-[17px] text-ink-2">The link may be copied wrong. Reply to any email and we&apos;ll take you off the list.</p>
        <Link href="/" className="btn btn-ghost">Home</Link>
      </FollowNote>
    );
  }
  const name = artistDisplayName(f.artist);
  const first = artistFirstName(f.artist);
  const slug = f.artist.slug ?? "";
  return (
    <FollowNote avatar={f.artist.profileImage} name={name} title="You're unsubscribed" dab="#c9c4b8">
      {slug && <RememberFollow handle={slug} state="none" />}
      <p className="text-[17px] text-ink-2">
        No more emails from {name} to <b className="text-ink">{f.email}</b>.
      </p>
      {slug && <Link href={artistPath(slug)} className="btn btn-ghost">{first}&apos;s page</Link>}
      <p className="text-[14px] text-ink-2">
        Clicked by mistake?{" "}
        <Link href={`/follow/confirm?t=${encodeURIComponent(t)}&re=1`} prefetch={false} className="inline-flex min-h-[40px] items-center font-semibold text-ink underline underline-offset-4">Resubscribe</Link>
      </p>
    </FollowNote>
  );
}
