import { ReactNode } from "react";
import ArtistAvatar from "@/components/artist/ArtistAvatar";

/** Shared frame for the confirm and unsubscribe pages. */
export default function FollowNote({ avatar, name, title, children, dab = "var(--af-scan)" }: { avatar?: string | null; name?: string; title: string; children: ReactNode; dab?: string }) {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 px-4 py-16 text-center md:py-24">
      <title>{`${title} · Artfinity`}</title>
      {name ? (
        <div className="relative">
          <ArtistAvatar src={avatar ?? null} name={name} className="h-24 w-24" />
          <span className="paint-dab absolute -bottom-1 -right-3 h-5 w-8" style={{ ["--dab" as string]: dab }} aria-hidden />
        </div>
      ) : (
        <span className="paint-dab h-6 w-10" style={{ ["--dab" as string]: dab }} aria-hidden />
      )}
      <h1 className="display text-[44px] leading-[1]">{title}</h1>
      {children}
    </div>
  );
}
