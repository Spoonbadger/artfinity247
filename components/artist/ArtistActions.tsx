"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const followKey = (slug: string) => `af-follow:${slug}`;

/** Follow (kept in this browser for now) and Share page (copies theartfinity.com/@slug). */
export default function ArtistActions({ slug, firstName, className }: { slug: string; firstName: string; className?: string }) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    try { setFollowing(localStorage.getItem(followKey(slug)) === "1"); } catch {}
  }, [slug]);

  const toggleFollow = () => {
    const next = !following;
    setFollowing(next);
    try { localStorage.setItem(followKey(slug), next ? "1" : "0"); } catch {}
    toast(next ? `Following ${firstName}. You'll hear about new work and shows.` : `Unfollowed ${firstName}`);
  };

  const share = async () => {
    const short = `theartfinity.com/@${slug}`;
    const url = `https://${short}`;
    const done = () => toast.success(`Link copied: ${short}`);
    try {
      await navigator.clipboard.writeText(url);
      done();
    } catch {
      // Clipboard can be blocked (http, iframes). Fall back to a hidden textarea.
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        done();
      } catch {
        toast(short);
      }
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button
        type="button"
        onClick={toggleFollow}
        aria-pressed={following}
        className={cn("btn btn-sm h-11 px-5", following && "btn-ghost")}
        // Follow wears the artist's accent color (pageTheme), falling back to Scan Blue.
        style={following ? undefined : { background: "var(--accent, var(--af-scan))", borderColor: "var(--accent, var(--af-scan))", color: "var(--accent-ink, #fff)" }}
      >
        {following ? "Following" : "Follow"}
      </button>
      <button type="button" onClick={share} className="btn btn-ghost btn-sm h-11 px-5">
        Share page
      </button>
    </div>
  );
}
