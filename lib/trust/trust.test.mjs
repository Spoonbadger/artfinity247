// Unit checks for the trust engine (artwork auto-approval and auto-verification). No test runner needed:
//   npm run test:trust
// Covers: every hold reason for artworks and verification, the fail-safe with no provider, the tiers (local alone
// for established artists, extra checks for new ones), velocity, spot checks, settings, the text check, the page
// scan for the ownership proof, the SSRF guard (private IPs, DNS, redirects, size and time caps) and the
// record-only Instagram proof.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const here = (f) => new URL(f, import.meta.url).href;
const A = await import(here("./artwork" + ".ts"));
const V = await import(here("./verification" + ".ts"));
const C = await import(here("./config" + ".ts"));
const T = await import(here("./text" + ".ts"));
const F = await import(here("./safeFetch" + ".ts"));
const I = await import(here("./instagramProof" + ".ts"));

// ---------------------------------------------------------------------------------------------------------------
// Artwork

const established = { admin: false, verified: false, suspended: false, openReports: 0, approvedCount: 8, accountAgeDays: 60, uploadsLast24h: 0 };
const newbie = { ...established, approvedCount: 0, accountAgeDays: 1 };
const FULL = ["nudity", "gore", "hate", "ai"];
const sig = (o = {}) => ({
  autoApprove: true,
  providerReady: true,
  check: { outcome: "clean", reasons: [], aiGenerated: 0.02 },
  coverage: FULL,
  duplicate: false,
  textFlags: [],
  artist: established,
  printableCount: 4,
  isNewUpload: true,
  settings: { velocityN: 10, minAccountDays: 7 },
  ...o,
});
const codes = (d) => d.reasons.map((r) => r.code);

test("artwork: everything clean → approved, with what passed", () => {
  const d = A.decideArtwork(sig());
  assert.equal(d.decision, "approve");
  assert.equal(d.mode, "auto");
  assert.deepEqual(d.reasons, []);
  assert.ok(d.passed.includes("clean image") && d.passed.includes("no duplicate") && d.passed.includes("no AI signal"));
  assert.equal(d.flagCode, null);
});

test("artwork: a new artist with full coverage is auto-approved too", () => {
  assert.equal(A.decideArtwork(sig({ artist: newbie })).decision, "approve");
});

test("artwork: each check holds on its own, with its reason", () => {
  const cases = [
    [{ check: { outcome: "error", reasons: [], error: "timed out after 6000 ms" } }, "check_error"],
    [{ check: { outcome: "off", reasons: [] } }, "check_error"],
    [{ check: { outcome: "review", reasons: ["sexual"], aiGenerated: 0.01 } }, "image"],
    [{ duplicate: true }, "duplicate"],
    [{ check: { outcome: "clean", reasons: [], aiGenerated: 0.95 } }, "ai_generated"],
    [{ check: { outcome: "clean", reasons: [] } }, "check_error"], // AI covered but no score: fail safe
    [{ coverage: [...FULL, "web"], check: { outcome: "clean", reasons: [], aiGenerated: 0.01, webFullMatches: 2 } }, "web_match"],
    [{ textFlags: ["text_profanity"] }, "text_profanity"],
    [{ textFlags: ["text_link"] }, "text_link"],
    [{ textFlags: ["text_email"] }, "text_email"],
    [{ textFlags: ["text_phone"] }, "text_phone"],
    [{ textFlags: ["text_nonsense"] }, "text_nonsense"],
    [{ artist: { ...established, suspended: true } }, "suspended"],
    [{ artist: { ...established, openReports: 1 } }, "report_open"],
    [{ artist: { ...newbie, uploadsLast24h: 10 } }, "velocity"],
    [{ printableCount: 0 }, "image_too_small"],
  ];
  for (const [o, code] of cases) {
    const d = A.decideArtwork(sig(o));
    assert.equal(d.decision, "hold", code);
    assert.ok(codes(d).includes(code), `${code}: got ${codes(d)}`);
  }
});

