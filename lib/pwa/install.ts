// "Install the Studio app": keeps hold of the browser's beforeinstallprompt event (it fires once,
// often before the Studio prompt has mounted) and remembers when the prompt was last shown.

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const EVENT = "af:installprompt";
let deferred: BeforeInstallPromptEvent | null = null;
let listening = false;

/** Call once on the client (PwaSetup does). Stores the event so the Studio can offer Install. */
export function listenForInstallPrompt() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own, quieter prompt in the Studio
    deferred = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(EVENT));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    remember(Number.MAX_SAFE_INTEGER); // installed: never ask again on this browser
    window.dispatchEvent(new Event(EVENT));
  });
}

export const installPromptEvent = () => deferred;
export const clearInstallPrompt = () => { deferred = null; };
export const onInstallPromptChange = (fn: () => void) => {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
};

const KEY = "af:install-prompt:last";
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function lastShown(): number {
  try {
    return Number(window.localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Record that the prompt was shown or dismissed (now, by default). */
export function remember(at = Date.now()) {
  try {
    window.localStorage.setItem(KEY, String(at));
  } catch {
    /* private mode or blocked storage: the prompt may show again, which is fine */
  }
}

/** At most once a week, and never once installed. */
export const mayShowPrompt = (now = Date.now()) => now - lastShown() >= WEEK_MS;

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone / iPad Safari, where installing is Share → Add to Home Screen. */
export function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV/.test(ua);
}
