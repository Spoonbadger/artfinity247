// Image-check providers for the automatic upload screen (lib/moderation). Picked by IMAGE_MODERATION_PROVIDER:
//   sightengine  SIGHTENGINE_USER + SIGHTENGINE_SECRET (optional SIGHTENGINE_MODELS)
//   google       GOOGLE_VISION_API_KEY (Cloud Vision SafeSearch + labels)
//   aws          AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (+ AWS_REGION) for Rekognition DetectModerationLabels
//   local        NSFWJS on our own server ($0): nudity and explicit content only (./local.ts, dynamic import)
//   mock         dev only, never in production: scores from hints in the title/filename (nsfw, gore, nude...)
//   none         the default: no check
// A second check for new artists and verification photos: IMAGE_MODERATION_EXTRA=sightengine (or mock in dev). See
// extraProvider below and MODERATION_SETUP.md ("Tiered checks").
// Every remote provider is a plain fetch (no SDKs) and returns the same ModerationResult. The normalizers are exported so
// lib/moderation/moderation.test.mjs can check them against sample responses shaped like each provider's docs.
//
// Pure server code with no "@/" imports and only type imports, so scripts/moderate-backfill.mjs and the unit check
// can load it straight from Node (type stripping). The local model is loaded only when the local provider runs.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Coverage, Env, ModerationResult, ProviderId, ProviderInput, Purpose } from "./types";

export const PROVIDERS: ProviderId[] = ["sightengine", "google", "aws", "local", "mock", "none"];
/** Sightengine's free plan: operations a month (each model on each image is one operation). */
export const SIGHTENGINE_FREE_OPS = 2000;
export const DEFAULT_TIMEOUT_MS = 6000;

const isProd = (env: Env) => env.NODE_ENV === "production" || env.VERCEL_ENV === "production";

/** What IMAGE_MODERATION_PROVIDER asks for (unknown values count as "none"). */
export function configuredProvider(env: Env = process.env): ProviderId {
  const v = (env.IMAGE_MODERATION_PROVIDER || "").trim().toLowerCase() as ProviderId;
  return PROVIDERS.includes(v) ? v : "none";
}

/** The mock reads filenames, so anyone could pass anything: it never runs on a production build. */
export function mockAllowed(env: Env = process.env): boolean {
  return !isProd(env);
}

/** The provider that actually runs: the configured one, except mock in production (then nothing runs). */
export function activeProvider(env: Env = process.env): ProviderId {
  const p = configuredProvider(env);
  return p === "mock" && !mockAllowed(env) ? "none" : p;
}

/** Missing settings for a provider, in plain words, or null when it can run. */
export function providerProblem(p: ProviderId, env: Env = process.env): string | null {
  const has = (k: string) => !!env[k]?.trim();
  if (p === "sightengine" && !(has("SIGHTENGINE_USER") && has("SIGHTENGINE_SECRET"))) return "SIGHTENGINE_USER and SIGHTENGINE_SECRET are not set";
  if (p === "google" && !has("GOOGLE_VISION_API_KEY")) return "GOOGLE_VISION_API_KEY is not set";
  if (p === "aws" && !(has("AWS_ACCESS_KEY_ID") && has("AWS_SECRET_ACCESS_KEY"))) return "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not set";
  if (p === "mock" && !mockAllowed(env)) return "the mock provider never runs in production";
  if (p === "local" && !localModelFiles()) return "the local model files are missing (node scripts/extract-nsfw-model.mjs)";
  return null;
}

const LOCAL_DIR = () => path.join(process.cwd(), "data", "models", "nsfwjs", "mobilenet_v2");
const localModelFiles = () => fs.existsSync(path.join(LOCAL_DIR(), "model.json")) && fs.existsSync(path.join(LOCAL_DIR(), "group1-shard1of1.bin"));

/**
 * The second check for new artists' uploads and for verification photos (IMAGE_MODERATION_EXTRA). Only Sightengine
 * (or the mock, in dev), only with its keys set, and never the same as the main provider. "none" otherwise.
 */
