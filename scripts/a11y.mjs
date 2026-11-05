#!/usr/bin/env node
// Accessibility scan: runs axe-core (WCAG 2.1 A/AA + best practices) over the main flows
// at a desktop (1280) and a phone (390) width, then prints a summary.
//
//   npm run a11y                      scan http://localhost:3000 (dev server must be running)
//   A11Y_BASE=https://staging… npm run a11y
//   npm run a11y -- --only=home,cart  scan a subset (page ids below)
//   npm run a11y -- --verbose         every node selector, not just the first few
//   npm run a11y -- --json=out.json   also write the full results
//   npm run a11y -- --strict          exit 1 when anything serious or critical is found
//
// Logs in with the seeded local accounts (password artfinity123). Collector pages need a collector session:
// A11Y_COLLECTOR_TOKEN=<collector-token cookie value> (sign in at /collector/sign-in; the dev log prints the link). Checkout runs in test mode
// (no Stripe keys), so "Pay" saves a paid test order and lands on /thank-you.
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { writeFileSync } from "node:fs";

const BASE = (process.env.A11Y_BASE || "http://localhost:3000").replace(/\/$/, "");
const PASSWORD = process.env.A11Y_PASSWORD || "artfinity123";
const ACCOUNTS = { artist: "maya@artfinity.local", admin: "admin@artfinity.local" };
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const ONLY = typeof args.only === "string" ? new Set(args.only.split(",")) : null;
const VERBOSE = !!args.verbose;
const WIDTHS = [{ name: "1280", width: 1280, height: 800 }, { name: "390", width: 390, height: 844, isMobile: true, hasTouch: true }];
const PAINTING = "/@mayaokafor/art/east-river-late-may";
const TIMEOUT = 180_000; // dev server compiles on first hit

/** id, path, who must be logged in, optional setup that lands the page in the right state. */
const PAGES = [
  { id: "home", path: "/" },
  { id: "painting", path: PAINTING },
  { id: "cart", path: "/cart", setup: fillCart },
  { id: "checkout", path: "/checkout", setup: fillCart },
  { id: "thank-you", path: "/checkout", setup: payTestOrder },
  { id: "artist", path: "/@mayaokafor" },
  { id: "links", path: "/@mayaokafor/links" },
  { id: "help", path: "/help" },
  { id: "help-article", path: "/help/buyers/shipping-delivery" },
  { id: "venues", path: "/venues" },
  { id: "venue", path: "/venues/lumen-cafe" },
  { id: "accessibility", path: "/accessibility" },
  { id: "offline", path: "/offline" },
  { id: "login", path: "/login" },
  { id: "register", path: "/register" },
  { id: "studio", path: "/studio", as: "artist" },
  { id: "studio-upload", path: "/studio/art/new", as: "artist" },
  { id: "studio-art", path: "/studio/art", as: "artist" },
  { id: "studio-edit-art", path: "/studio/art/east-river-late-may", as: "artist" },
  { id: "studio-collections", path: "/studio/collections", as: "artist" },
  { id: "studio-rooms", path: "/studio/rooms", as: "artist" },
  { id: "studio-bulk", path: "/studio/bulk", as: "artist" },
  { id: "studio-qr", path: "/studio/qr", as: "artist" },
  { id: "studio-codes", path: "/studio/codes", as: "artist" },
  { id: "studio-events", path: "/studio/events", as: "artist" },
  { id: "studio-embed", path: "/studio/developers", as: "artist" },
  { id: "studio-404", path: "/studio/no-such-page", as: "artist" },
  { id: "studio-money", path: "/studio/money", as: "artist" },
  { id: "studio-analytics", path: "/studio/analytics", as: "artist" },
  { id: "studio-followers", path: "/studio/followers", as: "artist" },
  { id: "studio-share", path: "/studio/share", as: "artist" },
  { id: "admin", path: "/admin", as: "admin" },
  { id: "admin-social", path: "/admin/social", as: "admin" },
  { id: "admin-social-setup", path: "/admin/social/setup", as: "admin" },
  { id: "collector-sign-in", path: "/collector/sign-in" },
  { id: "collector", path: "/collector", as: "collector" },
  { id: "collector-settings", path: "/collector/settings", as: "collector" },
];

async function settle(page) {
  await page.waitForLoadState("load", { timeout: TIMEOUT });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(800); // client effects, fonts
}

async function goto(page, path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  await settle(page);
}