test("artwork: the flag code skips duplicate and image (those keep their own flaggedReason)", () => {
  const d = A.decideArtwork(sig({ duplicate: true, textFlags: ["text_link"] }));
  assert.deepEqual(codes(d), ["duplicate", "text_link"]);
  assert.equal(d.flagCode, "text_link");
  assert.equal(A.decideArtwork(sig({ duplicate: true })).flagCode, "duplicate");
});

test("artwork: velocity only counts for new artists, new uploads and non-admins", () => {
  assert.equal(A.decideArtwork(sig({ artist: { ...established, uploadsLast24h: 40 } })).decision, "approve");
  assert.equal(A.decideArtwork(sig({ artist: { ...newbie, uploadsLast24h: 9 } })).decision, "approve");
  assert.ok(codes(A.decideArtwork(sig({ artist: { ...newbie, uploadsLast24h: 10 } }))).includes("velocity"));
  assert.equal(A.decideArtwork(sig({ artist: { ...newbie, uploadsLast24h: 10 }, isNewUpload: false })).decision, "approve");
  assert.equal(A.decideArtwork(sig({ artist: { ...newbie, admin: true, uploadsLast24h: 30 } })).decision, "approve");
  // An old account with fewer than 3 approved pieces is still new.
  assert.ok(A.isNewArtist({ admin: false, accountAgeDays: 400, approvedCount: 2 }, 7));
  assert.ok(!A.isNewArtist({ admin: false, accountAgeDays: 8, approvedCount: 3 }, 7));
  assert.ok(A.isNewArtist({ admin: false, accountAgeDays: 6, approvedCount: 9 }, 7));
  assert.ok(codes(A.decideArtwork(sig({ artist: { ...newbie, uploadsLast24h: 3 }, settings: { velocityN: 3, minAccountDays: 7 } }))).includes("velocity"));
});

test("artwork fail-safe: no provider keeps today's rule (first 3 held, verified and 3+ approved go live)", () => {
  const off = { providerReady: false, check: { outcome: "off", reasons: [] }, coverage: [] };
  const held = A.decideArtwork(sig({ ...off, artist: newbie }));
  assert.equal(held.decision, "hold");
  assert.equal(held.mode, "legacy");
  assert.deepEqual(codes(held), ["first_pieces", "no_provider"]);
  assert.equal(held.flagCode, null); // reads as before in the queue
  assert.equal(A.decideArtwork(sig({ ...off, artist: { ...newbie, approvedCount: 2, accountAgeDays: 90 } })).decision, "hold");
  assert.equal(A.decideArtwork(sig({ ...off, artist: { ...established, approvedCount: 3 } })).decision, "approve");
  assert.equal(A.decideArtwork(sig({ ...off, artist: { ...newbie, verified: true } })).decision, "approve");
  assert.equal(A.decideArtwork(sig({ ...off, artist: { ...newbie, admin: true } })).decision, "approve");
  // Even a trusted artist's duplicate waits.
  assert.deepEqual(codes(A.decideArtwork(sig({ ...off, duplicate: true }))), ["duplicate", "no_provider"]);
});

test("artwork: switched off = today's rules, whatever the provider says", () => {
  const d = A.decideArtwork(sig({ autoApprove: false, artist: newbie }));
  assert.equal(d.mode, "off");
  assert.deepEqual(codes(d), ["first_pieces"]);
  assert.equal(A.decideArtwork(sig({ autoApprove: false, textFlags: ["text_link"] })).decision, "approve"); // today's behaviour
  assert.deepEqual(codes(A.decideArtwork(sig({ autoApprove: false, check: { outcome: "review", reasons: ["gore"] } }))), ["image"]);
});