export function extraProvider(env: Env = process.env): ProviderId {
  const v = (env.IMAGE_MODERATION_EXTRA || "").trim().toLowerCase();
  if (v !== "sightengine" && v !== "mock") return "none";
  if (v === activeProvider(env)) return "none";
  return providerProblem(v, env) ? "none" : v;
}

const models = (list: string) => list.split(",").map((m) => m.trim()).filter(Boolean);

/**
 * What a call can tell, for the auto-approval checks (lib/trust):
 *   nudity  every provider          gore   Sightengine (gore model), Google, AWS     hate   Sightengine (offensive), AWS
 *   ai      Sightengine "genai"     faces  Sightengine "faces" (verification only)   web    no provider yet (mock only)
 * The local provider covers nudity and explicit content only.
 */
export function providerCoverage(p: ProviderId, purpose: Purpose = "artwork", env: Env = process.env): Coverage[] {
  if (p === "mock") return purpose === "verification" ? ["faces", "ai", "web"] : ["nudity", "gore", "hate", "ai", "web"];
  if (p === "local") return purpose === "verification" ? [] : ["nudity"];
  if (p === "google") return purpose === "verification" ? [] : ["nudity", "gore"];
  if (p === "aws") return purpose === "verification" ? [] : ["nudity", "gore", "hate"];
  if (p === "sightengine") {
    const m = models(sightengineModelsFor(purpose, env));
    const out: Coverage[] = [];
    if (m.some((x) => x.startsWith("nudity"))) out.push("nudity");
    if (m.some((x) => x.startsWith("gore"))) out.push("gore");
    if (m.some((x) => x.startsWith("offensive"))) out.push("hate");
    if (m.includes("genai")) out.push("ai");
    if (m.includes("faces")) out.push("faces");
    return out;
  }
  return [];
}

export function timeoutMs(env: Env = process.env): number {
  const n = parseInt(env.IMAGE_MODERATION_TIMEOUT_MS || "", 10);
  return Number.isFinite(n) && n >= 500 && n <= 30000 ? n : DEFAULT_TIMEOUT_MS;
}

