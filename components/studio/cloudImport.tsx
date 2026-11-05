"use client";
// "Google Drive" and "Dropbox" buttons next to the device pickers on /studio/art/new (ArtworkForm, UploadQueue).
// Google Drive: the Google Picker with the drive.file scope (access only to the files the artist picks). The Google
//   scripts (api.js + Identity Services) load when the button is pressed, never on page load. The picker hands back
//   file ids and a short-lived access token; both go to POST /api/uploads/import, which downloads the files. The token
//   lives only in memory for this page (so a second pick or a retry doesn't ask again) and is never saved anywhere.
// Dropbox: the Dropbox Chooser (dropins.js, loaded on press) with temporary direct links (they expire after ~4 hours).
// Each button shows only when its NEXT_PUBLIC_* keys are set (setup: AUTH_SETUP.md, "Google Drive" and "Dropbox").
// Dev only: a "Sample files" button (ALLOW_MOCK_IMPORT=1, decided on the server) imports from the dev server itself.
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_UPLOAD_BYTES, QUEUE_MAX } from "@/lib/uploadLimits";

export type CloudSource = "drive" | "dropbox" | "mock";

/** A picked file waiting to be imported. Kept in memory only: `token` must never reach sessionStorage. */
export type CloudFile = {
  source: CloudSource;
  name: string;
  bytes?: number;
  mimeType?: string;
  /** Drive file id. */
  id?: string;
  /** Dropbox / mock direct link. */
  link?: string;
  /** Drive access token from the picker. */
  token?: string;
};

/** What POST /api/uploads and POST /api/uploads/import return for an image. */
export type UploadedImage = { url: string; width: number; height: number; printable: string[]; printableSig: string };

export const SOURCE_LABEL: Record<CloudSource, string> = { drive: "Google Drive", dropbox: "Dropbox", mock: "sample files" };
const SOURCE_SHORT: Record<CloudSource, string> = { drive: "Drive", dropbox: "Dropbox", mock: "samples" };
export const importingLabel = (s: CloudSource) => `Importing from ${SOURCE_SHORT[s]}…`;

// Referenced literally so Next inlines them into the client bundle.
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const GOOGLE_APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID || "";
const DROPBOX_APP_KEY = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY || "";

export const driveEnabled = !!(GOOGLE_API_KEY && GOOGLE_CLIENT_ID && GOOGLE_APP_ID);
export const dropboxEnabled = !!DROPBOX_APP_KEY;
/** Any import button to show? */
export const cloudImportAvailable = (mock?: boolean) => driveEnabled || dropboxEnabled || !!mock;

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
// Image types the upload pipeline reads (lib/storage.ts uses sharp; HEIC goes through Cloudinary when it's on).
const DRIVE_MIME_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/tiff,image/avif,image/gif";

/** Picker cancelled or nothing chosen: not an error. */
class Cancelled extends Error {}

// ---------- script loading (once per page, on first press) ----------

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string, attrs: Record<string, string> = {}): Promise<void> {
  const known = scripts.get(src);
  if (known) return known;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    s.onload = () => resolve();
    s.onerror = () => { scripts.delete(src); s.remove(); reject(new Error(`Couldn't load ${new URL(src).hostname}. Check your connection or ad blocker and try again.`)); };
    document.head.appendChild(s);
  });
  scripts.set(src, p);
  return p;
}

// The Google and Dropbox globals ship without types.
const w = () => window as any;

// ---------- Google Drive ----------

let driveToken: { value: string; expires: number } | null = null;
let pickerLoaded: Promise<void> | null = null;

async function loadGoogle() {
  await Promise.all([loadScript("https://apis.google.com/js/api.js"), loadScript("https://accounts.google.com/gsi/client")]);
  pickerLoaded ||= new Promise<void>((resolve, reject) => w().gapi.load("picker", { callback: () => resolve(), onerror: () => { pickerLoaded = null; reject(new Error("Couldn't open Google Drive. Try again.")); } }));
  await pickerLoaded;
}

