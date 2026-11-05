import { ProviderError } from "./types";

/** fetch with a timeout; non-2xx becomes a ProviderError (the body is logged, never shown). */
export async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new ProviderError("provider_unreachable", (e as Error)?.message);
  }
  const text = await res.text();
  if (!res.ok) {
    console.error(`[oauth] ${new URL(url).host} ${res.status}: ${text.slice(0, 300)}`);
    throw new ProviderError("provider_rejected", `HTTP ${res.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("provider_bad_response");
  }
}

export const postForm = (url: string, params: Record<string, string>) =>
  fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params).toString(),
  });

export const withQuery = (base: string, q: Record<string, string>) => `${base}?${new URLSearchParams(q).toString()}`;

export const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
