import ProfileEditor from "@/components/studio/ProfileEditor";
import AccountDetails from "@/components/studio/AccountDetails";
import ConnectedAccounts from "@/components/studio/ConnectedAccounts";
import { signInMethods } from "@/lib/oauth/account";
import { enabledProviders } from "@/lib/oauth/providers";
import { StudioPage } from "@/components/studio/StudioPage";
import { prisma } from "@/lib/prisma";
import { PAYOUT_DAY_OF_MONTH } from "@/lib/balance";
import { requireArtist, displayName } from "../_lib/data";

export const dynamic = "force-dynamic";
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
export const metadata = { title: "My page" };

export default async function MyPageEditor() {
  const artist = await requireArtist("/studio/page");
  const acct = await prisma.artist.findUnique({
    where: { id: artist.id },
    select: { first_name: true, last_name: true, email: true, phone: true, state: true },
  });
  const m = await signInMethods(artist.id);
  const methods = {
    hasPassword: m?.hasPassword ?? true,
    accounts: (m?.accounts ?? []).map((a) => ({ provider: a.provider, email: a.email, createdAt: a.createdAt.toISOString(), lastUsedAt: a.lastUsedAt?.toISOString() ?? null })),
  };
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
    >
      <ProfileEditor
        initial={{ name: displayName(artist), city: artist.city || "", bio: artist.bio || "", profileImage: artist.profileImage }}
        slug={artist.slug}
        art={art}
        payoutDay={ordinal(PAYOUT_DAY_OF_MONTH)}
        account={
          <>
            <AccountDetails
              initial={{
                first_name: acct?.first_name || "",
                last_name: acct?.last_name || "",
                email: acct?.email || artist.email,
                phone: acct?.phone || "",
                state: acct?.state || "",
              }}
            />
            <ConnectedAccounts available={enabledProviders()} initial={methods} />
          </>
        }
      />
    </StudioPage>
  );
}