/** Calls the provider. Throws on a network error, an error response or an abort (the caller times it out). */
export async function runProvider(p: ProviderId, input: ProviderInput, env: Env = process.env): Promise<ModerationResult> {
  const problem = providerProblem(p, env);
  if (problem) throw new Error(problem);
  switch (p) {
    case "sightengine": return sightengine(input, env);
    case "google": return google(input, env);
    case "aws": return aws(input, env);
    case "local": return local(input);
    case "mock": return mock(input);
    default: throw new Error("No image check provider is set");
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Helpers

const clamp = (n: unknown) => {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
};
const max = (...xs: unknown[]) => Math.max(0, ...xs.map(clamp));
const round = (n: number) => Math.round(n * 1000) / 1000;
type J = Record<string, any>;
const obj = (x: unknown): J => (x && typeof x === "object" && !Array.isArray(x) ? (x as J) : {});

function result(provider: ProviderId, s: Omit<ModerationResult, "provider" | "raw" | "ops">, raw: unknown): ModerationResult {
  const out: ModerationResult = {
    nudity: round(s.nudity), sexual: round(s.sexual), violence: round(s.violence), gore: round(s.gore), hate: round(s.hate),
    provider, raw,
  };
  if (s.isPhotoOfPerson !== undefined) out.isPhotoOfPerson = round(s.isPhotoOfPerson);
  if (s.hasText !== undefined) out.hasText = round(s.hasText);
  if (s.aiGenerated !== undefined) out.aiGenerated = round(s.aiGenerated);
  if (s.faces !== undefined) out.faces = Math.max(0, Math.round(s.faces));
  if (s.webFullMatches !== undefined) out.webFullMatches = Math.max(0, Math.round(s.webFullMatches));
  if (s.unchecked?.length) out.unchecked = s.unchecked;
  return out;
}

async function readJson(res: Response, who: string): Promise<J> {
  const text = await res.text();
  let json: J;
  try { json = JSON.parse(text); } catch { throw new Error(`${who} answered ${res.status} with something that isn't JSON`); }
  if (!res.ok) throw new Error(`${who} answered ${res.status}: ${String(json?.error?.message || json?.message || json?.__type || text).slice(0, 200)}`);
  return json;
}

// ---------------------------------------------------------------------------------------------------------------
// Sightengine: POST https://api.sightengine.com/1.0/check.json (multipart: media, models, api_user, api_secret).
// Each model is one "operation" on the bill. Default models: nudity-2.1, gore-2.0, offensive-2.0, violence, text
// type (photo vs illustration) and genai (AI-generated). Add "faces" to SIGHTENGINE_MODELS for the
// photo-of-a-person score on artworks. Verification photos (purpose "verification") send only "faces": one operation.

export const SIGHTENGINE_DEFAULT_MODELS = "nudity-2.1,gore-2.0,offensive-2.0,violence,text,type,genai";
/** A verification photo: is a person in it, and is it AI-made. Two operations. */
export const SIGHTENGINE_VERIFY_MODELS = "faces,genai";
/** The second check for new artists when the main provider is local: what local can't tell. Three operations. */
export const SIGHTENGINE_EXTRA_MODELS = "gore-2.0,offensive-2.0,genai";
export function sightengineModelsFor(purpose: Purpose, env: Env = process.env): string {
  if (purpose === "verification") return SIGHTENGINE_VERIFY_MODELS;
  if (purpose === "extra") return (env.SIGHTENGINE_EXTRA_MODELS || SIGHTENGINE_EXTRA_MODELS).trim();
  return (env.SIGHTENGINE_MODELS || SIGHTENGINE_DEFAULT_MODELS).trim();
}

async function sightengine(input: ProviderInput, env: Env): Promise<ModerationResult> {
  const fd = new FormData();
  fd.append("media", new Blob([new Uint8Array(input.image)], { type: input.mime }), "preview.jpg");
  const list = sightengineModelsFor(input.purpose ?? "artwork", env);
  fd.append("models", list);
  fd.append("api_user", env.SIGHTENGINE_USER!.trim());
  fd.append("api_secret", env.SIGHTENGINE_SECRET!.trim());
  const res = await fetch("https://api.sightengine.com/1.0/check.json", { method: "POST", body: fd, signal: input.signal });
  const out = normalizeSightengine(await readJson(res, "Sightengine"), list);
  out.ops ??= models(list).length;
  return out;
}

/** `sent`: the models asked for, so scores for models that weren't asked for are marked unchecked, not 0. */
export function normalizeSightengine(json: J, sent?: string): ModerationResult {
  if (json?.status !== "success") throw new Error(`Sightengine: ${json?.error?.message || json?.status || "no answer"}`);
  const n = obj(json.nudity);
  const gore = obj(json.gore);
  const off = obj(json.offensive);
  const vio = obj(json.violence);
  const text = obj(json.text);
  const type = obj(json.type);
  // nudity-2.1: sexual_activity / sexual_display are explicit; erotica is nudity without explicit display (most
  // artistic nudes). The older nudity model (raw / partial) is read too, in case SIGHTENGINE_MODELS uses it.
  const sexual = max(n.sexual_activity, n.sexual_display, n.raw);
  const nudity = max(sexual, n.erotica, n.partial);
  // offensive-2.0: nazi, supremacist, terrorist and confederate symbols count as hate; asian_swastika (religious)
  // and middle_finger (rude, not hateful) don't. The v1 model has only a single "prob".
  const hate = "nazi" in off || "supremacist" in off ? max(off.nazi, off.supremacist, off.terrorist, off.confederate) : max(off.prob);
  const goreProb = max(gore.prob);
  // Faces only come back when "faces" (or face-attributes) is among the models; type.photo when "type" is.
  // A face in a photograph (not an illustration) = a photo of a person. Without the faces model: unknown.
  const isPhotoOfPerson = Array.isArray(json.faces) ? (json.faces.length ? ("photo" in type ? clamp(type.photo) : 0.5) : 0) : undefined;
  const hasText = "has_artificial" in text ? max(text.has_artificial) : undefined;
  // genai model: type.ai_generated, 0-1. // Unverified against live docs (name and field from Sightengine's model list).
  const aiGenerated = "ai_generated" in type ? clamp(type.ai_generated) : undefined;
  const faces = Array.isArray(json.faces) ? json.faces.length : undefined;
  const out = result("sightengine", {
    nudity, sexual, gore: goreProb, violence: max(vio.prob), hate, isPhotoOfPerson, hasText, aiGenerated, faces,
  }, json);
  if (sent) {
    const m = models(sent);
    const unchecked: ModerationResult["unchecked"] = [];
    if (!m.some((x) => x.startsWith("nudity"))) unchecked.push("nudity", "sexual");
    if (!m.some((x) => x.startsWith("gore"))) unchecked.push("gore");
    if (!m.includes("violence")) unchecked.push("violence");
    if (!m.some((x) => x.startsWith("offensive"))) unchecked.push("hate");
    if (unchecked.length) out.unchecked = unchecked;
  }
  const ops = Number(json?.request?.operations);
  if (Number.isFinite(ops) && ops > 0) out.ops = ops;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Google Cloud Vision: POST https://vision.googleapis.com/v1/images:annotate?key=… with SAFE_SEARCH_DETECTION and
// LABEL_DETECTION (two billed features per image). SafeSearch gives likelihoods, not scores, and its "adult" covers
// any nudity, painted or not, so the labels decide whether it's artwork: on art, adult/violence count as nudity and
// violence labels rather than as explicit content.

async function google(input: ProviderInput, env: Env): Promise<ModerationResult> {
  const body = {
    requests: [{
      image: { content: input.image.toString("base64") },
      features: [{ type: "SAFE_SEARCH_DETECTION" }, { type: "LABEL_DETECTION", maxResults: 15 }],
    }],
  };
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(env.GOOGLE_VISION_API_KEY!.trim())}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: input.signal,
  });
  return normalizeGoogle(await readJson(res, "Google Vision"));
}

