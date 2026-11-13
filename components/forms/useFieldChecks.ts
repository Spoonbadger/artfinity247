"use client";
// Inline validation on blur: each field gets one specific message with a fix, shown when the person leaves the field
// (not while they type, and not only on submit). Typing in a field with an error re-checks it, so the message clears
// as soon as it's fixed.
import { useCallback, useState } from "react";
import type { Check } from "@/lib/smartFields";

export function useFieldChecks<K extends string>(rules: Record<K, Check>) {
  const [errors, setErrors] = useState<Partial<Record<K, string | null>>>({});

  const check = useCallback((k: K, value: string) => {
    const e = rules[k](value);
    setErrors((x) => (x[k] === e ? x : { ...x, [k]: e }));
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Wire into a field: blur checks it; typing re-checks only if it's showing an error. */
  const bind = (k: K) => ({
    onBlur: (e: { currentTarget: { value: string } }) => check(k, e.currentTarget.value),
    recheck: (value: string) => setErrors((x) => (x[k] ? { ...x, [k]: rules[k](value) } : x)),
  });

  /** Check everything (on submit). Returns true when all pass. */
  const checkAll = (values: Record<K, string>) => {
    const next: Partial<Record<K, string | null>> = {};
    let ok = true;
    for (const k of Object.keys(rules) as K[]) {
      const e = rules[k](values[k] ?? "");
      next[k] = e;
      if (e) ok = false;
    }
    setErrors(next);
    return ok;
  };

  return { errors, setErrors, check, bind, checkAll };
}
