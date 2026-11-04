"use client";

import { useEffect, useState } from "react";

// Viewer setting for sensitive art. Off by default; remembered in this browser.
// (Signed-in accounts will store it server-side once the backend lands.)
const KEY = "af-show-sensitive";
const EVT = "af-sensitive-pref";

export function useSensitivePref(): [boolean, (v: boolean) => void] {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(localStorage.getItem(KEY) === "1"); } catch {}
    const on = (e: Event) => setShow((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const set = (v: boolean) => {
    setShow(v);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {}
    window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
  };
  return [show, set];
}