export const LIKELIHOOD: Record<string, number> = { UNKNOWN: 0, VERY_UNLIKELY: 0.02, UNLIKELY: 0.15, POSSIBLE: 0.5, LIKELY: 0.75, VERY_LIKELY: 0.95 };
const ART_LABELS = /^(painting|art|visual arts|artwork|drawing|illustration|sketch|watercolor paint|acrylic paint|oil paint|modern art|still life|portrait|sculpture|printmaking|creative arts|paint|artist|figure drawing|graphics|line art)$/i;
const PHOTO_PERSON_LABELS = /^(selfie|portrait photography|photograph|snapshot|fun|smile|happy|human|people|person|skin|facial expression)$/i;
const TEXT_LABELS = /^(screenshot|font|text|document|meme|web page|multimedia|software|website|number)$/i;

export function normalizeGoogle(json: J): ModerationResult {
  const r = obj(Array.isArray(json?.responses) ? json.responses[0] : null);
  if (r.error) throw new Error(`Google Vision: ${r.error.message || r.error.code}`);
  const ss = obj(r.safeSearchAnnotation);
  if (!Object.keys(ss).length) throw new Error("Google Vision: no SafeSearch answer");
  const L = (k: string) => LIKELIHOOD[String(ss[k] || "UNKNOWN")] ?? 0;
  const labels: { d: string; s: number }[] = (Array.isArray(r.labelAnnotations) ? r.labelAnnotations : []).map((l: J) => ({ d: String(l.description || ""), s: clamp(l.score) }));
  const score = (re: RegExp) => labels.filter((l) => re.test(l.d)).reduce((m, l) => Math.max(m, l.s), 0);
  const art = score(ART_LABELS);
  const isArt = art >= 0.7;
  const adult = L("adult"), racy = L("racy"), violence = L("violence");
  const photoPerson = score(PHOTO_PERSON_LABELS);
  return result("google", {
    nudity: Math.max(adult, racy >= 0.75 ? racy * 0.8 : 0),
    // On artwork, "adult" is nearly always a painted nude: label it, don't hold it. Off artwork it counts in full.
    sexual: isArt ? Math.min(adult, 0.6) : adult,
    violence,
    gore: isArt ? Math.min(violence, 0.6) : violence,
    hate: 0, // SafeSearch has no hate-symbol category
    isPhotoOfPerson: labels.length ? (isArt ? 0 : photoPerson) : undefined,
    hasText: labels.length ? score(TEXT_LABELS) : undefined,
  }, json);
}

