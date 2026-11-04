import { ReactNode } from "react";
import type { Metadata } from "next";
import StudioShell from "@/components/studio/StudioShell";
import { requireArtist, displayName } from "./_lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio · Artfinity" },
  robots: { index: false, follow: false },
};

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const artist = await requireArtist();
  return (
    <StudioShell artist={{ name: displayName(artist), slug: artist.slug, profileImage: artist.profileImage }}>
      {children}
    </StudioShell>
  );
}
