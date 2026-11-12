"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import FollowButton from "@/components/follow/FollowButton";

/** Follow (email, double opt-in) and Share page (copies theartfinity.com/@slug). */
export default function ArtistActions({ slug, firstName, className }: { slug: string; firstName: string; className?: string }) {
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
      <FollowButton
        handle={slug}
        firstName={firstName}
        className="btn btn-sm h-11 px-5"
        doneClassName="btn-ghost"
        // Follow wears the artist's accent color (pageTheme), falling back to Garnet (--af-scan).
        idleStyle={{ background: "var(--accent, var(--af-scan))", borderColor: "var(--accent, var(--af-scan))", color: "var(--accent-ink, #fff)" }}
      />
      <button type="button" onClick={share} className="btn btn-ghost btn-sm h-11 px-5">
        Share page
      </button>
    </div>
  );
}
