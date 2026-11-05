// Link previews (iMessage, Instagram DMs, WhatsApp, Slack…). A page's openGraph replaces the site default entirely,
// so every public page builds its preview here: the painting image when there is a safe one, else the Artfinity card.
// Sensitive art never goes in a preview: chat apps show it unblurred.
import type { Metadata } from "next";

export const DEFAULT_OG = { url: "/brand/og-image.png", width: 1200, height: 630, alt: "Artfinity. Every wall is a shop." };

type Img = { url: string | null | undefined; alt?: string; sensitive?: string[] | boolean | null } | null | undefined;

/** The first image that exists and isn't sensitive, or the Artfinity card. */
export function previewImage(...candidates: Img[]) {
  for (const c of candidates) {
    if (!c?.url) continue;
    const sensitive = Array.isArray(c.sensitive) ? c.sensitive.length > 0 : !!c.sensitive;
    if (!sensitive) return { url: c.url, alt: c.alt ?? "" };
  }
  return DEFAULT_OG;
}

/** openGraph + twitter for a public page, with the same title, description and image in both. */
export function sharePreview(o: { title: string; description: string; url: string; image: { url: string; alt?: string }; type?: "website" | "profile" | "article" }): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: { type: o.type ?? "website", siteName: "Artfinity", title: o.title, description: o.description, url: o.url, images: [o.image] },
    twitter: { card: "summary_large_image", title: o.title, description: o.description, images: [{ url: o.image.url, alt: o.image.alt }] },
  };
}