test("artwork tiers: local alone is enough for an established artist, not for a new one", () => {
  const local = { coverage: ["nudity"], check: { outcome: "clean", reasons: [] } };
  const ok = A.decideArtwork(sig({ ...local }));
  assert.equal(ok.decision, "approve");
  assert.ok(!ok.passed.includes("no AI signal")); // AI isn't covered, so it isn't claimed
  const held = A.decideArtwork(sig({ ...local, artist: newbie }));
  assert.equal(held.decision, "hold");
  assert.equal(held.mode, "legacy");
  assert.deepEqual(codes(held), ["first_pieces", "checks_missing"]);
  assert.equal(held.reasons[1].detail, "gore, hate");
  // A verified new artist still goes live under today's rule.
  assert.equal(A.decideArtwork(sig({ ...local, artist: { ...newbie, verified: true } })).decision, "approve");
  // Local + the Sightengine extra check (gore, hate, AI): full auto for the new artist.
  assert.equal(A.decideArtwork(sig({ coverage: ["nudity", "gore", "hate", "ai"], artist: newbie })).decision, "approve");
  // The extra check failed: coverage is nudity only again, so the new artist falls back.
  assert.equal(A.decideArtwork(sig({ ...local, artist: { ...newbie, approvedCount: 1 } })).decision, "hold");
});

test("artwork: spot checks pick about 1 in N, 0 = never", () => {
  assert.equal(C.pickSpotCheck(20, () => 0.01), true);
  assert.equal(C.pickSpotCheck(20, () => 0.06), false);
  assert.equal(C.pickSpotCheck(0, () => 0), false);
  let n = 0, x = 0;
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 20000; i++) if (C.pickSpotCheck(20, rand)) n++;
  assert.ok(n > 800 && n < 1200, `picked ${n} of 20000`);
});

test("artwork: auto_hold flag helpers", () => {
  assert.equal(A.autoHoldCode("auto_hold:velocity"), "velocity");
  assert.equal(A.autoHoldCode("possible_duplicate:abc"), null);
  assert.ok(A.isAutoHold("auto_hold:text_link"));
});

// ---------------------------------------------------------------------------------------------------------------
// Settings

test("settings: switches default ON only when the provider is ready; saved values win; numbers clamp", () => {
  assert.equal(C.resolveTrust({}, true).autoApprove, true);
  assert.equal(C.resolveTrust({}, false).autoApprove, false);
  assert.equal(C.resolveTrust({}, true, false).autoVerify, false);
  assert.equal(C.resolveTrust({ autoApprove: false }, true).autoApprove, false);
  assert.equal(C.resolveTrust({ autoApprove: true }, false).autoApprove, true); // saved on, still fails safe in decide
  const d = C.resolveTrust(undefined, false);
  assert.deepEqual([d.spotCheckEvery, d.velocityN, d.minAccountDays], [20, 10, 7]);
  assert.deepEqual(d.saved, { autoApprove: null, autoVerify: null });
  const c = C.resolveTrust({ spotCheckEvery: 99999, velocityN: 0, minAccountDays: -3 }, true);
  assert.deepEqual([c.spotCheckEvery, c.velocityN, c.minAccountDays], [1000, 1, 0]);
});

test("settings: the owner's save is validated", () => {
  const ok = { autoApprove: true, autoVerify: false, spotCheckEvery: 20, velocityN: 10, minAccountDays: 7 };
  assert.deepEqual(C.parseTrustInput(ok).value, ok);
  assert.ok(C.parseTrustInput({ ...ok, autoApprove: "yes" }).error);
  assert.match(C.parseTrustInput({ ...ok, velocityN: 0 }).error, /Uploads in 24 hours/);
  assert.match(C.parseTrustInput({ ...ok, spotCheckEvery: 2.5 }).error, /Spot check/);
  assert.match(C.parseTrustInput({ ...ok, minAccountDays: 91 }).error, /Account age/);
});

// ---------------------------------------------------------------------------------------------------------------
// Text

