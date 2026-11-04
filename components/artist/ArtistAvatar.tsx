import Image from "next/image";
import { cn } from "@/lib/utils";

const DABS = ["#f7c8a8", "#b8c4ff", "#ffd43b", "#a8dcc4", "#f5b3c8"];

export default function ArtistAvatar({ src, name, className }: { src: string | null; name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  const dab = DABS[(name.charCodeAt(0) || 0) % DABS.length];
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full border-4 border-white bg-gallery shadow-[0_8px_24px_-10px_rgba(21,22,27,.4)]", className)}>
      {src ? (
        <Image src={src} alt={name} fill sizes="144px" className="object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center font-display text-3xl sm:text-5xl font-extrabold text-ink" style={{ background: dab }} aria-label={name} role="img">
          {initials}
        </div>
      )}
    </div>
  );
}
