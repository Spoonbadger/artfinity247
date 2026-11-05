// Instagram Graph API: content publishing for Artfinity's own professional account, and its access token. Server only.
//
// Publishing is two calls (https://developers.facebook.com/docs/instagram-platform/content-publishing):
//   POST /{ig-user-id}/media          media_type=REELS + video_url (or image_url) + caption  → a container id
//   GET  /{container-id}?fields=status_code   until FINISHED (Meta downloads and processes the video)
//   POST /{ig-user-id}/media_publish  creation_id=<container id>                           → the post's media id
// The video has to be at a public URL, so the admin's browser uploads it first (lib/social/storage.ts).
//
// Env (SOCIAL_SETUP.md): INSTAGRAM_BUSINESS_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN, optional META_GRAPH_VERSION,
// optional META_APP_ID + META_APP_SECRET (or the FACEBOOK_CLIENT_ID/SECRET of the same Meta app) so the token's expiry
// can be read and a 60-day user token refreshed by itself, optional INSTAGRAM_TOKEN_EXPIRES_AT (YYYY-MM-DD) otherwise.
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { raiseAlert, resolveAlert } from "@/lib/alerts";

const V = () => process.env.META_GRAPH_VERSION?.trim() || "v23.0";
const GRAPH = () => `https://graph.facebook.com/${V()}`;
const ACCOUNT = "instagram";
const env = (k: string) => process.env[k]?.trim() || "";
export const igAccountId = () => env("INSTAGRAM_BUSINESS_ACCOUNT_ID");
const envToken = () => env("INSTAGRAM_ACCESS_TOKEN");
const appCreds = () => {
  const id = env("META_APP_ID") || env("FACEBOOK_CLIENT_ID");
  const secret = env("META_APP_SECRET") || env("FACEBOOK_CLIENT_SECRET");
  return id && secret ? { id, secret } : null;
};
const fingerprint = (t: string) => crypto.createHash("sha256").update(t).digest("hex").slice(0, 16);

/** Both keys set: posting can be automatic. Otherwise /admin/social runs in manual mode. */
export const igConfigured = () => !!(igAccountId() && envToken());
export const igSetupState = () => ({ accountId: !!igAccountId(), token: !!envToken(), appCreds: !!appCreds(), version: V() });

export type IgErrorKind = "token" | "rate_limit" | "media" | "config" | "unknown";
export class IgError extends Error {
  constructor(message: string, readonly kind: IgErrorKind, readonly code?: number, readonly subcode?: number) { super(message); }
}

/** Graph error codes → what an admin should do about them. */
export function classify(code?: number, subcode?: number): IgErrorKind {
  if (code === 190 || code === 102 || code === 463 || code === 467) return "token";
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80002 || subcode === 2207042) return "rate_limit";
  if (code === 10 || (code !== undefined && code >= 200 && code < 300)) return "config"; // permission missing
  if (code === 100 && subcode === 33) return "config"; // wrong account id, or no access to it
  if (code === 9004 || code === 36000 || code === 36001 || code === 36003 || code === 36004 || code === 2207026 || (subcode !== undefined && subcode >= 2207001 && subcode <= 2207060)) return "media";
  return "unknown";
}

/** The token in use: one the cron refreshed (if it was refreshed from the current env token), else the env token. */
async function token(): Promise<string> {
  const t = envToken();
  if (!t) throw new IgError("INSTAGRAM_ACCESS_TOKEN isn't set.", "config");
  const row = await prisma.socialAccount.findUnique({ where: { id: ACCOUNT } }).catch(() => null);
  if (row?.accessToken && row.note === `from:${fingerprint(t)}`) return row.accessToken;
  return t;
}

async function graph<T>(method: "GET" | "POST", path: string, params: Record<string, string>, tok?: string): Promise<T> {
  const q = new URLSearchParams({ ...params, access_token: tok ?? (await token()) });
  const url = method === "GET" ? `${GRAPH()}${path}?${q}` : `${GRAPH()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, method === "GET" ? { cache: "no-store" } : { method: "POST", body: q, cache: "no-store" });
  } catch (e) {
    throw new IgError(`Couldn't reach Instagram: ${(e as Error).message}`, "unknown");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } } & T;
  if (!res.ok || body.error) {
    const e = body.error || {};
    throw new IgError((e.error_user_msg || e.message || `Instagram answered ${res.status}`).slice(0, 400), classify(e.code, e.error_subcode), e.code, e.error_subcode);
  }
  return body;
}