async function fillCart(page) {
  await goto(page, PAINTING);
  const add = page.getByRole("button", { name: /add to cart/i }).first();
  await add.click({ timeout: 30_000 });
  await page.waitForTimeout(500);
}

async function payTestOrder(page) {
  await fillCart(page);
  await goto(page, "/checkout");
  await page.getByRole("textbox", { name: /email/i }).first().fill("a11y-scan@artfinity.local").catch(() => {});
  await page.getByRole("button", { name: /^pay /i }).locator("visible=true").first().click({ timeout: 30_000 });
  await page.waitForURL(/thank-you/, { timeout: TIMEOUT });
  await settle(page);
  return "skip-goto";
}

async function login(context, who) {
  if (who === "collector") {
    const value = process.env.A11Y_COLLECTOR_TOKEN;
    if (!value) throw new Error("set A11Y_COLLECTOR_TOKEN to a collector-token cookie value");
    await context.addCookies([{ name: "collector-token", value, url: BASE }]);
    return;
  }
  const res = await context.request.post(BASE + "/api/auth/login", {
    data: { email: ACCOUNTS[who], password: PASSWORD, remember: true },
    timeout: TIMEOUT,
  });
  if (!res.ok()) throw new Error(`login as ${who} failed: ${res.status()} ${await res.text()}`);
}

const IMPACTS = ["critical", "serious", "moderate", "minor"];

async function scan(browser, size, def) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: !!size.isMobile, hasTouch: !!size.hasTouch, baseURL: BASE });
  try {
    if (def.as) await login(context, def.as);
    const page = await context.newPage();
    const setupResult = def.setup ? await def.setup(page) : null;
    if (setupResult !== "skip-goto") await goto(page, def.path);
    const url = page.url().replace(BASE, "");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();
    return { id: def.id, width: size.name, url, violations: results.violations };
  } catch (err) {
    return { id: def.id, width: size.name, url: def.path, error: String(err?.message || err).split("\n")[0] };
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
const runs = [];
for (const def of PAGES) {
  if (ONLY && !ONLY.has(def.id)) continue;
  for (const size of WIDTHS) {
    process.stdout.write(`· ${def.id} @${size.name} … `);
    const r = await scan(browser, size, def);
    runs.push(r);
    if (r.error) { console.log(`ERROR ${r.error}`); continue; }
    const counts = Object.fromEntries(IMPACTS.map((i) => [i, r.violations.filter((v) => v.impact === i).length]));
    console.log(r.violations.length ? IMPACTS.filter((i) => counts[i]).map((i) => `${counts[i]} ${i}`).join(", ") : "clean");
    for (const v of r.violations) {
      const targets = v.nodes.map((n) => n.target.join(" "));
      const shown = VERBOSE ? targets : targets.slice(0, 3);
      console.log(`    [${v.impact}] ${v.id} (${v.nodes.length}): ${v.help}`);
      for (const t of shown) console.log(`        ${t}`);
      if (shown.length < targets.length) console.log(`        … ${targets.length - shown.length} more`);
    }
  }
}
await browser.close();

// Summary: violations (rules) per impact, and the rules that show up most.
const total = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
const byRule = new Map();
for (const r of runs) for (const v of r.violations || []) {
  total[v.impact] = (total[v.impact] || 0) + 1;
  const e = byRule.get(v.id) || { impact: v.impact, pages: 0, nodes: 0 };
  e.pages += 1; e.nodes += v.nodes.length;
  byRule.set(v.id, e);
}
const errors = runs.filter((r) => r.error);
console.log("\n── Summary " + "─".repeat(50));
console.log(`Scanned ${runs.length - errors.length} page/width combinations${errors.length ? `, ${errors.length} failed to load` : ""}.`);
console.log(`Violations (rule × page × width): ${IMPACTS.map((i) => `${total[i]} ${i}`).join(" · ")}`);
if (byRule.size) {
  console.log("By rule:");
  for (const [id, e] of [...byRule].sort((a, b) => IMPACTS.indexOf(a[1].impact) - IMPACTS.indexOf(b[1].impact) || b[1].nodes - a[1].nodes))
    console.log(`  ${e.impact.padEnd(9)} ${id.padEnd(32)} ${e.pages} page×width, ${e.nodes} nodes`);
}
for (const r of errors) console.log(`  failed: ${r.id} @${r.width}: ${r.error}`);
if (typeof args.json === "string") {
  writeFileSync(args.json, JSON.stringify(runs, null, 2));
  console.log(`Full results: ${args.json}`);
}
if (args.strict && (total.critical || total.serious || errors.length)) process.exit(1);
