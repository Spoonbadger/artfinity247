"use client";

import { ReactNode, useEffect, useState } from "react";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";

type Tab = { id: string; label: string; count?: number; panel: ReactNode };

/** Work / About tabs. Panels are rendered on the server; this only switches them. Syncs with #about, #reviews etc. */
export default function ArtistTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (!tabs.some((t) => t.id === h)) return;
      setActive(h);
      // Links like the rating under the name (#reviews) jump down to the tabs.
      if (h !== tabs[0]?.id) requestAnimationFrame(() => document.getElementById(`tab-${h}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const pick = (id: string) => {
    setActive(id);
    try { history.replaceState(null, "", id === tabs[0]?.id ? window.location.pathname + window.location.search : `${window.location.search}#${id}`); } catch {}
  };

  // Tabs pattern: one tab stop; arrow keys, Home and End move between tabs.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length];
    pick(t.id);
    document.getElementById(`tab-${t.id}`)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Artist page" onKeyDown={onKeyDown} className="mb-6 flex gap-4 border-b border-line sm:gap-7">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => pick(t.id)}
              className={cn(
                "relative -mb-px min-h-[44px] scroll-mt-24 pb-3 pt-2 text-[15px] font-bold transition-colors",
                on ? "text-ink" : "text-ink-2 hover:text-ink"
              )}
            >
              {t.label}
              {t.count != null && <span className="num ml-1.5 text-[13px] font-semibold text-ink-2">{t.count}</span>}
              {on && <BrushStroke className="absolute -bottom-[3px] -left-1 h-[9px] w-[calc(100%+8px)]" color="var(--accent, var(--af-ink))" />}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={t.id !== active}>
          {t.panel}
        </div>
      ))}
    </div>
  );
}
