"use client";

import { useEffect, useState } from "react";

function partOfDay(h: number) {
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** "Good afternoon", in the viewer's own time zone. Server guess first, then corrected on mount. */
export default function Greeting({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  useEffect(() => setText(partOfDay(new Date().getHours())), []);
  return <span suppressHydrationWarning>{text}</span>;
}