// ---------------------------------------------------------------------------------------------------------------
// AWS Rekognition DetectModerationLabels: one signed JSON POST (Signature V4, below). Handles both the v6 and v7
// label taxonomies. Labels come with Confidence 0-100 and a ParentName.

async function aws(input: ProviderInput, env: Env): Promise<ModerationResult> {
  const region = (env.AWS_REGION || env.AWS_DEFAULT_REGION || "us-east-1").trim();
  const host = `rekognition.${region}.amazonaws.com`;
  const body = JSON.stringify({ Image: { Bytes: input.image.toString("base64") }, MinConfidence: 20 });
  const headers: Record<string, string> = {
    "content-type": "application/x-amz-json-1.1",
    host,
    "x-amz-date": amzDate(new Date()),
    "x-amz-target": "RekognitionService.DetectModerationLabels",
  };
  if (env.AWS_SESSION_TOKEN?.trim()) headers["x-amz-security-token"] = env.AWS_SESSION_TOKEN.trim();
  headers.authorization = sigV4({
    method: "POST", host, path: "/", query: "", headers, body, region, service: "rekognition",
    accessKeyId: env.AWS_ACCESS_KEY_ID!.trim(), secretAccessKey: env.AWS_SECRET_ACCESS_KEY!.trim(),
  });
  const { host: _h, ...send } = headers;
  const res = await fetch(`https://${host}/`, { method: "POST", headers: send, body, signal: input.signal });
  return normalizeAws(await readJson(res, "AWS Rekognition"));
}

export const amzDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const sha256 = (s: string) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (key: crypto.BinaryLike, s: string) => crypto.createHmac("sha256", key).update(s, "utf8").digest();

/** AWS Signature Version 4 Authorization header. `headers` keys must be lowercase and include host and x-amz-date. */
export function sigV4(o: { method: string; host: string; path: string; query: string; headers: Record<string, string>; body: string; region: string; service: string; accessKeyId: string; secretAccessKey: string }): string {
  const date = o.headers["x-amz-date"];
  const day = date.slice(0, 8);
  const names = Object.keys(o.headers).map((k) => k.toLowerCase()).sort();
  const canonicalHeaders = names.map((k) => `${k}:${String(o.headers[k]).trim().replace(/\s+/g, " ")}\n`).join("");
  const signed = names.join(";");
  const canonical = [o.method, o.path, o.query, canonicalHeaders, signed, sha256(o.body)].join("\n");
  const scope = `${day}/${o.region}/${o.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", date, scope, sha256(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${o.secretAccessKey}`, day), o.region), o.service), "aws4_request");
  const signature = crypto.createHmac("sha256", key).update(toSign, "utf8").digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${o.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
}