test("text: spam, slurs and nonsense are flagged", () => {
  assert.deepEqual(T.checkText("Sunset", "DM me at www.cheap-prints.shop"), ["text_link"]);
  assert.deepEqual(T.checkText("Sunset", "see https://x.co/abc"), ["text_link"]);
  assert.deepEqual(T.checkText("Sunset", "buy at artdeals.com"), ["text_link"]);
  assert.deepEqual(T.checkText("Sunset", "write me: maya@example.com"), ["text_email"]);
  assert.deepEqual(T.checkText("Sunset", "call (555) 123-4567"), ["text_phone"]);
  assert.deepEqual(T.checkText("Sunset", "text +1 555 123 4567"), ["text_phone"]);
  assert.deepEqual(T.checkText("Shit happens", ""), ["text_profanity"]);
  assert.deepEqual(T.checkText("asdfasdf", ""), ["text_nonsense"]);
  assert.deepEqual(T.checkText("!!!!", ""), ["text_nonsense"]);
  assert.deepEqual(T.checkText("aaaaaaa", ""), ["text_nonsense"]);
  assert.deepEqual(T.checkText("4821", ""), ["text_nonsense"]);
  assert.deepEqual(T.checkText("xkcdqwrtplm", ""), ["text_nonsense"]);
  assert.deepEqual(T.checkText("", ""), ["text_nonsense"]);
});

test("text: ordinary art titles and descriptions pass", () => {
  for (const [t, d] of [
    ["East River, Late", "Oil on canvas, 24 x 36 in. Painted 2019-2023."],
    ["St. Louis at Dusk", "Acrylic. Edition of 50."],
    ["Moby Dick", "After the book."],
    ["Rooster", "Cock-a-doodle morning on the farm."],
    ["Shitake study", "Mushrooms."], // not the swear word
    ["Raccoon", "A Maine Coon cat, too."],
    ["Glass", "Shot on 35mm, printed 11x14."],
    ["東京の夜", "Night in Tokyo"],
    ["IMG_4821", ""],
    ["Rhythm", "Untitled study."],
  ]) assert.deepEqual(T.checkText(t, d), [], `${t} / ${d}`);
});

// ---------------------------------------------------------------------------------------------------------------
// Verification

const vsig = (o = {}) => ({
  autoVerify: true,
  providerReady: true,
  website: { url: "https://maya.art/", result: "code" },
  instagram: null,
  photo: { ran: true, faces: 1, aiGenerated: 0.02, flagged: [] },
  facesSupported: true,
  record: { emailConfirmed: true, approvedCount: 2, accountAgeDays: 30, openReports: 0, duplicateFlags: 0, suspended: false },
  settings: { minAccountDays: 7 },
  ...o,
});
const vrec = (o) => ({ record: { ...vsig().record, ...o } });

test("verification: everything passes → approved", () => {
  const d = V.decideVerification(vsig());
  assert.equal(d.decision, "approve");
  assert.ok(d.passed.some((p) => p.startsWith("code found on maya.art")));
  assert.ok(d.passed.includes("a person in the photo"));
  assert.equal(V.decideVerification(vsig({ website: { url: "https://maya.art", result: "link" } })).decision, "approve");
  assert.equal(V.decideVerification(vsig({ website: null, instagram: { url: "https://instagram.com/maya", proven: true, oauthAvailable: true } })).decision, "approve");
});

