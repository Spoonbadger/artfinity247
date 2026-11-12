// The "local" image check: NSFWJS (MobileNetV2, MIT) on our own server, with pure @tensorflow/tfjs (no native
// binary, so it runs on Vercel serverless). Server only: loaded with a dynamic import from ./providers.ts, so neither
// the model nor TensorFlow ever reaches the browser bundle (next.config.mjs keeps both packages external).
//
// The model files ship with the app in data/models/nsfwjs/mobilenet_v2 (scripts/extract-nsfw-model.mjs copies them out
// of the nsfwjs package): no CDN at run time. Loaded once per server instance and kept in the module cache.
// Measured on the dev box (pure JS CPU backend): about 2 s to load, 1.3 to 2 s per 1600px preview.
//
// What it can tell: nudity and explicit content only. No gore, hate symbols, AI-generated or web-match checks.
// The class mapping onto the shared scores is normalizeLocal in ./providers.ts (pure, unit-checked).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const LOCAL_MODEL_DIR = path.join(process.cwd(), "data", "models", "nsfwjs", "mobilenet_v2");
const SIZE = 224;

export type LocalPrediction = { className: string; probability: number };
type Classifier = { classify(img: unknown, topk?: number): Promise<LocalPrediction[]> };

type Loaded = { model: Classifier; tf: any; loadMs: number };
// On globalThis, so every route bundle in one server process shares one model (dev compiles routes separately).
const cache = globalThis as unknown as { __afLocalModel?: Promise<Loaded> | null };

export const localModelPresent = () => fs.existsSync(path.join(LOCAL_MODEL_DIR, "model.json")) && fs.existsSync(path.join(LOCAL_MODEL_DIR, "group1-shard1of1.bin"));

async function loadModel(): Promise<Loaded> {
  const started = Date.now();
  const tf: any = await import("@tensorflow/tfjs");
  const { load } = (await import("nsfwjs/core")) as unknown as { load: (h: unknown, o: { size: number }) => Promise<Classifier> };
  const json = JSON.parse(fs.readFileSync(path.join(LOCAL_MODEL_DIR, "model.json"), "utf8"));
  const bin = fs.readFileSync(path.join(LOCAL_MODEL_DIR, "group1-shard1of1.bin"));
  const handler = tf.io.fromMemory({
    modelTopology: json.modelTopology,
    weightSpecs: json.weightsManifest.flatMap((g: { weights: unknown[] }) => g.weights),
    weightData: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
  });
  const model = await load(handler, { size: SIZE });
  const loadMs = Date.now() - started;
  console.info("IMAGE_CHECK_LOCAL_LOADED", JSON.stringify({ backend: tf.getBackend?.(), loadMs }));
  return { model, tf, loadMs };
}

/** The model, loaded once per server instance. A failed load is retried on the next call. */
function getModel(): Promise<Loaded> {
  cache.__afLocalModel ??= loadModel().catch((err) => {
    cache.__afLocalModel = null;
    throw err;
  });
  return cache.__afLocalModel;
}

/** The five NSFWJS class probabilities for one image (Drawing, Hentai, Neutral, Porn, Sexy). */
export async function classifyLocal(image: Buffer, signal?: AbortSignal): Promise<{ predictions: LocalPrediction[]; ms: number; loadMs: number }> {
  if (!localModelPresent()) throw new Error("the local model files are missing (run node scripts/extract-nsfw-model.mjs)");
  const started = Date.now();
  const { model, tf, loadMs } = await getModel();
  if (signal?.aborted) throw new Error("aborted");
  const { data } = await sharp(image, { failOn: "none" }).rotate().flatten({ background: "#ffffff" }).resize(SIZE, SIZE, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const tensor = tf.tensor3d(new Uint8Array(data), [SIZE, SIZE, 3], "int32");
  try {
    const predictions = await model.classify(tensor, 5);
    return { predictions, ms: Date.now() - started, loadMs };
  } finally {
    tensor.dispose();
  }
}