function driveAccessToken(): Promise<string> {
  if (driveToken && driveToken.expires > Date.now() + 60_000) return Promise.resolve(driveToken.value);
  return new Promise((resolve, reject) => {
    // A fresh token client per request, so its callbacks belong to this promise.
    const client = w().google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (resp: any) => {
        if (resp?.error || !resp?.access_token) { reject(resp?.error === "access_denied" ? new Cancelled() : new Error("Google didn't give access to Drive. Try again.")); return; }
        driveToken = { value: resp.access_token, expires: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
        resolve(resp.access_token);
      },
      error_callback: (err: any) => {
        if (err?.type === "popup_closed") reject(new Cancelled());
        else if (err?.type === "popup_failed_to_open") reject(new Error("Your browser blocked the Google window. Press Google Drive again."));
        else reject(new Error("Couldn't connect to Google Drive. Try again."));
      },
    });
    client.requestAccessToken(driveToken ? { prompt: "" } : {});
  });
}

async function pickFromDrive(max: number): Promise<CloudFile[]> {
  await loadGoogle();
  const token = await driveAccessToken();
  const picker = w().google.picker;
  return new Promise((resolve, reject) => {
    // Folders show so the artist can open them; picking stays on images (drive.file grants access per picked file).
    const view = new picker.DocsView(picker.ViewId.DOCS).setMimeTypes(DRIVE_MIME_TYPES).setIncludeFolders(true).setSelectFolderEnabled(false).setMode(picker.DocsViewMode.GRID);
    const builder = new picker.PickerBuilder()
      .setAppId(GOOGLE_APP_ID)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setOAuthToken(token)
      .setOrigin(window.location.protocol + "//" + window.location.host)
      .setTitle(max > 1 ? "Pick your paintings" : "Pick a painting")
      .addView(view)
      .setCallback((data: any) => {
        const action = data?.[picker.Response.ACTION];
        if (action === picker.Action.CANCEL) { reject(new Cancelled()); return; }
        if (action !== picker.Action.PICKED) return;
        const docs: any[] = data[picker.Response.DOCUMENTS] || [];
        resolve(docs.map((d) => ({ source: "drive" as const, id: String(d.id), name: String(d.name || "image"), mimeType: d.mimeType, bytes: Number(d.sizeBytes) || undefined, token })));
      });
    if (max > 1) builder.enableFeature(picker.Feature.MULTISELECT_ENABLED).setMaxItems(max);
    builder.build().setVisible(true);
  });
}

// ---------- Dropbox ----------

async function pickFromDropbox(max: number): Promise<CloudFile[]> {
  await loadScript("https://www.dropbox.com/static/api/2/dropins.js", { id: "dropboxjs", "data-app-key": DROPBOX_APP_KEY });
  return new Promise((resolve, reject) => {
    w().Dropbox.choose({
      linkType: "direct",
      multiselect: max > 1,
      extensions: ["images"],
      folderselect: false,
      sizeLimit: MAX_UPLOAD_BYTES,
      success: (files: any[]) => resolve(files.map((f) => ({ source: "dropbox" as const, link: String(f.link), name: String(f.name || "image"), bytes: Number(f.bytes) || undefined }))),
      cancel: () => reject(new Cancelled()),
    });
  });
}

// ---------- dev mock ----------

async function pickMock(max: number): Promise<CloudFile[]> {
  const res = await fetch(`/api/uploads/import?count=${Math.min(3, max)}`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The sample picker isn't on. Set ALLOW_MOCK_IMPORT=1.");
  return (data.files || []).map((f: { link: string; name: string; bytes?: number }) => ({ source: "mock" as const, ...f }));
}

// ---------- import ----------

/** Sends one picked file to POST /api/uploads/import. Resolves with the same result /api/uploads gives. */
export async function importCloudFile(f: CloudFile, signal?: AbortSignal): Promise<UploadedImage> {
  const file = f.source === "drive" ? { id: f.id, name: f.name, mimeType: f.mimeType } : { link: f.link, name: f.name, bytes: f.bytes };
  const res = await fetch("/api/uploads/import", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: f.source, files: [file], ...(f.source === "drive" ? { accessToken: f.token } : {}) }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && f.source !== "drive") throw new ImportFailed("You're logged out. Log in and import it again.", false);
  const r = data.results?.[0];
  if (!res.ok || !r) throw new ImportFailed(data.error || "Import failed. Try again.", res.status >= 500 || res.status === 429);
  if (!r.ok) {
    // An expired Drive token can't be retried with the same token: drop it so the next press asks Google again.
    if (f.source === "drive" && /access ran out/i.test(r.error)) driveToken = null;
    throw new ImportFailed(r.error, !!r.retry);
  }
  return { url: r.url, width: r.width, height: r.height, printable: r.printable, printableSig: r.printableSig };
}

