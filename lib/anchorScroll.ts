// Same-page link scrolling (components/site/SmoothAnchors.tsx): which clicks to take over, and how long to glide.
// Pure, so it's testable without a browser.

/** Ease in and out (cubic): a quick start and a soft landing. */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Swift but visible: about 350 ms for a short hop, never over 750 ms however far the section is. */
export function glideMs(distancePx: number) {
  return Math.round(Math.min(750, Math.max(350, 280 + Math.abs(distancePx) * 0.12)));
}

/**
 * The hash this link points to on the current page, or null when the click should be left to the browser:
 * another page or site, a new tab or download, a modified click, or no hash at all.
 */
export function samePageHash(
  link: { href: string; target?: string | null; hasDownload?: boolean },
  here: { href: string },
  click: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean },
): string | null {
  if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if ((link.target && link.target !== "_self") || link.hasDownload) return null;
  let to: URL, now: URL;
  try {
    to = new URL(link.href, here.href);
    now = new URL(here.href);
  } catch {
    return null;
  }
  if (!to.hash || to.origin !== now.origin || to.pathname !== now.pathname || to.search !== now.search) return null;
  return to.hash;
}
