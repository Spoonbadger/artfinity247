import { cn } from "@/lib/utils";
import SocialIcon from "./SocialIcon";
import { KIND_LABEL, isSocialKind } from "./model";

type SocialLink = { id: string; kind: string; url: string; label?: string | null };

/**
 * Row of social icons for the top right of the artist page header.
 * Each icon goes through the click counter (/api/links/[id]/click), which redirects to the link.
 * Pass the artist's links (any kinds); only social, website and email links are shown.
 * Get them with getArtistSocials(artist.id) from "@/components/links/data".
 */
export default function ArtistSocials({ links, className, max = 6 }: { links: SocialLink[]; className?: string; max?: number }) {
  const socials = links.filter((l) => isSocialKind(l.kind)).slice(0, max);
  if (!socials.length) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Elsewhere">
      {socials.map((l) => {
        const kind = isSocialKind(l.kind) ? l.kind : "website";
        const name = l.label || KIND_LABEL[kind];
        const external = kind !== "email";
        return (
          <li key={l.id}>
            <a
              href={`/api/links/${l.id}/click`}
              aria-label={name}
              title={name}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-line bg-white text-ink transition hover:-translate-y-0.5 hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scan"
            >
              <SocialIcon kind={kind} className="h-[19px] w-[19px]" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