export function normalizeAws(json: J): ModerationResult {
  if (!Array.isArray(json?.ModerationLabels)) throw new Error(`AWS Rekognition: ${json?.message || json?.__type || "no labels in the answer"}`);
  const labels: { name: string; parent: string; c: number }[] = json.ModerationLabels.map((l: J) => ({ name: String(l.Name || ""), parent: String(l.ParentName || ""), c: clamp(Number(l.Confidence) / 100) }));
  const pick = (re: RegExp) => labels.filter((l) => re.test(l.name) || re.test(l.parent)).reduce((m, l) => Math.max(m, l.c), 0);
  const illustrated = (Array.isArray(json.ContentTypes) ? json.ContentTypes : []).some((t: J) => /illustrated|animated/i.test(String(t.Name)) && Number(t.Confidence) >= 50);
  // v7: "Explicit Sexual Activity", "Sex Toys"; v6: "Sexual Activity", "Adult Toys". Explicit nudity counts as
  // sexual only off artwork (v6 "Illustrated Explicit Nudity" / v7 ContentTypes "Illustrated" mark art).
  const activity = pick(/^(explicit sexual activity|sexual activity|sex toys|adult toys)$/i);
  const explicitNudity = pick(/^(explicit nudity|graphic male nudity|graphic female nudity|exposed male genitalia|exposed female genitalia|exposed buttocks or anus)$/i);
  const illustratedNudity = pick(/^illustrated explicit nudity$/i);
  const nudity = Math.max(activity, explicitNudity, illustratedNudity, pick(/^(nudity|non-explicit nudity|non-explicit nudity of intimate parts and kissing|exposed female nipple|exposed male nipple|bare back|obstructed intimate parts|partially exposed buttocks|partially exposed female breast|implied nudity)$/i));
  const sexual = Math.max(activity, illustrated || illustratedNudity >= explicitNudity ? 0 : explicitNudity);
  const gore = pick(/^(graphic violence or gore|blood & gore|corpses|death and emaciation|emaciated bodies|self injury|self-harm|hanging)$/i);
  const violence = Math.max(gore, pick(/^(violence|graphic violence|physical violence|weapon violence|explosions and blasts|weapons)$/i));
  const hate = pick(/^(hate symbols|nazi party|white supremacy|extremist)$/i);
  return result("aws", { nudity, sexual, violence, gore: illustrated ? Math.min(gore, 0.6) : gore, hate }, json);
}

// ---------------------------------------------------------------------------------------------------------------
// Local: NSFWJS (MobileNetV2) on our own server, via ./local.ts. Five classes that sum to 1:
//   Drawing (illustration, painting)   Neutral (ordinary photo)   Sexy (suggestive, bare skin, no explicit display)
//   Porn (explicit photo)              Hentai (explicit drawing)
// Mapped onto the shared scores so ./policy.ts works unchanged:
//   sexual = Porn + Hentai                          held at THRESHOLDS.review.sexual (0.85)
//   nudity = 1.5 x (Sexy + Porn + Hentai), max 1    labeled "Nudity" at THRESHOLDS.label.nudity (0.5), i.e. a raw
//                                                   share of 0.33. NSFWJS splits a painted nude between Drawing and
//                                                   Sexy/Hentai, so the share is scaled up (LOCAL_NUDITY_GAIN) to label it.
// Because the five add up to 1, explicit can only reach 0.85 when Drawing + Neutral + Sexy is 0.15 or less: a painting
// that reads as Drawing (painted nudes do) is labeled, never held. Sexy never counts as explicit, so suggestive and
// nude work is labeled at most. Gore, violence and hate stay unchecked (hidden on the card, not scored as 0); there's
// no photo-of-a-person, text, AI or web score either. On 25 real paintings (public/uploads/arts) none was held or
// labeled; classical nudes read mostly Neutral, so local under-labels nudity rather than over-holding it.

export const LOCAL_UNCHECKED: NonNullable<ModerationResult["unchecked"]> = ["gore", "violence", "hate"];
/** See the mapping above. Raise it to label more, lower it to label less. */
export const LOCAL_NUDITY_GAIN = 1.5;

