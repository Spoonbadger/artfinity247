import type { Metadata } from "next";
import Link from "next/link";
import { artistPath } from "@/lib/urls";
import { artistDisplayName, artistFirstName, confirmFollow } from "@/lib/followers";
import RememberFollow from "@/components/follow/RememberFollow";
import FollowNote from "../FollowNote";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "You're following", robots: { index: false } };

export default async function ConfirmFollowPage({ searchParams }: { searchParams: { t?: string; re?: string } }) {
  const f = searchParams.t ? await confirmFollow(searchParams.t) : null;
  if (!f) {
    return (
      <FollowNote title="That link has dried up">
        <p className="text-[17px] text-ink-2">It may be old or copied wrong. Tap Follow on the artist&apos;s page to get a fresh one.</p>
        <Link href="/artists" className="btn btn-blue">Find artists</Link>
      </FollowNote>
    );
  }
  const name = artistDisplayName(f.artist);
  const first = artistFirstName(f.artist);
  const slug = f.artist.slug ?? "";
  return (
    <FollowNote avatar={f.artist.profileImage} name={name} title={searchParams.re ? "Welcome back" : "You're in"} dab="#ffd43b">
      {slug && <RememberFollow handle={slug} state="on" />}
      <p className="text-[17px] text-ink-2">
        When {first} posts new work, you&apos;ll be among the first to see it. Straight to <b className="text-ink">{f.email}</b>.
      </p>
      {slug && <Link href={artistPath(slug)} className="btn btn-blue">See {first}&apos;s work</Link>}
      <p className="text-[13px] text-ink-2">Every email has a one-tap unsubscribe.</p>
    </FollowNote>
  );
}