export class ImportFailed extends Error {
  constructor(message: string, public retry: boolean) {
    super(message);
  }
}

/** Picked files that look like images (the pickers already filter, this is a second check). */
export const isCloudImage = (f: CloudFile) =>
  f.mimeType ? /^image\//.test(f.mimeType) : /\.(jpe?g|png|webp|heic|heif|tiff?|avif|gif)$/i.test(f.name);

// ---------- buttons ----------

/**
 * The import buttons. Renders nothing when no source is set up. `max` caps how many files the picker allows
 * (1 for a first upload, what's left of the queue otherwise).
 */
export function CloudImportButtons({ onPick, mock, max = QUEUE_MAX, disabled, size = "sm", className }: {
  onPick: (files: CloudFile[]) => void;
  mock?: boolean;
  max?: number;
  disabled?: boolean;
  size?: "sm" | "link";
  className?: string;
}) {
  const [busy, setBusy] = useState<CloudSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!cloudImportAvailable(mock)) return null;
  const sources: CloudSource[] = [...(driveEnabled ? ["drive" as const] : []), ...(dropboxEnabled ? ["dropbox" as const] : []), ...(mock ? ["mock" as const] : [])];

  async function open(s: CloudSource) {
    if (busy) return;
    setError(null);
    setBusy(s);
    try {
      const cap = Math.max(1, max);
      const files = await (s === "drive" ? pickFromDrive(cap) : s === "dropbox" ? pickFromDropbox(cap) : pickMock(cap));
      if (files.length) onPick(files);
    } catch (e) {
      if (!(e instanceof Cancelled)) setError((e as Error)?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {sources.map((s) => (
          <button
            key={s} type="button" onClick={() => open(s)} disabled={disabled || !!busy}
            className={size === "link" ? "inline-flex min-h-[32px] items-center gap-1.5 font-semibold text-scan hover:underline disabled:opacity-50" : "btn btn-ghost btn-sm"}
            aria-label={s === "mock" ? undefined : `Import from ${SOURCE_LABEL[s]}`}
          >
            {busy === s ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SourceIcon source={s} />}
            {s === "mock" ? "Sample files (dev)" : SOURCE_LABEL[s]}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-[13px] font-semibold text-coral">{error}</p>}
    </div>
  );
}

function SourceIcon({ source }: { source: CloudSource }) {
  if (source === "drive") {
    return (
      <svg viewBox="0 0 87.3 78" className="h-4 w-4" aria-hidden="true">
        <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
        <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5A9.06 9.06 0 000 53h27.5z" fill="#00ac47" />
        <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335" />
        <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
        <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
        <path d="M73.4 26.5L60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
      </svg>
    );
  }
  if (source === "dropbox") {
    return (
      <svg viewBox="0 0 43 40" className="h-4 w-4" aria-hidden="true">
        <path fill="#0061ff" d="M12.5 0L0 8.1l8.6 6.9 12.6-7.8L12.5 0zM0 21.9l12.5 8.2 8.7-7.3-12.6-7.8L0 21.9zm21.2.9l8.7 7.3 12.5-8.2-8.6-6.9-12.6 7.8zM42.4 8.1L29.9 0l-8.7 7.2 12.6 7.8 8.6-6.9zM21.3 24.4l-8.8 7.3-3.7-2.5v2.8l12.5 7.5 12.5-7.5v-2.8l-3.8 2.5-8.7-7.3z" />
      </svg>
    );
  }
  return <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-sm bg-sticker text-[10px] font-black">S</span>;
}
