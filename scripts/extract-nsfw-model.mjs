// One-off: copies NSFWJS's bundled MobileNetV2 model (base64 inside node_modules/nsfwjs) into plain files the local
// image check loads from disk: data/models/nsfwjs/mobilenet_v2/model.json + group1-shard1of1.bin (about 2.6 MB).
// Run again after upgrading nsfwjs:  node scripts/extract-nsfw-model.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
// The package exports only its entry points, so find its folder from the main file (dist/cjs/index.js).
const pkgDir = path.resolve(path.dirname(require.resolve("nsfwjs")), "..", "..");
const src = path.join(pkgDir, "dist", "models", "mobilenet_v2");
const out = path.join(process.cwd(), "data", "models", "nsfwjs", "mobilenet_v2");
fs.mkdirSync(out, { recursive: true });

const unwrap = (m) => (m && m.default ? m.default : m);
const modelJson = unwrap(require(path.join(src, "model.min.js")));
const shard = unwrap(require(path.join(src, "group1-shard1of1.min.js")));
if (!modelJson?.modelTopology || typeof shard !== "string") throw new Error("Unexpected nsfwjs bundle layout");

fs.writeFileSync(path.join(out, "group1-shard1of1.bin"), Buffer.from(shard, "base64"));
fs.writeFileSync(path.join(out, "model.json"), JSON.stringify(modelJson));
const { version } = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
fs.writeFileSync(path.join(out, "SOURCE.txt"), `NSFWJS ${version} MobileNetV2 (MIT, github.com/infinitered/nsfwjs). Made by scripts/extract-nsfw-model.mjs.\n`);
console.log("wrote", out, fs.readdirSync(out).map((f) => `${f} ${fs.statSync(path.join(out, f)).size}`));
