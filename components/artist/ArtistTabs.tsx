"use client";

import { ReactNode, useEffect, useState } from "react";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";

type Tab = { id: string; label: string; count?: number; panel: ReactNode };

/** Work / About tabs. Panels are rendered on the server; this only switches them. Syncs with #about. */
export default function ArtistTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const pick = (id: string) => {
    setActive(id);
    try { history.replaceState(null, "", id === tabs[0]?.id ? window.location.pathname : `#${id}`); } catch {}
  };

  return (
    <div>
      <div role="tablist" aria-label="Artist page" className="mb-6 flex gap-7 border-b border-line">
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
              onClick={() => pick(t.id)}
              className={cn(
                "relative -mb-px pb-3 pt-1 text-[15px] font-bold transition-colors",
                on ? "text-ink" : "text-ink-2 hover:text-ink"
              )}
            >
              {t.label}
              {t.count != null && <span className="num ml-1.5 text-[13px] font-semibold text-ink-2">{t.count}</span>}
              {on && <BrushStroke className="absolute -bottom-[3px] -left-1 h-[9px] w-[calc(100%+8px)]" color="var(--af-ink)" />}
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
