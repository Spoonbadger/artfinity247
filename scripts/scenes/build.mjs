#!/usr/bin/env node
// Combine scenes/annotations/*.json into data/scenes.json (server) and data/scenes-client.json (browser manifest).
//   npm run scenes:build              real photos only (scenes/photos)
//   npm run scenes:build -- --fixtures  also the synthetic test fixtures (for testing only: they would replace the
//                                       procedural rooms on the site; run without --fixtures again afterwards)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(root);
const require = createRequire(import.meta.url);
const jiti = createRequire(require.resolve("tailwindcss"))("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const { buildCatalog } = jiti(path.join(root, "lib/scenes/catalog.ts"));

const fixtures = process.argv.includes("--fixtures");
const { report, catalog } = await buildCatalog({ fixtures, write: true });
console.log(`Photos found: ${report.photos}${fixtures ? " (including fixtures)" : ""}`);
console.log(`Annotated: ${report.annotated}  rejected: ${report.rejected}  not annotated yet: ${report.unannotated.length}`);
if (report.unannotated.length) console.log(`  todo: ${report.unannotated.slice(0, 12).join(", ")}${report.unannotated.length > 12 ? ", …" : ""}`);
console.log(`Variants: ${report.variants} (avg ${report.perPhoto} per photo)  distinct scene numbers: ${report.distinct}/1000`);
if (report.annotated && report.distinct < 1000)
  console.log(`  ~${report.photosFor1000} annotated photos at this rate fill all 1,000 with distinct variants (${Math.max(0, report.photosFor1000 - report.annotated)} more). Until then numbers repeat.`);
if (!report.annotated) console.log("No photo scenes: the site keeps the procedural rooms.");
if (catalog.photos.some((p) => p.source === "fixture")) console.log("WARNING: synthetic fixtures are in data/scenes.json. Rebuild without --fixtures before shipping.");
console.log(`Wrote data/scenes.json and data/scenes-client.json (rev ${catalog.rev}).`);
