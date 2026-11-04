import Link from "next/link";
import ProfileEditor from "@/components/studio/ProfileEditor";
import AccountDetails from "@/components/studio/AccountDetails";
import { StudioPage } from "@/components/studio/StudioPage";
import { prisma } from "@/lib/prisma";
import { requireArtist, displayName } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "My page" };

export default async function MyPageEditor() {
  const artist = await requireArtist("/studio/page");
  const acct = await prisma.artist.findUnique({
    where: { id: artist.id },
    select: { first_name: true, last_name: true, email: true, phone: true, state: true },
  });
  const art = await prisma.artwork.findMany({
    where: { artistId: artist.id, status: { not: "REJECTED" } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, title: true, imageUrl: true, sensitive: true },
  });
  return (
    <StudioPage
      title="My page"
      sub="What buyers see when they scan."
      actions={
        <>
          <Link href="/studio/design" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">Design</Link>
          <Link href="/studio/verify" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">Verification</Link>
          <Link href="/studio/infinity" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">Infinity</Link>
        </>
      }
    >
      <ProfileEditor
        initial={{ name: displayName(artist), city: artist.city || "", bio: artist.bio || "", profileImage: artist.profileImage, venmoHandle: artist.venmoHandle || "" }}
        slug={artist.slug}
        art={art}
        account={
          <AccountDetails
            initial={{
              first_name: acct?.first_name || "",
              last_name: acct?.last_name || "",
              email: acct?.email || artist.email,
              phone: acct?.phone || "",
              state: acct?.state || "",
            }}
          />
        }
      />
    </StudioPage>
  );
}
