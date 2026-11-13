"use client";
// "Google Drive" and "Dropbox" buttons next to the device pickers on /studio/art/new (ArtworkForm, UploadQueue).
// Picked files join the same one-by-one upload queue as files from the device.
// Google Drive: the Google Picker with the drive.file scope (access only to the files the artist picks), signed in
//   through Google Identity Services' token client. The Google scripts (api.js + gsi/client) load when the button is
//   hovered or pressed, never on page load. Picking a folder expands it to the images inside (and its subfolders).
//   File ids and the short-lived access token go to POST /api/uploads/import, which downloads the files server-side.
//   The token lives only in memory for this page (so a second pick or a retry doesn't ask again), never in storage.
// Dropbox: the Dropbox Chooser (dropins.js, loaded on hover/press) with temporary direct links (they expire after
//   about 4 hours, so the queue imports them straight away).
// Why the server downloads (not the browser): the bytes go cloud → server once instead of cloud → phone → server,
// which matters on a phone connection, and big originals don't hit the platform's request-body limit.
// Each button shows only when its NEXT_PUBLIC_* keys are set (setup: IMPORT_SETUP.md). With no keys nothing shows.
// Dev only: a "Sample files" button (ALLOW_MOCK_IMPORT=1, decided on the server) imports generated paintings from the
// dev server itself, so the whole flow can be tested without accounts (add ?mockImport=problems to the page URL to
// also get one file that fails in each way).
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_UPLOAD_BYTES, QUEUE_MAX } from "@/lib/uploadLimits";
import { IMPORT_EXTENSIONS, IMPORT_TYPES } from "@/lib/cloudImport/sources";
import { Problem } from "./Problem";

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
/** An imported image, plus what the import's duplicate check found (lib/imageHash.ts duplicateOfUpload). */
export type ImportedImage = UploadedImage & { duplicate: { slug: string; title: string } | null; duplicateOther: boolean };

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
const DRIVE_FOLDER = "application/vnd.google-apps.folder";
// Image types the upload pipeline reads (lib/cloudImport/sources.ts IMPORT_TYPES), plus folders so they can be picked.
const DRIVE_MIME_TYPES = [...IMPORT_TYPES, DRIVE_FOLDER].join(",");
const DROPBOX_EXTENSIONS = IMPORT_EXTENSIONS.map((e) => `.${e}`);

/** Picker closed without choosing: not an error. */
export class Cancelled extends Error {}

/** Something stopped the picker (popup blocked, sign-in cancelled, script blocked): shown with "Try again". */
export class PickProblem extends Error {}

// ---------- script loading (once per page, on first hover or press) ----------

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
    s.onerror = () => {
      scripts.delete(src);
      s.remove();
      reject(new PickProblem(`Couldn't load ${new URL(src).hostname}. Check your connection or ad blocker.`));
    };
    document.head.appendChild(s);
  });
  scripts.set(src, p);
  return p;
}

// The Google and Dropbox globals ship without types.
const w = () => window as any;

/** Load a source's scripts early (button hover / focus), so the popup opens straight from the click. */
function preload(s: CloudSource) {
  if (s === "drive") loadGoogle().catch(() => {});
  if (s === "dropbox") loadDropbox().catch(() => {});
}

// ---------- Google Drive ----------

let driveToken: { value: string; expires: number } | null = null;
let pickerLoaded: Promise<void> | null = null;

async function loadGoogle() {
  await Promise.all([loadScript("https://apis.google.com/js/api.js"), loadScript("https://accounts.google.com/gsi/client")]);
  pickerLoaded ||= new Promise<void>((resolve, reject) =>
    w().gapi.load("picker", { callback: () => resolve(), onerror: () => { pickerLoaded = null; reject(new PickProblem("Couldn't open Google Drive.")); } }),
  );
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
        if (resp?.error || !resp?.access_token) {
          reject(new PickProblem(resp?.error === "access_denied" ? "Google sign-in was cancelled, so we can't see your Drive." : "Google didn't give access to Drive."));
          return;
        }
        driveToken = { value: resp.access_token, expires: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
        resolve(resp.access_token);
      },
      error_callback: (err: any) => {
        if (err?.type === "popup_closed") reject(new PickProblem("Google sign-in was cancelled, so we can't see your Drive."));
        else if (err?.type === "popup_failed_to_open") reject(new PickProblem("Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again."));
        else reject(new PickProblem("Couldn't connect to Google Drive."));
      },
    });
    client.requestAccessToken(driveToken ? { prompt: "" } : {});
  });
}

const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;

