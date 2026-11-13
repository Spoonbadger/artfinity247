"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOTION_EVENT, isMotionPaused, setMotionPaused } from "@/lib/a11y/motion";

/** Pauses (and resumes) the looping animations on the page. Remembered in this browser. */
export default function MotionToggle({ className }: { className?: string }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const sync = () => setPaused(isMotionPaused());
    sync();
    if (isMotionPaused()) document.documentElement.dataset.motion = "paused";
    window.addEventListener(MOTION_EVENT, sync);
    return () => window.removeEventListener(MOTION_EVENT, sync);
  }, []);
  return (
    <button
      type="button"
      onClick={() => setMotionPaused(!paused)}
      className={cn("inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-line bg-white/90 px-3 text-[13px] font-semibold text-ink-2 hover:border-ink hover:text-ink", className)}
    >
      {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
      {paused ? "Play animations" : "Pause animations"}
    </button>
  );
}
