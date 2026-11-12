// Unit checks for the automatic image check. No test runner needed:
//   node --test lib/moderation/moderation.test.mjs     (Node 22.18+ strips the TypeScript types itself)
// Covers: each provider's response normalizer against sample JSON shaped like its documented response, the AWS
// Signature V4 signer against AWS's published test vector, the policy branches, and the production guard on mock.
import { test } from "node:test";
import assert from "node:assert/strict";

// Computed paths keep TypeScript/Next from trying to resolve ".ts" imports in this plain-JS file.
const here = (f) => new URL(f, import.meta.url).href;
const P = await import(here("./providers" + ".ts"));
const { decide, THRESHOLDS, labelNotice, REVIEW_NOTICE } = await import(here("./policy" + ".ts"));
const policy = await import(here("./policy" + ".ts"));

// --- Sightengine (POST /1.0/check.json, models nudity-2.1,gore-2.0,offensive-2.0,violence,text,type) ---------------
const sightengineNude = {
  status: "success",
  request: { id: "req_abc", timestamp: 1730800000.1, operations: 6 },
  nudity: {
    sexual_activity: 0.01, sexual_display: 0.03, erotica: 0.81, very_suggestive: 0.1, suggestive: 0.04, mildly_suggestive: 0.01,
    suggestive_classes: { bikini: 0.01, cleavage: 0.02, lingerie: 0.01 }, none: 0.01,
    context: { sea_lake_pool: 0.01, outdoor_other: 0.02, indoor_other: 0.9 },
  },
  gore: { prob: 0.02, classes: { very_bloody: 0.01, slightly_bloody: 0.01, body_organ: 0.01, serious_injury: 0.01, superficial_injury: 0.01, corpse: 0.01, skull: 0.01, unconscious: 0.01, body_waste: 0.01, other: 0.01 }, type: { animated: 0.9, fake: 0.05, real: 0.05 } },
  offensive: { nazi: 0.01, asian_swastika: 0.6, confederate: 0.01, supremacist: 0.01, terrorist: 0.01, middle_finger: 0.4 },
  violence: { prob: 0.03, classes: { physical_violence: 0.02, firearm_threat: 0.01, combat_sport: 0.01 } },
  text: { has_artificial: 0.04, has_natural: 0.2 },
  type: { photo: 0.08, illustration: 0.92 },
  media: { id: "med_xyz", uri: "preview.jpg" },
};

test("sightengine: artistic nude → nudity high, sexual low, religious swastika and middle finger aren't hate", () => {
  const r = P.normalizeSightengine(sightengineNude);
  assert.equal(r.provider, "sightengine");
  assert.equal(r.nudity, 0.81);
  assert.equal(r.sexual, 0.03);
  assert.equal(r.gore, 0.02);
  assert.equal(r.violence, 0.03);
  assert.equal(r.hate, 0.01);
  assert.equal(r.hasText, 0.04);
  assert.equal(r.isPhotoOfPerson, undefined); // no faces model
  assert.equal(r.raw, sightengineNude);
  const d = decide(r, []);
  assert.equal(d.outcome, "labeled");
  assert.deepEqual(d.addedLabels, ["Nudity"]);
});

test("sightengine: explicit + gore + nazi symbol, with faces on a photo", () => {
  const r = P.normalizeSightengine({
    ...sightengineNude,
    nudity: { sexual_activity: 0.93, sexual_display: 0.4, erotica: 0.2, none: 0 },
    gore: { prob: 0.91 },
    offensive: { nazi: 0.88, supremacist: 0.1 },
    type: { photo: 0.97, illustration: 0.03 },
    faces: [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.4 }],
  });
  assert.equal(r.sexual, 0.93);
  assert.equal(r.nudity, 0.93);
  assert.equal(r.gore, 0.91);
  assert.equal(r.hate, 0.88);
  assert.equal(r.isPhotoOfPerson, 0.97);
  assert.deepEqual(decide(r, []).reasons, ["sexual", "gore", "hate", "photo_of_person"]);
});

test("sightengine: error response throws", () => {
  assert.throws(() => P.normalizeSightengine({ status: "failure", request: { id: "x" }, error: { type: "credentials_error", code: 103, message: "Incorrect API user or secret" } }), /Incorrect API user/);
});

