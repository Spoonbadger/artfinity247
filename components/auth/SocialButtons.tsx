"use client";

// "Continue with Google / Apple / Facebook / Instagram" buttons. Only providers whose env vars are set are passed
// in (lib/oauth/providers enabledProviders()), so nothing half-configured shows in production.
// Brand rules followed: Google's standard four-colour "G" on a white button with "Continue with Google";
// Apple's logo in black on a white, outlined button with "Continue with Apple" in the system font; Facebook's
// blue "f" circle; Instagram's glyph in black. Logos are never recoloured or stretched.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PROVIDER_LABEL, type ProviderId } from "@/lib/oauth/meta";

export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 814 1000" className={className} aria-hidden="true">
      <path
        fill="#000"
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
      />
    </svg>
  );
}

export function FacebookMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#0866FF"
        d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
      />
    </svg>
  );
}

export function InstagramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="#000" strokeWidth="2">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="17.7" cy="6.3" r="1.25" fill="#000" stroke="none" />
    </svg>
  );
}

function MockMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M21 12v2" />
    </svg>
  );
}

export const PROVIDER_MARK: Record<ProviderId, (p: { className?: string }) => ReactNode> = {
  google: GoogleMark,
  apple: AppleMark,
  facebook: FacebookMark,
  instagram: InstagramMark,
  mock: MockMark,
};

/** Builds the start URL. `mode: "link"` connects to the signed-in account (Studio). */
export function oauthStartHref(provider: ProviderId, opts: { next?: string | null; handle?: string; ref?: string; mode?: "link" } = {}) {
  const q = new URLSearchParams();
  if (opts.next) q.set("next", opts.next);
  if (opts.handle) q.set("handle", opts.handle);
  if (opts.ref) q.set("ref", opts.ref);
  if (opts.mode) q.set("mode", opts.mode);
  const s = q.toString();
  return `/api/auth/oauth/${provider}${s ? `?${s}` : ""}`;
}

export default function SocialButtons({
  providers,
  next,
  handle,
  referral,
  className,
}: {
  providers: ProviderId[];
  next?: string | null;
  handle?: string;
  referral?: string;
  className?: string;
}) {
  if (!providers.length) return null;
  return (
    // Side by side wherever two full-width labels fit (sign-up card, wide sign-in card), stacked otherwise.
    <div className={cn("grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,228px),1fr))]", className)}>
      {providers.map((p) => {
        const Mark = PROVIDER_MARK[p];
        return (
          // A plain link (full navigation): the provider page can't load inside client-side routing.
          <a
            key={p}
            href={oauthStartHref(p, { next, handle, ref: referral })}
            className={cn(
              "btn w-full min-w-0 min-h-[52px] whitespace-normal bg-white px-3 text-center text-ink hover:bg-wall hover:[filter:none]",
              p === "apple" && "font-semibold",
              p === "mock" && "border-dashed",
            )}
            // Apple asks for the system font on its button.
            style={p === "apple" ? { fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif" } : undefined}
          >
            <Mark className={cn("h-[20px] w-[20px] shrink-0", p === "apple" && "-mt-[3px] h-[20px] w-[17px]")} />
            <span>Continue with {PROVIDER_LABEL[p]}</span>
          </a>
        );
      })}
    </div>
  );
}

/** "or use email" rule between the social buttons and the form. */
export function OrDivider({ children = "or use email" }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[13.5px] font-semibold text-ink-2" role="separator" aria-label={typeof children === "string" ? children : undefined}>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
      <span aria-hidden="true">{children}</span>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  );
}