export async function createContainer(o: { videoUrl?: string; imageUrl?: string; caption: string }): Promise<string> {
  const params: Record<string, string> = { caption: o.caption };
  if (o.videoUrl) Object.assign(params, { media_type: "REELS", video_url: o.videoUrl, share_to_feed: "true" });
  else if (o.imageUrl) params.image_url = o.imageUrl;
  else throw new IgError("The post has no video or image yet.", "media");
  const r = await graph<{ id: string }>("POST", `/${igAccountId()}/media`, params);
  return r.id;
}

export type ContainerStatus = "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" | "PUBLISHED";
export async function containerStatus(id: string): Promise<{ code: ContainerStatus; detail: string }> {
  const r = await graph<{ status_code?: ContainerStatus; status?: string }>("GET", `/${id}`, { fields: "status_code,status" });
  return { code: r.status_code || "IN_PROGRESS", detail: r.status || "" };
}

export async function publishContainer(id: string): Promise<{ mediaId: string; permalink: string | null }> {
  const r = await graph<{ id: string }>("POST", `/${igAccountId()}/media_publish`, { creation_id: id });
  const p = await graph<{ permalink?: string }>("GET", `/${r.id}`, { fields: "permalink" }).catch(() => ({ permalink: undefined }));
  return { mediaId: r.id, permalink: p.permalink ?? null };
}

/** Posts in the last 24 hours vs. Instagram's limit for the account. */
export async function publishingQuota(): Promise<{ used: number; limit: number } | null> {
  try {
    const r = await graph<{ data?: { quota_usage?: number; config?: { quota_total?: number } }[] }>("GET", `/${igAccountId()}/content_publishing_limit`, { fields: "quota_usage,config" });
    const d = r.data?.[0];
    return d ? { used: d.quota_usage ?? 0, limit: d.config?.quota_total ?? 100 } : null;
  } catch {
    return null;
  }
}

/** Who the keys point at, for the settings card ("Connected to @theartfinity"). */
export async function igUsername(): Promise<string | null> {
  if (!igConfigured()) return null;
  try {
    const r = await graph<{ username?: string }>("GET", `/${igAccountId()}`, { fields: "username" });
    return r.username ? `@${r.username}` : null;
  } catch {
    return null;
  }
}

// ---------------- token health: refresh, or warn 7 days before it expires ----------------
export const TOKEN_ALERT_KEY = "social_token:instagram";
const DAY = 86_400_000;
export type TokenHealth = { status: "ok" | "expiring" | "expired" | "missing" | "unknown"; expiresAt: Date | null; refreshed: boolean; message: string };

async function alertToken(title: string, urgent: boolean) {
  await raiseAlert({ kind: "social_token", key: TOKEN_ALERT_KEY, title: title.slice(0, 200), link: "/admin/social/setup#token", severity: urgent ? "urgent" : "normal" });
}

/**
 * Checks the token at most once a day (unless `force`). With the app id and secret it reads the expiry with
 * debug_token and refreshes a 60-day user token when 10 or fewer days are left (a Page token from a long-lived user
 * token never expires). Without them it checks the token still works and warns 7 days before INSTAGRAM_TOKEN_EXPIRES_AT.
 */