// --- Google Cloud Vision (images:annotate, SAFE_SEARCH_DETECTION + LABEL_DETECTION) ------------------------------
const googlePainting = {
  responses: [{
    safeSearchAnnotation: { adult: "VERY_LIKELY", spoof: "VERY_UNLIKELY", medical: "UNLIKELY", violence: "UNLIKELY", racy: "VERY_LIKELY" },
    labelAnnotations: [
      { mid: "/m/05qdh", description: "Painting", score: 0.95, topicality: 0.95 },
      { mid: "/m/0jjw", description: "Art", score: 0.9, topicality: 0.9 },
      { mid: "/m/02csf", description: "Drawing", score: 0.6, topicality: 0.6 },
    ],
  }],
};

test("google: a painted nude is labeled, not held (adult capped on artwork)", () => {
  const r = P.normalizeGoogle(googlePainting);
  assert.equal(r.provider, "google");
  assert.equal(r.nudity, 0.95);
  assert.equal(r.sexual, 0.6);
  assert.equal(r.hate, 0);
  assert.equal(r.isPhotoOfPerson, 0);
  const d = decide(r, ["Strong language"]);
  assert.equal(d.outcome, "labeled");
  assert.deepEqual(d.labels, ["Strong language", "Nudity"]);
});

test("google: adult content on a photo is held; violence maps to gore off artwork", () => {
  const r = P.normalizeGoogle({ responses: [{
    safeSearchAnnotation: { adult: "VERY_LIKELY", spoof: "UNLIKELY", medical: "UNLIKELY", violence: "VERY_LIKELY", racy: "LIKELY" },
    labelAnnotations: [{ description: "Selfie", score: 0.93 }, { description: "Skin", score: 0.9 }],
  }] });
  assert.equal(r.sexual, 0.95);
  assert.equal(r.gore, 0.95);
  assert.equal(r.isPhotoOfPerson, 0.93);
  assert.equal(decide(r, []).flaggedReason, "auto_moderation:sexual");
});

test("google: per-image error and missing SafeSearch throw", () => {
  assert.throws(() => P.normalizeGoogle({ responses: [{ error: { code: 3, message: "Bad image data." } }] }), /Bad image data/);
  assert.throws(() => P.normalizeGoogle({ responses: [{}] }), /no SafeSearch/);
});

// --- AWS Rekognition DetectModerationLabels -----------------------------------------------------------------------
test("aws v7: explicit sexual activity and blood & gore", () => {
  const r = P.normalizeAws({
    ModerationModelVersion: "7.0",
    ModerationLabels: [
      { Confidence: 97.1, Name: "Explicit", ParentName: "", TaxonomyLevel: 1 },
      { Confidence: 95.4, Name: "Explicit Sexual Activity", ParentName: "Explicit", TaxonomyLevel: 2 },
      { Confidence: 88.0, Name: "Blood & Gore", ParentName: "Graphic Violence", TaxonomyLevel: 3 },
      { Confidence: 88.0, Name: "Graphic Violence", ParentName: "Violence", TaxonomyLevel: 2 },
      { Confidence: 70.0, Name: "Nazi Party", ParentName: "Hate Symbols", TaxonomyLevel: 2 },
    ],
    ContentTypes: [],
  });
  assert.equal(r.provider, "aws");
  assert.equal(r.sexual, 0.954);
  assert.equal(r.gore, 0.88);
  assert.equal(r.violence, 0.88);
  assert.equal(r.hate, 0.7);
  assert.equal(decide(r, []).outcome, "review");
});

test("aws v6: illustrated explicit nudity counts as nudity, not sexual", () => {
  const r = P.normalizeAws({
    ModerationModelVersion: "6.1",
    ModerationLabels: [
      { Confidence: 91.2, Name: "Explicit Nudity", ParentName: "" },
      { Confidence: 91.2, Name: "Illustrated Explicit Nudity", ParentName: "Explicit Nudity" },
    ],
  });
  assert.equal(r.nudity, 0.912);
  assert.equal(r.sexual, 0);
  assert.equal(decide(r, []).outcome, "labeled");
});