/** The images in a picked folder (and up to two levels of subfolders), in name order, at most `max`. */
async function driveFolderImages(folder: { id: string; name: string }, token: string, max: number): Promise<CloudFile[]> {
  const out: CloudFile[] = [];
  const queue: { id: string; depth: number }[] = [{ id: folder.id, depth: 0 }];
  while (queue.length && out.length < max) {
    const { id, depth } = queue.shift()!;
    if (!DRIVE_ID.test(id)) continue;
    let pageToken = "";
    do {
      const qs = new URLSearchParams({
        q: `'${id}' in parents and trashed = false`,
        fields: "nextPageToken,files(id,name,mimeType,size)",
        pageSize: "200",
        orderBy: "folder,name_natural",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) qs.set("pageToken", pageToken);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${qs}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (!res) throw new PickProblem("Couldn't reach Google Drive. Check your connection.");
      if (res.status === 401) { driveToken = null; throw new PickProblem("Google Drive access ran out."); }
      if (!res.ok) throw new PickProblem(`Google Drive didn't let us look inside “${folder.name}”. Open the folder and select the images instead.`);
      const data = await res.json().catch(() => ({}));
      for (const f of (data.files || []) as { id: string; name: string; mimeType: string; size?: string }[]) {
        if (f.mimeType === DRIVE_FOLDER) { if (depth < 2) queue.push({ id: f.id, depth: depth + 1 }); continue; }
        if (!/^image\//.test(f.mimeType) || out.length >= max) continue;
        out.push({ source: "drive", id: f.id, name: f.name || "image", mimeType: f.mimeType, bytes: Number(f.size) || undefined, token });
      }
      pageToken = data.nextPageToken || "";
    } while (pageToken && out.length < max);
  }
  if (!out.length) throw new PickProblem(`We couldn't see any images in “${folder.name}”. Open the folder and select the images inside (Shift-click picks a range).`);
  return out;
}

async function pickFromDrive(max: number): Promise<CloudFile[]> {
  await loadGoogle();
  const token = await driveAccessToken();
  const picker = w().google.picker;
  const docs = await new Promise<any[]>((resolve, reject) => {
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setMimeTypes(DRIVE_MIME_TYPES).setIncludeFolders(true).setSelectFolderEnabled(max > 1).setMode(picker.DocsViewMode.GRID);
    const builder = new picker.PickerBuilder()
      .setAppId(GOOGLE_APP_ID)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setOAuthToken(token)
      .setOrigin(window.location.protocol + "//" + window.location.host)
      .setTitle(max > 1 ? "Pick paintings or a folder" : "Pick a painting")
      .addView(view)
      .setCallback((data: any) => {
        const action = data?.[picker.Response.ACTION];
        if (action === picker.Action.CANCEL) { reject(new Cancelled()); return; }
        if (action === picker.Action.PICKED) resolve(data[picker.Response.DOCUMENTS] || []);
      });
    if (max > 1) builder.enableFeature(picker.Feature.MULTISELECT_ENABLED).setMaxItems(max);
    builder.build().setVisible(true);
  });
  const out: CloudFile[] = [];
  for (const d of docs) {
    if (out.length >= max) break;
    if (d.mimeType === DRIVE_FOLDER) out.push(...(await driveFolderImages({ id: String(d.id), name: String(d.name || "that folder") }, token, max - out.length)));
    else out.push({ source: "drive", id: String(d.id), name: String(d.name || "image"), mimeType: d.mimeType, bytes: Number(d.sizeBytes) || undefined, token });
  }
  return out;
}

// ---------- Dropbox ----------

const loadDropbox = () => loadScript("https://www.dropbox.com/static/api/2/dropins.js", { id: "dropboxjs", "data-app-key": DROPBOX_APP_KEY });

async function pickFromDropbox(max: number): Promise<CloudFile[]> {
  await loadDropbox();
  return new Promise((resolve, reject) => {
    // The Chooser opens a popup window; notice when the browser blocks it instead of failing silently.
    const realOpen = window.open;
    let blocked = false;
    window.open = function (...args: Parameters<typeof window.open>) {
      const win = realOpen.apply(window, args);
      if (!win) blocked = true;
      return win;
    };
    try {
      w().Dropbox.choose({
        linkType: "direct",
        multiselect: max > 1,
        extensions: DROPBOX_EXTENSIONS,
        folderselect: false,
        sizeLimit: MAX_UPLOAD_BYTES,
        success: (files: any[]) => resolve(files.slice(0, max).map((f) => ({ source: "dropbox" as const, link: String(f.link), name: String(f.name || "image"), bytes: Number(f.bytes) || undefined }))),
        cancel: () => reject(new Cancelled()),
      });
    } finally {
      window.open = realOpen;
    }
    if (blocked) reject(new PickProblem("Your browser blocked the Dropbox window. Allow pop-ups for this site, then try again."));
  });
}

// ---------- dev mock ----------

async function pickMock(max: number): Promise<CloudFile[]> {
  const problems = new URLSearchParams(window.location.search).get("mockImport") === "problems";
  const res = await fetch(`/api/uploads/import?count=${Math.min(3, max)}${problems ? "&problems=1" : ""}`, { credentials: "include" }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  if (!res?.ok) throw new PickProblem(data.error || "The sample picker isn't on. Set ALLOW_MOCK_IMPORT=1.");
  return (data.files || []).slice(0, max).map((f: { link: string; name: string; bytes?: number }) => ({ source: "mock" as const, ...f }));
}

/** Opens a source's picker. Throws Cancelled (closed, nothing to say) or PickProblem (say it, offer "Try again"). */
export async function pickCloud(source: CloudSource, max = QUEUE_MAX): Promise<CloudFile[]> {
  const cap = Math.max(1, max);
  return source === "drive" ? pickFromDrive(cap) : source === "dropbox" ? pickFromDropbox(cap) : pickMock(cap);
}

// ---------- import ----------

export class ImportFailed extends Error {
  constructor(message: string, public retry: boolean, public code?: string) {
    super(message);
  }
}

/** Sends one picked file to POST /api/uploads/import. Resolves with the same result /api/uploads gives, plus duplicates. */
export async function importCloudFile(f: CloudFile, signal?: AbortSignal): Promise<ImportedImage> {
  const file = f.source === "drive" ? { id: f.id, name: f.name, mimeType: f.mimeType } : { link: f.link, name: f.name, bytes: f.bytes };
  let res: Response;
  try {
    res = await fetch("/api/uploads/import", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: f.source, files: [file], ...(f.source === "drive" ? { accessToken: f.token } : {}) }),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ImportFailed("You seem to be offline. Check your connection and try again.", true, "offline");
  }
  const data = await res.json().catch(() => ({}));
  const r = data.results?.[0];
  if (!res.ok || !r) throw new ImportFailed(data.error || "Import failed. Try again.", res.status >= 500 || res.status === 429, data.code);
  if (!r.ok) {
    // An expired Drive token can't be retried with the same token: drop it so the next pick asks Google again.
    if (r.code === "drive_access_expired") driveToken = null;
    throw new ImportFailed(r.error, !!r.retry, r.code);
  }
  return { url: r.url, width: r.width, height: r.height, printable: r.printable, printableSig: r.printableSig, duplicate: r.duplicate ?? null, duplicateOther: !!r.duplicateOther };
}

/**
 * The fix for a failed import, by the server's code. repick = open the same picker again for a fresh link / token or
 * another file; href = the page that explains. null = nothing beyond retry (when the failure is retryable) or remove.
 */
export function importFix(code: string | undefined, source: CloudSource): { label: string; href?: string; repick?: boolean } | null {
  switch (code) {
    case "link_expired":
    case "drive_access_expired":
    case "not_found":
    case "link_not_allowed":
      return { label: `Pick it again from ${source === "mock" ? "samples" : SOURCE_LABEL[source]}`, repick: true };
    case "not_image":
    case "heic_unreadable":
    case "unreadable_image":
    case "file_too_big":
    case "empty_file":
      return { label: "Pick another file", repick: true };
    case "not_logged_in":
      return { label: "Log in", href: "/login" };
    default:
      return null;
  }
}

/** Picked files that look like images (the pickers already filter; the server checks the real type and says why). */
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
  const [problem, setProblem] = useState<{ source: CloudSource; message: string } | null>(null);
  if (!cloudImportAvailable(mock)) return null;
  const sources: CloudSource[] = [...(driveEnabled ? ["drive" as const] : []), ...(dropboxEnabled ? ["dropbox" as const] : []), ...(mock ? ["mock" as const] : [])];

  async function open(s: CloudSource) {
    if (busy) return;
    setProblem(null);
    setBusy(s);
    try {
      const files = await pickCloud(s, max);
      if (files.length) onPick(files);
    } catch (e) {
      if (!(e instanceof Cancelled)) setProblem({ source: s, message: (e as Error)?.message || `Couldn't open ${SOURCE_LABEL[s]}.` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {sources.map((s) => (
          <button
            key={s} type="button" onClick={() => open(s)} onPointerEnter={() => preload(s)} onFocus={() => preload(s)} disabled={disabled || !!busy}
            className={size === "link" ? "inline-flex min-h-[32px] items-center gap-1.5 font-semibold text-scan hover:underline disabled:opacity-50" : "btn btn-ghost btn-sm"}
            aria-label={s === "mock" ? undefined : `Import from ${SOURCE_LABEL[s]}`}
          >
            {busy === s ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SourceIcon source={s} />}
            {s === "mock" ? "Sample files (dev)" : SOURCE_LABEL[s]}
          </button>
        ))}
      </div>
      {problem && <Problem tone="error" title={problem.message} fix={{ label: "Try again", onClick: () => open(problem.source) }} className="text-left" />}
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