test("verification: each check holds on its own, with its reason", () => {
  const cases = [
    [{ autoVerify: false }, "auto_off"],
    [{ providerReady: false }, "no_provider"],
    [{ website: { url: "https://maya.art", result: "not_found" } }, "site_no_proof"],
    [{ website: { url: "https://maya.art", result: "error", error: "the site answered 404" } }, "site_error"],
    [{ website: null, instagram: { url: "https://instagram.com/maya", proven: false, oauthAvailable: false } }, "instagram_unchecked"],
    [{ website: null, instagram: { url: "https://instagram.com/maya", proven: false, oauthAvailable: true } }, "instagram_not_connected"],
    [{ website: null }, "no_link"],
    [{ photo: { ran: false, error: "timed out", flagged: [] } }, "photo_error"],
    [{ photo: { ran: true, faces: 1, flagged: ["sexual"] } }, "photo_flagged"],
    [{ facesSupported: false, photo: { ran: true, flagged: [] } }, "photo_faces_unknown"],
    [{ photo: { ran: true, faces: 0, flagged: [] } }, "photo_no_person"],
    [{ photo: { ran: true, faces: 1, aiGenerated: 0.97, flagged: [] } }, "photo_ai"],
    [{ photo: { ran: true, faces: 1, webFullMatches: 3, flagged: [] } }, "photo_web_match"],
    [vrec({ emailConfirmed: false }), "email_unconfirmed"],
    [vrec({ approvedCount: 0 }), "no_approved_art"],
    [vrec({ accountAgeDays: 2 }), "account_new"],
    [vrec({ openReports: 1 }), "report_open"],
    [vrec({ duplicateFlags: 1 }), "duplicate_flags"],
    [vrec({ suspended: true }), "suspended"],
  ];
  for (const [o, code] of cases) {
    const d = V.decideVerification(vsig(o));
    assert.equal(d.decision, "hold", code);
    assert.ok(codes(d).includes(code), `${code}: got ${codes(d)}`);
    assert.deepEqual(d.passed, []);
  }
});

test("verification fail-safe: no provider holds even when everything else is perfect", () => {
  const d = V.decideVerification(vsig({ providerReady: false, photo: { ran: false, flagged: [] } }));
  assert.equal(d.decision, "hold");
  assert.deepEqual(codes(d), ["no_provider"]);
});

test("verification: one proven link is enough when the other fails", () => {
  const d = V.decideVerification(vsig({ website: { url: "https://maya.art", result: "not_found" }, instagram: { url: "https://instagram.com/maya", proven: true, oauthAvailable: true } }));
  assert.equal(d.decision, "approve");
});

test("verification: the page scan finds the code or the artist's own link, nothing else", () => {
  const o = { code: "artfinity-verify-ABCD2345", handle: "maya", hosts: ["theartfinity.com", "localhost"] };
  assert.equal(V.findProof("<p>Verified: artfinity-verify-abcd2345</p>", o), "code");
  assert.equal(V.findProof('<a href="https://theartfinity.com/@maya">shop</a>', o), "link");
  assert.equal(V.findProof('<a href="https://www.theartfinity.com/@maya/art/x">x</a>', o), "link");
  assert.equal(V.findProof("theartfinity.com/&#64;maya", o), "link");
  assert.equal(V.findProof("theartfinity.com/%40maya", o), "link");
  assert.equal(V.findProof('<a href="http://localhost:3000/@maya">x</a>', o), "link");
  assert.equal(V.findProof('<a href="https://theartfinity.com/@mayalee">x</a>', o), null);
  assert.equal(V.findProof('<a href="https://evil-theartfinity.com/@maya">x</a>', o), null);
  assert.equal(V.findProof("artfinity-verify-ZZZZ9999", o), null);
  assert.equal(V.instagramHandle("https://instagram.com/Maya.Paints/"), "maya.paints");
  assert.equal(V.instagramHandle("https://example.com/maya"), null);
});

// ---------------------------------------------------------------------------------------------------------------
// SSRF guard

test("ssrf: private, loopback, link-local and reserved addresses are refused", () => {
  for (const ip of ["127.0.0.1", "127.8.9.1", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.1",
    "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:a9fe:a9fe", "64:ff9b::a00:1", "2001:db8::1"]) {
    assert.ok(F.blockedIp(ip), `${ip} should be blocked`);
  }
  for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111"]) assert.equal(F.blockedIp(ip), null, ip);
  assert.equal(F.blockedIp("not-an-ip"), "invalid");
});

