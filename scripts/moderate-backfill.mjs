// Runs the automatic image check (lib/moderation) over artworks already on Artfinity. Dry run by default: it prints
// what the check would do and changes nothing.
//
//   node --env-file=.env scripts/moderate-backfill.mjs                  # dry run, pieces never checked, live + pending
//   node --env-file=.env scripts/moderate-backfill.mjs --apply          # write the results
//   node --env-file=.env scripts/moderate-backfill.mjs --limit 200      # at most 200 pieces (default 500)
//   node --env-file=.env scripts/moderate-backfill.mjs --all            # re-check pieces that already have a result
//   node --env-file=.env scripts/moderate-backfill.mjs --status APPROVED   # APPROVED | PENDING | REJECTED | any
//
// Uses IMAGE_MODERATION_PROVIDER and its keys, like uploads (Node 22.18+ loads the TypeScript provider and policy
// code directly). Every check is a paid provider call, so try --limit first.
//
// What --apply does, without ever taking a live piece down:
//   labeled → adds the suggested sensitive label(s), so the piece is blurred for buyers. The artist isn't emailed.
//   review  → adds the labels and sets flaggedReason "auto_moderation:<reason>": a live piece stays live but shows in
//             /admin/moderation "To review" for a person to decide; a pending piece just carries the reason.
//   every checked piece gets its scores stored (AdminAction "artwork.auto_check"), shown on the moderation card.
// Dry run reads images and calls the provider but writes nothing.
import fs from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const here = (f) => new URL(f, import.meta.url).href;
const P = await import(here("../lib/moderation/providers" + ".ts"));
const { decide, scoresOf } = await import(here("../lib/moderation/policy" + ".ts"));

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL = args.includes("--all");
const arg = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };
const LIMIT = Math.max(1, parseInt(arg("--limit", "500"), 10) || 500);
const STATUS = String(arg("--status", "")).toUpperCase();
const ACTION = "artwork.auto_check";
const PUBLIC = path.join(process.cwd(), "public");

const provider = P.activeProvider(process.env);
if (provider === "none") {
  console.error(`No image check provider to run (IMAGE_MODERATION_PROVIDER=${process.env.IMAGE_MODERATION_PROVIDER || "unset"}). See MODERATION_SETUP.md.`);
  process.exit(1);
}
const problem = P.providerProblem(provider, process.env);
if (problem) { console.error(`${provider}: ${problem}`); process.exit(1); }

const prisma = new PrismaClient();

/** The public 1600px preview's bytes (same rule as readPreview in lib/moderation/index.ts). */
async function readPreview(url, signal) {
  const clean = url.split("?")[0];
  if (/^\/(?:[\w.-]+\/)*[\w.-]+\.(?:jpe?g|png|webp)$/i.test(clean) && !clean.includes("..")) {
    const file = path.join(PUBLIC, ...clean.split("/").filter(Boolean));
    return file.startsWith(PUBLIC + path.sep) ? fs.readFile(file).catch(() => null) : null;
  }
  if (/^https:\/\/res\.cloudinary\.com\//.test(clean)) {
    const res = await fetch(url, { signal }).catch(() => null);
    return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  return null;
}

async function check(a) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), P.timeoutMs(process.env));
  try {
    const image = await readPreview(a.imageUrl, ac.signal);
    if (!image) throw new Error("couldn't read the preview image");
    return await P.runProvider(provider, { image, mime: "image/jpeg", hint: `${a.title} ${a.imageUrl}`, signal: ac.signal }, process.env);
  } finally {
    clearTimeout(timer);
  }
}

const statuses = STATUS === "ANY" ? undefined : STATUS ? [STATUS] : ["APPROVED", "PENDING"];
const checked = ALL ? [] : (await prisma.adminAction.findMany({ where: { action: ACTION, targetType: "artwork" }, select: { targetId: true } })).map((r) => r.targetId).filter(Boolean);
const rows = await prisma.artwork.findMany({
  where: { ...(statuses ? { status: { in: statuses } } : {}), ...(checked.length ? { id: { notIn: checked } } : {}) },
  orderBy: { createdAt: "desc" },
  take: LIMIT,
  select: { id: true, title: true, imageUrl: true, status: true, sensitive: true, flaggedReason: true },
});

console.log(`${APPLY ? "APPLYING" : "Dry run"}: ${rows.length} artwork(s), provider ${provider}${ALL ? ", re-checking all" : ""}.`);
const tally = { clean: 0, labeled: 0, review: 0, error: 0 };
for (const a of rows) {
  const started = Date.now();
  let result = null, error = null;
  try { result = await check(a); } catch (e) { error = String(e?.message || e).slice(0, 200); }
  const d = decide(result, a.sensitive, "error");
  tally[d.outcome] = (tally[d.outcome] || 0) + 1;
  const what = d.outcome === "review" ? `REVIEW (${d.reasons.join(", ")})${d.addedLabels.length ? ` + labels ${d.addedLabels.join(", ")}` : ""}`
    : d.outcome === "labeled" ? `label ${d.addedLabels.join(", ")}`
    : d.outcome === "error" ? `error: ${error}` : "clean";
  console.log(`${a.status.padEnd(8)} ${a.id}  ${a.title.slice(0, 40).padEnd(40)}  ${what}`);
  if (!APPLY || !result) continue;

  const data = {};
  if (d.addedLabels.length) data.sensitive = d.labels;
  // Never overwrite a duplicate flag or an admin's rejection reason.
  if (d.flaggedReason && !a.flaggedReason && a.status !== "REJECTED") Object.assign(data, { flaggedReason: d.flaggedReason, flaggedBy: "system" });
  if (Object.keys(data).length) await prisma.artwork.update({ where: { id: a.id }, data });
  await prisma.adminAction.create({
    data: {
      adminId: "system", adminEmail: "auto-check", action: ACTION, targetType: "artwork", targetId: a.id,
      summary: `Automatic image check (backfill): ${d.outcome}${d.reasons.length ? ` (${d.reasons.join(", ")})` : d.addedLabels.length ? ` (${d.addedLabels.join(", ")})` : ""}`,
      details: {
        provider, outcome: d.outcome, scores: scoresOf(result), reasons: d.reasons, addedLabels: d.addedLabels, artistLabels: a.sensitive,
        ms: Date.now() - started, at: new Date().toISOString(), backfill: true,
      },
    },
  });
}
console.log(`\nclean ${tally.clean}, labeled ${tally.labeled}, review ${tally.review}, errors ${tally.error}.${APPLY ? " Written." : " Nothing written (add --apply)."}`);
if (APPLY && tally.review) console.log("Held pieces are in /admin/moderation → To review.");
await prisma.$disconnect();
