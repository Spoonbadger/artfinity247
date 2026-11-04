"use client";

import { useTween } from "./useTween";

/** Renders a number that eases to each new value. `format` turns it into text. */
export default function Tween({ value, format, ms }: { value: number; format: (n: number) => string; ms?: number }) {
  const v = useTween(value, ms);
  return <>{format(v)}</>;
}