export async function tokenHealth(now = new Date(), force = false): Promise<TokenHealth> {
  const t = envToken();
  if (!t || !igAccountId()) return { status: "missing", expiresAt: null, refreshed: false, message: "Not connected: manual mode." };
  const row = await prisma.socialAccount.findUnique({ where: { id: ACCOUNT } }).catch(() => null);
  if (!force && row?.checkedAt && now.getTime() - row.checkedAt.getTime() < 20 * 3_600_000) {
    const exp = row.expiresAt;
    const left = exp ? exp.getTime() - now.getTime() : null;
    return { status: left !== null && left <= 0 ? "expired" : left !== null && left < 7 * DAY ? "expiring" : "ok", expiresAt: exp, refreshed: false, message: "Checked in the last day." };
  }
  const fp = `from:${fingerprint(t)}`;
  const current = row?.accessToken && row.note === fp ? row.accessToken : t;
  const save = (data: { accessToken?: string | null; expiresAt?: Date | null; refreshedAt?: Date }) =>
    prisma.socialAccount.upsert({ where: { id: ACCOUNT }, create: { id: ACCOUNT, checkedAt: now, note: fp, ...data }, update: { checkedAt: now, note: fp, ...(row?.note !== fp ? { accessToken: null } : {}), ...data } }).catch(() => null);

  const app = appCreds();
  let expiresAt: Date | null = null;
  let never = false;
  let kind = "";
  if (app) {
    try {
      const d = await graph<{ data?: { is_valid?: boolean; expires_at?: number; data_access_expires_at?: number; type?: string } }>("GET", "/debug_token", { input_token: current }, `${app.id}|${app.secret}`);
      if (d.data?.is_valid === false) {
        await save({});
        await alertToken("Instagram token expired: auto-posting stopped. Make a new token.", true);
        return { status: "expired", expiresAt: null, refreshed: false, message: "The token is no longer valid." };
      }
      kind = d.data?.type || "";
      never = d.data?.expires_at === 0;
      expiresAt = d.data?.expires_at ? new Date(d.data.expires_at * 1000) : null;
    } catch (e) {
      if (e instanceof IgError && e.kind === "token") {
        await save({});
        await alertToken("Instagram token expired: auto-posting stopped. Make a new token.", true);
        return { status: "expired", expiresAt: null, refreshed: false, message: e.message };
      }
    }
  } else {
    try {
      await graph("GET", `/${igAccountId()}`, { fields: "username" }, current);
    } catch (e) {
      if (e instanceof IgError && e.kind === "token") {
        await save({});
        await alertToken("Instagram token expired: auto-posting stopped. Make a new token.", true);
        return { status: "expired", expiresAt: null, refreshed: false, message: e.message };
      }
      return { status: "unknown", expiresAt: row?.expiresAt ?? null, refreshed: false, message: e instanceof Error ? e.message : "Couldn't check the token." };
    }
    const hint = env("INSTAGRAM_TOKEN_EXPIRES_AT");
    expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(hint) ? new Date(`${hint}T12:00:00Z`) : row?.expiresAt ?? null;
  }

  // Refresh a user token with 10 or fewer days left (Page tokens from a long-lived user token don't expire).
  if (app && !never && expiresAt && expiresAt.getTime() - now.getTime() < 10 * DAY && kind !== "PAGE") {
    try {
      const r = await graph<{ access_token?: string; expires_in?: number }>("GET", "/oauth/access_token", { grant_type: "fb_exchange_token", client_id: app.id, client_secret: app.secret, fb_exchange_token: current }, current);
      if (r.access_token) {
        const next = new Date(now.getTime() + (r.expires_in ?? 60 * 86_400) * 1000);
        await save({ accessToken: r.access_token, expiresAt: next, refreshedAt: now });
        await resolveAlert(TOKEN_ALERT_KEY);
        return { status: "ok", expiresAt: next, refreshed: true, message: "Token refreshed for another 60 days." };
      }
    } catch (e) {
      console.error("[social] token refresh failed", e);
    }
  }
  await save({ expiresAt });
  const left = expiresAt ? expiresAt.getTime() - now.getTime() : null;
  if (left !== null && left < 7 * DAY) {
    const days = Math.max(0, Math.ceil(left / DAY));
    await alertToken(days ? `Instagram token expires in ${days} day${days === 1 ? "" : "s"}: make a new one` : "Instagram token expired: make a new one", days <= 2);
    return { status: days ? "expiring" : "expired", expiresAt, refreshed: false, message: `Expires in ${days} days.` };
  }
  await resolveAlert(TOKEN_ALERT_KEY);
  return { status: "ok", expiresAt, refreshed: false, message: never ? "This token doesn't expire." : expiresAt ? "Token is valid." : "Token works (expiry unknown)." };
}