export function normalizeLocal(predictions: { className: string; probability: number }[]): ModerationResult {
  if (!Array.isArray(predictions) || !predictions.length) throw new Error("local: no prediction");
  const p: Record<string, number> = { Drawing: 0, Hentai: 0, Neutral: 0, Porn: 0, Sexy: 0 };
  for (const x of predictions) if (x && x.className in p) p[x.className] = clamp(x.probability);
  const sexual = Math.min(1, p.Porn + p.Hentai);
  const nudity = Math.min(1, LOCAL_NUDITY_GAIN * (p.Sexy + p.Porn + p.Hentai));
  return result("local", { nudity, sexual, violence: 0, gore: 0, hate: 0, unchecked: LOCAL_UNCHECKED }, { classes: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, round(v)])) });
}

async function local(input: ProviderInput): Promise<ModerationResult> {
  // Loaded only here, so the unit checks and the other providers never pull in TensorFlow.
  const mod = await import("./local");
  const { predictions, ms, loadMs } = await mod.classifyLocal(input.image, input.signal);
  const out = normalizeLocal(predictions);
  out.raw = { ...(out.raw as object), ms, loadMs };
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Mock (dev only): scores from words in the title/filename, so every policy branch can be tried end to end.
//   nsfw / explicit / porn → explicit (review)        gore / bloody → gore (review)     hate / nazi → hate (review)
//   nude / nudity → nudity (labeled)                  violent / violence → violence (labeled)
//   selfie → photo of a person (review)               meme / screenshot → overlaid text (review)
//   timeout → never answers (the caller's timeout)    error → the provider fails
//   aiart / midjourney → AI-generated (held when auto-approval is on)
//   stock / stolen → found elsewhere online (only the mock fills this; no real provider does yet)
//   Verification photos: one face, unless the name has noface / landscape

export const MOCK_HINTS = ["nsfw", "explicit", "porn", "gore", "bloody", "hate", "nazi", "nude", "nudity", "violent", "violence", "selfie", "meme", "screenshot", "timeout", "error", "aiart", "midjourney", "stock", "stolen", "noface", "landscape"];

export function mockScores(hint: string, purpose: ProviderInput["purpose"] = "artwork"): Omit<ModerationResult, "provider" | "raw"> {
  const h = hint.toLowerCase();
  const has = (...words: string[]) => words.some((w) => new RegExp(`(^|[^a-z])${w}`, "i").test(h));
  return {
    aiGenerated: has("aiart", "midjourney") ? 0.97 : 0.02,
    webFullMatches: has("stock", "stolen") ? 2 : 0,
    ...(purpose === "verification" ? { faces: has("noface", "landscape") ? 0 : 1 } : {}),
    nudity: has("nsfw", "explicit", "porn") ? 0.97 : has("nude", "nudity") ? 0.72 : 0.01,
    sexual: has("nsfw", "explicit", "porn") ? 0.94 : has("nude", "nudity") ? 0.08 : 0.01,
    violence: has("gore", "bloody") ? 0.9 : has("violent", "violence") ? 0.66 : 0.01,
    gore: has("gore", "bloody") ? 0.93 : has("violent", "violence") ? 0.25 : 0.01,
    hate: has("hate", "nazi") ? 0.95 : 0.01,
    isPhotoOfPerson: has("selfie") ? 0.96 : has("meme") ? 0.6 : 0.02,
    hasText: has("screenshot") ? 0.99 : has("meme") ? 0.95 : 0.02,
  };
}

async function mock(input: ProviderInput): Promise<ModerationResult> {
  const h = input.hint.toLowerCase();
  if (/(^|[^a-z])timeout/.test(h)) {
    await new Promise<void>((_, reject) => {
      const t = setTimeout(() => reject(new Error("mock: no answer")), 120_000);
      input.signal.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); }, { once: true });
    });
  }
  if (/(^|[^a-z])error/.test(h)) throw new Error("mock: provider error (filename hint)");
  await new Promise((r) => setTimeout(r, 120));
  const s = mockScores(input.hint, input.purpose);
  return result("mock", s, { mock: true, hint: input.hint.slice(0, 120), bytes: input.image.length, scores: s });
}