test("aws: error body throws", () => {
  assert.throws(() => P.normalizeAws({ __type: "InvalidImageFormatException", message: "Request has invalid image format" }), /invalid image format/);
});

test("sigV4 matches AWS's get-vanilla test vector", () => {
  const auth = P.sigV4({
    method: "GET", host: "example.amazonaws.com", path: "/", query: "",
    headers: { host: "example.amazonaws.com", "x-amz-date": "20150830T123600Z" }, body: "",
    region: "us-east-1", service: "service", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  });
  assert.equal(auth, "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
  assert.equal(P.amzDate(new Date("2015-08-30T12:36:00.000Z")), "20150830T123600Z");
});

// --- Policy -------------------------------------------------------------------------------------------------------
test("policy: clean, labeled (keeps artist's labels, no duplicates), review, and no result", () => {
  const zero = { nudity: 0.01, sexual: 0.01, violence: 0.01, gore: 0.01, hate: 0.01 };
  assert.equal(decide(zero, ["Drug use"]).outcome, "clean");
  assert.deepEqual(decide(zero, ["Drug use"]).labels, ["Drug use"]);

  const both = decide({ ...zero, nudity: 0.7, violence: 0.6 }, ["nudity"]);
  assert.equal(both.outcome, "labeled");
  assert.deepEqual(both.addedLabels, ["Violence or gore"]); // "nudity" already chosen (any case)
  assert.equal(both.notice, "We marked this 'Violence or gore' so it's blurred until buyers tap — change it anytime.");
  assert.equal(labelNotice(["Nudity", "Violence or gore"]), "We marked this 'Nudity' and 'Violence or gore' so it's blurred until buyers tap — change it anytime.");

  const held = decide({ ...zero, gore: THRESHOLDS.review.gore }, []);
  assert.equal(held.outcome, "review");
  assert.equal(held.flaggedReason, "auto_moderation:gore");
  assert.deepEqual(held.addedLabels, ["Violence or gore"]);
  assert.equal(held.notice, REVIEW_NOTICE);

  // Nudity alone, however certain, never holds a piece.
  assert.equal(decide({ ...zero, nudity: 0.99 }, []).outcome, "labeled");
  // Watermark-level overlaid text doesn't hold it either.
  assert.equal(decide({ ...zero, hasText: 0.9 }, []).outcome, "clean");

  const off = decide(null, ["Nudity"], "error");
  assert.equal(off.outcome, "error");
  assert.deepEqual(off.labels, ["Nudity"]);
  assert.equal(off.flaggedReason, null);
});

// --- Provider selection and the mock ------------------------------------------------------------------------------
test("mock never runs in production", () => {
  assert.equal(P.activeProvider({ IMAGE_MODERATION_PROVIDER: "mock", NODE_ENV: "development" }), "mock");
  assert.equal(P.activeProvider({ IMAGE_MODERATION_PROVIDER: "mock", NODE_ENV: "production" }), "none");
  assert.equal(P.activeProvider({ IMAGE_MODERATION_PROVIDER: "mock", VERCEL_ENV: "production" }), "none");
  assert.equal(P.activeProvider({}), "none");
  assert.equal(P.activeProvider({ IMAGE_MODERATION_PROVIDER: "bogus" }), "none");
  assert.match(P.providerProblem("sightengine", {}), /SIGHTENGINE_USER/);
  assert.equal(P.providerProblem("google", { GOOGLE_VISION_API_KEY: "k" }), null);
});

test("mock: filename hints hit every branch", async () => {
  const run = (hint) => P.runProvider("mock", { image: Buffer.from("x"), mime: "image/jpeg", hint, signal: new AbortController().signal }, { NODE_ENV: "test" });
  assert.equal(decide(await run("Sunset Field /uploads/a/1.jpg"), []).outcome, "clean");
  assert.equal(decide(await run("Nude Study"), []).outcome, "labeled");
  assert.equal(decide(await run("Violent Storm"), []).outcome, "labeled");
  assert.equal(decide(await run("nsfw test"), []).flaggedReason, "auto_moderation:sexual");
  assert.equal(decide(await run("Gore Test"), []).flaggedReason, "auto_moderation:gore");
  assert.equal(decide(await run("hate flag"), []).flaggedReason, "auto_moderation:hate");
  assert.equal(decide(await run("selfie"), []).flaggedReason, "auto_moderation:photo_of_person");
  assert.equal(decide(await run("meme"), []).flaggedReason, "auto_moderation:meme");
  assert.equal(decide(await run("screenshot"), []).flaggedReason, "auto_moderation:text_overlay");
  await assert.rejects(run("error case"), /provider error/);
  // "timeout" hangs until aborted.
  const ac = new AbortController();
  const p = P.runProvider("mock", { image: Buffer.from("x"), mime: "image/jpeg", hint: "timeout", signal: ac.signal }, { NODE_ENV: "test" });
  setTimeout(() => ac.abort(), 50);
  await assert.rejects(p, /aborted/);
});

// --- Local (NSFWJS MobileNetV2 classes → shared scores) --------------------------------------------------------------
const cls = (o) => Object.entries(o).map(([className, probability]) => ({ className, probability }));

test("local: class mapping (explicit = Porn + Hentai, nudity = 1.5 x (Sexy + Porn + Hentai)), gore and hate unchecked", () => {
  const r = P.normalizeLocal(cls({ Drawing: 0.1, Hentai: 0.05, Neutral: 0.05, Porn: 0.7, Sexy: 0.1 }));
  assert.equal(r.provider, "local");
  assert.equal(r.sexual, 0.75);
  assert.equal(r.nudity, 1);
  assert.equal(P.normalizeLocal(cls({ Drawing: 0.8, Hentai: 0.1, Neutral: 0, Porn: 0, Sexy: 0.1 })).nudity, 0.3);
  assert.deepEqual(r.unchecked, ["gore", "violence", "hate"]);
  assert.equal(r.isPhotoOfPerson, undefined);
  assert.equal(r.aiGenerated, undefined);
  const { scoresOf } = policy;
  assert.deepEqual(Object.keys(scoresOf(r)).sort(), ["nudity", "sexual"]); // the card hides what wasn't checked
});

test("local: a painted nude (mostly Drawing, some Sexy) is labeled, never held", () => {
  const nude = P.normalizeLocal(cls({ Drawing: 0.55, Hentai: 0.12, Neutral: 0.03, Porn: 0.05, Sexy: 0.25 }));
  const d = decide(nude, []);
  assert.equal(d.outcome, "labeled");
  assert.deepEqual(d.addedLabels, ["Nudity"]);
  // Even a drawing at the edge: explicit can't reach the hold line while Drawing + Neutral + Sexy > 0.15.
  const edge = P.normalizeLocal(cls({ Drawing: 0.2, Hentai: 0.6, Neutral: 0, Porn: 0.15, Sexy: 0.05 }));
  assert.equal(decide(edge, []).outcome, "labeled");
});

test("local: explicit content is held; ordinary art and photos stay clean (real seed results)", () => {
  assert.equal(decide(P.normalizeLocal(cls({ Drawing: 0.01, Hentai: 0.02, Neutral: 0.02, Porn: 0.9, Sexy: 0.05 })), []).outcome, "review");
  assert.equal(decide(P.normalizeLocal(cls({ Drawing: 0.03, Hentai: 0.93, Neutral: 0.01, Porn: 0.02, Sexy: 0.01 })), []).outcome, "review");
  // Measured on public/seed/art-01.jpg, scenes/photos/pixabay-1484853.jpg and public/assets/images/home-slider-1.jpg.
  assert.equal(decide(P.normalizeLocal(cls({ Neutral: 0.952, Drawing: 0.045, Hentai: 0.003, Porn: 0.001, Sexy: 0 })), []).outcome, "clean");
  assert.equal(decide(P.normalizeLocal(cls({ Neutral: 0.998, Drawing: 0.002, Sexy: 0, Porn: 0, Hentai: 0 })), []).outcome, "clean");
  assert.equal(decide(P.normalizeLocal(cls({ Drawing: 0.791, Hentai: 0.146, Neutral: 0.045, Porn: 0.015, Sexy: 0.003 })), []).outcome, "clean");
  // Real paintings in public/uploads/arts: Vitruvian Man, Death and the Maiden, and the highest false score (a photo).
  assert.equal(decide(P.normalizeLocal(cls({ Neutral: 0.933, Drawing: 0.057, Hentai: 0.006, Porn: 0.004, Sexy: 0.001 })), []).outcome, "clean");
  assert.equal(decide(P.normalizeLocal(cls({ Neutral: 0.696, Drawing: 0.292, Hentai: 0.008, Sexy: 0.002, Porn: 0.002 })), []).outcome, "clean");
  assert.equal(decide(P.normalizeLocal(cls({ Neutral: 0.776, Porn: 0.208, Sexy: 0.006, Drawing: 0.005, Hentai: 0.005 })), []).outcome, "clean");
  // Suggestive photo (Sexy high): labeled, not held, as with every provider.
  assert.equal(decide(P.normalizeLocal(cls({ Drawing: 0, Hentai: 0, Neutral: 0.15, Porn: 0.05, Sexy: 0.8 })), []).outcome, "labeled");
  assert.throws(() => P.normalizeLocal([]));
});

test("tiers: coverage per provider and purpose", () => {
  const env = { SIGHTENGINE_USER: "u", SIGHTENGINE_SECRET: "s" };
  assert.deepEqual(P.providerCoverage("local", "artwork", env), ["nudity"]);
  assert.deepEqual(P.providerCoverage("local", "verification", env), []);
  assert.deepEqual(P.providerCoverage("sightengine", "artwork", env), ["nudity", "gore", "hate", "ai"]);
  assert.deepEqual(P.providerCoverage("sightengine", "extra", env), ["gore", "hate", "ai"]);
  assert.deepEqual(P.providerCoverage("sightengine", "verification", env), ["ai", "faces"]);
  assert.deepEqual(P.providerCoverage("sightengine", "artwork", { ...env, SIGHTENGINE_MODELS: "nudity-2.1" }), ["nudity"]);
  assert.deepEqual(P.providerCoverage("google", "artwork", env), ["nudity", "gore"]);
  assert.deepEqual(P.providerCoverage("none", "artwork", env), []);
  assert.equal(P.sightengineModelsFor("extra", env), "gore-2.0,offensive-2.0,genai");
  assert.equal(P.sightengineModelsFor("verification", env), "faces,genai");
});

test("tiers: the extra check is Sightengine (or mock in dev) with keys, never the main provider", () => {
  const keys = { SIGHTENGINE_USER: "u", SIGHTENGINE_SECRET: "s" };
  assert.equal(P.extraProvider({ IMAGE_MODERATION_PROVIDER: "local", IMAGE_MODERATION_EXTRA: "sightengine", ...keys }), "sightengine");
  assert.equal(P.extraProvider({ IMAGE_MODERATION_PROVIDER: "local", IMAGE_MODERATION_EXTRA: "sightengine" }), "none"); // no keys
  assert.equal(P.extraProvider({ IMAGE_MODERATION_PROVIDER: "sightengine", IMAGE_MODERATION_EXTRA: "sightengine", ...keys }), "none");
  assert.equal(P.extraProvider({ IMAGE_MODERATION_PROVIDER: "local", IMAGE_MODERATION_EXTRA: "mock" }), "mock");
  assert.equal(P.extraProvider({ IMAGE_MODERATION_PROVIDER: "local", IMAGE_MODERATION_EXTRA: "mock", NODE_ENV: "production" }), "none");
  assert.equal(P.extraProvider({ IMAGE_MODERATION_PROVIDER: "local", IMAGE_MODERATION_EXTRA: "aws" }), "none");
});

test("sightengine: genai and faces are read; models not asked for are unchecked; operations counted", () => {
  const r = P.normalizeSightengine({ status: "success", request: { operations: 3 }, gore: { prob: 0.02 }, offensive: { nazi: 0.01, supremacist: 0.01 }, type: { ai_generated: 0.97 } }, "gore-2.0,offensive-2.0,genai");
  assert.equal(r.aiGenerated, 0.97);
  assert.equal(r.ops, 3);
  assert.deepEqual(r.unchecked, ["nudity", "sexual", "violence"]);
  const f = P.normalizeSightengine({ status: "success", faces: [{ x1: 0.1 }, { x1: 0.5 }], type: { ai_generated: 0.01 } }, "faces,genai");
  assert.equal(f.faces, 2);
});
