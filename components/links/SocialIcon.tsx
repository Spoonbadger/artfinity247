import { cn } from "@/lib/utils";
import type { LinkKind } from "./model";

// Simple line icons for socials, drawn to match lucide's 24px / 2px stroke grid.
const PATHS: Record<LinkKind, JSX.Element> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  tiktok: <path d="M14 3v11.5a3.6 3.6 0 1 1-3.6-3.6M14 3c.4 2.9 2.3 4.7 5.2 4.9" />,
  youtube: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="4.5" />
      <path d="M10 9.2l5 2.8-5 2.8z" fill="currentColor" />
    </>
  ),
  facebook: <path d="M10.5 21V8.5A4.5 4.5 0 0 1 15 4h2M7 12h9" />,
  x: (
    <>
      <path d="M4.5 4h4L19.5 20h-4z" />
      <path d="M19 4l-6 6.9M5 20l6-6.9" />
    </>
  ),
  pinterest: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M11 13.4L9.3 20.6M9.6 14.6C8 12.9 8.6 8.2 12.6 8c3-.2 4.4 1.9 3.8 4.3-.5 2-2.2 3.3-4.1 2.5" />
    </>
  ),
  threads: (
    <path d="M16.3 11.4c-.3-2.6-1.9-3.9-4.1-3.9-2.3 0-3.7 1.5-3.7 3.5 0 1.8 1.4 3.1 3.3 3.1 2.4 0 3.8-1.7 3.8-4.7M16 12.1c2.3.8 3.1 2.6 2.6 4.4-.7 2.6-3.3 4.5-6.6 4.5C7.2 21 4 17.6 4 12s3.2-9 7.9-9c3.3 0 5.8 1.5 6.9 4.3" />
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3zM3.6 9h16.8M3.6 15h16.8" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  custom: <path d="M10 13.5a4.6 4.6 0 0 0 6.9.5l2.8-2.8a4.6 4.6 0 0 0-6.5-6.5l-1.6 1.6M14 10.5a4.6 4.6 0 0 0-6.9-.5l-2.8 2.8a4.6 4.6 0 0 0 6.5 6.5l1.6-1.6" />,
};

export default function SocialIcon({ kind, className }: { kind: LinkKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5 shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[kind] ?? PATHS.custom}
    </svg>
  );
}
