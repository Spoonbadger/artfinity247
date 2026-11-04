// Verification evidence (Artist.verificationEvidence) and status copy. Pure: safe on server and client.

export type VerificationStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED";

export type Evidence = { instagram?: string; website?: string; photo?: string; note?: string };

/** Read stored JSON into Evidence, dropping anything unexpected. */
export function readEvidence(raw: unknown): Evidence {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 600) : undefined);
  return { instagram: str(o.instagram), website: str(o.website) ?? str(o.portfolio), photo: str(o.photo), note: str(o.note) };
}

function httpUrl(v: string) {
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Accepts @handle, instagram.com/handle or a full URL. */
export function normalizeInstagram(v: string) {
  const s = v.trim();
  if (!s) return "";
  const handle = s.match(/^@?([A-Za-z0-9._]{1,30})$/);
  if (handle) return `https://instagram.com/${handle[1]}`;
  const url = httpUrl(s);
  if (!url) return null;
  const host = new URL(url).hostname.replace(/^www\./, "");
  return host === "instagram.com" ? url : null;
}

/** Validates a submission. Returns { evidence } or { error }. */
export function parseEvidence(body: unknown): { evidence: Evidence; error?: undefined } | { error: string; evidence?: undefined } {
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const s = (k: string, max: number) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, max) : "");

  const igRaw = s("instagram", 200);
  const webRaw = s("website", 300);
  const photoRaw = s("photo", 500);
  const note = s("note", 500);

  const instagram = igRaw ? normalizeInstagram(igRaw) : "";
  if (instagram === null) return { error: "That Instagram link doesn't look right. Try @yourhandle." };
  const website = webRaw ? httpUrl(webRaw) : "";
  if (website === null) return { error: "That website link doesn't look right." };
  if (!instagram && !website) return { error: "Add your Instagram or website." };

  if (!photoRaw) return { error: "Add a photo of you with your work, or of your studio." };
  const photoOk = /^\/uploads\/[\w./-]+$/.test(photoRaw) || /^https:\/\/res\.cloudinary\.com\//.test(photoRaw);
  if (!photoOk) return { error: "Upload the photo here so we can see it." };

  const evidence: Evidence = { photo: photoRaw };
  if (instagram) evidence.instagram = instagram;
  if (website) evidence.website = website;
  if (note) evidence.note = note;
  return { evidence };
}

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const x = new Date(d);
  return isNaN(+x) ? "" : x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