test("ssrf: URLs are vetted before anything is fetched", async () => {
  const pub = async () => ["93.184.216.34"];
  const bad = async (u, o = {}) => (await F.vetUrl(u, { resolve: pub, ...o })).ok;
  assert.equal(await bad("ftp://example.com/"), false);
  assert.equal(await bad("file:///etc/passwd"), false);
  assert.equal(await bad("https://user:pw@example.com/"), false);
  assert.equal(await bad("http://localhost/"), false);
  assert.equal(await bad("http://127.0.0.1/"), false);
  assert.equal(await bad("http://[::1]/"), false);
  assert.equal(await bad("http://169.254.169.254/latest/meta-data/"), false);
  assert.equal(await bad("http://10.1.2.3/"), false);
  assert.equal(await bad("http://printer.local/"), false);
  assert.equal(await bad("http://intranet/"), false);
  assert.equal(await bad("https://example.com:8443/"), false); // standard ports only
  assert.equal(await bad("https://example.com/"), true);
  assert.equal(await bad("http://example.com:80/"), true);
  // DNS that points a public-looking name at a private address (rebinding style) is refused.
  assert.equal((await F.vetUrl("https://rebind.example/", { resolve: async () => ["93.184.216.34", "10.0.0.5"] })).ok, false);
  assert.equal((await F.vetUrl("https://rebind.example/", { resolve: async () => ["169.254.169.254"] })).code, "blocked");
  assert.equal((await F.vetUrl("https://nx.example/", { resolve: async () => { throw new Error("ENOTFOUND"); } })).code, "dns");
  // The dev override opens loopback only, never the other private ranges.
  assert.equal(await bad("http://127.0.0.1:4555/", { allowLocal: true }), true);
  assert.equal(await bad("http://10.0.0.1/", { allowLocal: true }), false);
  assert.equal(await bad("http://169.254.169.254/", { allowLocal: true }), false);
});

test("ssrf: the dev override is refused in production", () => {
  assert.equal(F.localFetchAllowed({ TRUST_FETCH_ALLOW_LOCAL: "1", NODE_ENV: "development" }), true);
  assert.equal(F.localFetchAllowed({ TRUST_FETCH_ALLOW_LOCAL: "1", NODE_ENV: "production" }), false);
  assert.equal(F.localFetchAllowed({ TRUST_FETCH_ALLOW_LOCAL: "1", VERCEL_ENV: "production" }), false);
  assert.equal(F.localFetchAllowed({ NODE_ENV: "development" }), false);
});

function server(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${s.address().port}`, close: () => new Promise((r) => s.close(r)) }));
  });
}

test("ssrf: fetching a local site works only with the override; redirects are re-checked and capped", async () => {
  let hops = 0;
  const s = await server((req, res) => {
    if (req.url === "/page") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<p>artfinity-verify-ABCD2345</p>"); }
    if (req.url === "/to-metadata") { res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }); return res.end(); }
    if (req.url === "/to-private") { res.writeHead(301, { location: "http://10.0.0.7/" }); return res.end(); }
    if (req.url === "/to-page") { res.writeHead(302, { location: "/page" }); return res.end(); }
    if (req.url.startsWith("/loop")) { hops++; res.writeHead(302, { location: `/loop${hops}` }); return res.end(); }
    if (req.url === "/big") { res.writeHead(200); res.write("x".repeat(600 * 1024)); res.write("y".repeat(600 * 1024)); return res.end("artfinity-verify-LATE"); }
    if (req.url === "/slow") { setTimeout(() => { try { res.end("late"); } catch {} }, 3000); return; }
    if (req.url === "/ua") { res.writeHead(200); return res.end(String(req.headers["user-agent"])); }
    res.writeHead(404); res.end("nope");
  });
  try {
    const refused = await F.safeFetchText(`${s.url}/page`);
    assert.equal(refused.ok, false);
    assert.equal(refused.code, "blocked");

    const ok = await F.safeFetchText(`${s.url}/page`, { allowLocal: true });
    assert.equal(ok.ok, true);
    assert.match(ok.body, /artfinity-verify-ABCD2345/);

    assert.equal((await F.safeFetchText(`${s.url}/to-page`, { allowLocal: true })).ok, true);
    const meta = await F.safeFetchText(`${s.url}/to-metadata`, { allowLocal: true });
    assert.deepEqual([meta.ok, meta.code], [false, "blocked"]);
    const priv = await F.safeFetchText(`${s.url}/to-private`, { allowLocal: true });
    assert.deepEqual([priv.ok, priv.code], [false, "blocked"]);
    const loop = await F.safeFetchText(`${s.url}/loop`, { allowLocal: true });
    assert.deepEqual([loop.ok, loop.code], [false, "too_many_redirects"]);
    assert.equal(hops, 4); // the first request plus 3 redirects, then it stops

    const big = await F.safeFetchText(`${s.url}/big`, { allowLocal: true });
    assert.equal(big.ok, true);
    assert.equal(big.truncated, true);
    assert.equal(Buffer.byteLength(big.body), F.FETCH_MAX_BYTES);
    assert.doesNotMatch(big.body, /LATE/);

    const t0 = Date.now();
    const slow = await F.safeFetchText(`${s.url}/slow`, { allowLocal: true, timeoutMs: 300 });
    assert.deepEqual([slow.ok, slow.code], [false, "timeout"]);
    assert.ok(Date.now() - t0 < 1500);

    const nf = await F.safeFetchText(`${s.url}/missing`, { allowLocal: true });
    assert.deepEqual([nf.ok, nf.code], [false, "http"]);

    const ua = await F.safeFetchText(`${s.url}/ua`, { allowLocal: true });
    assert.equal(ua.body, F.FETCH_USER_AGENT);
    assert.doesNotMatch(ua.body, /@|http/);
  } finally {
    await s.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Instagram proof (called from the sign-in, connect and sign-up routes: must never break them)

test("instagram proof: never throws or rejects, even when the database does", async () => {
  const boom = { adminAction: { findFirst: async () => { throw new Error("db down"); }, create: async () => { throw new Error("db down"); } } };
  const syncBoom = { adminAction: { findFirst: () => { throw new Error("sync"); }, create: () => { throw new Error("sync"); } } };
  const quiet = console.error;
  console.error = () => {};
  try {
    await assert.doesNotReject(I.recordInstagramProofWith(boom, "artist1", "ig123", "maya"));
    await assert.doesNotReject(I.recordInstagramProofWith(syncBoom, "artist1", "ig123", "maya"));
    await assert.doesNotReject(I.recordInstagramProofWith(boom, "artist1", "ig123", 42));
    await assert.doesNotReject(I.recordInstagramProofWith(null, "artist1", "ig123", "maya"));
    assert.equal(await I.recordInstagramProofWith(boom, "artist1", "ig123", "maya"), undefined);
  } finally {
    console.error = quiet;
  }
});

test("instagram proof: records the username once, skips bad input", async () => {
  const made = [];
  let last = null;
  const db = { adminAction: { findFirst: async () => last, create: async (a) => { made.push(a.data); last = { details: a.data.details }; } } };
  await I.recordInstagramProofWith(db, "artist1", "ig123", "Maya.Paints");
  await I.recordInstagramProofWith(db, "artist1", "ig123", "maya.paints"); // same: no second row
  await I.recordInstagramProofWith(db, "artist1", "ig123", "bad handle!");
  await I.recordInstagramProofWith(db, "", "ig123", "maya");
  assert.equal(made.length, 1);
  assert.deepEqual(made[0].details, { username: "maya.paints", providerAccountId: "ig123" });
  assert.equal(made[0].action, I.IG_PROOF_ACTION);
});
