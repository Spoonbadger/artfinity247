// node --experimental-strip-types --test lib/directUpload.test.mjs
// Direct-to-Cloudinary uploads (POST /api/uploads/sign + /finish): the signed parameters, the finish ticket and the
// folder check that stops anyone claiming another artist's or order's upload.
import test from "node:test";
import assert from "node:assert/strict";
import { v2 as cloudinary } from "cloudinary";
import { directFormat, directUploadParams, newPublicId, ownsPublicId, readTicket, TICKET_MAX_AGE_S, uploadTicket } from "./directUpload.ts";
import { cloudinaryErrorText, UPLOAD_ERRORS } from "./uploadLimits.ts";

const SECRET = "test-secret";
const ANA = "artfinity/artists/ana/artworks";
const now = 1_760_000_000;

test("public ids sit directly in the given folder", () => {
  const id = newPublicId(ANA);
  assert.match(id, /^artfinity\/artists\/ana\/artworks\/[a-f0-9]{12}$/);
  assert.notEqual(newPublicId(ANA), id);
});

test("signed parameters pin the folder, keep the file private, block overwrites and carry the time", () => {
  const p = directUploadParams(`${ANA}/abcdef012345`, now);
  assert.equal(p.public_id, `${ANA}/abcdef012345`);
  assert.equal(p.type, "authenticated");
  assert.equal(p.overwrite, "false");
  assert.equal(p.timestamp, String(now));
  assert.ok(p.allowed_formats.split(",").includes("heic"));
  assert.ok(!p.allowed_formats.split(",").includes("svg"));
  // Cloudinary signs every one of these: changing any (another folder, public delivery) breaks the signature.
  const sig = cloudinary.utils.api_sign_request(p, "cloud-secret");
  assert.match(sig, /^[a-f0-9]{40}$/);
  for (const change of [{ public_id: "artfinity/artists/bo/artworks/abcdef012345" }, { type: "upload" }, { overwrite: "true" }, { timestamp: String(now + 1) }]) {
    assert.notEqual(cloudinary.utils.api_sign_request({ ...p, ...change }, "cloud-secret"), sig);
  }
});

test("ownership: only this folder, one level, our name shape", () => {
  assert.ok(ownsPublicId(`${ANA}/abcdef012345`, ANA));
  assert.ok(!ownsPublicId("artfinity/artists/bo/artworks/abcdef012345", ANA));
  assert.ok(!ownsPublicId("artfinity/artists/ana/artworks-old/abcdef012345", ANA));
  assert.ok(!ownsPublicId("artfinity/artists/an/artworks/abcdef012345", "artfinity/artists/an"));
  assert.ok(!ownsPublicId(`${ANA}/../../bo/artworks/abcdef012345`, ANA));
  assert.ok(!ownsPublicId(`${ANA}/sub/abcdef012345`, ANA));
  assert.ok(!ownsPublicId(`${ANA}/ABCDEF012345`, ANA));
  assert.ok(!ownsPublicId(`${ANA}/abcdef012345.jpg`, ANA));
  assert.ok(!ownsPublicId(undefined, ANA));
  assert.ok(!ownsPublicId(`${ANA}/abcdef012345`, ""));
  // a buyer's review photo folder is per order
  assert.ok(ownsPublicId("artfinity/reviews/ord1/0123456789ab", "artfinity/reviews/ord1"));
  assert.ok(!ownsPublicId("artfinity/reviews/ord2/0123456789ab", "artfinity/reviews/ord1"));
});

test("tickets: ours, for this public id, keep flag can't be flipped, and they expire", () => {
  const id = `${ANA}/abcdef012345`;
  const t = uploadTicket(SECRET, id, true, now);
  assert.deepEqual(readTicket(SECRET, id, t, now + 5), { keep: true });
  assert.deepEqual(readTicket(SECRET, id, uploadTicket(SECRET, id, false, now), now), { keep: false });
  // another upload, another secret, a flipped keep flag, a forged time
  assert.equal(readTicket(SECRET, `${ANA}/abcdef012346`, t, now), null);
  assert.equal(readTicket("other", id, t, now), null);
  assert.equal(readTicket(SECRET, id, t.replace(".1.", ".0."), now), null);
  assert.equal(readTicket(SECRET, id, t.replace(String(now), String(now + 100)), now + 100), null);
  // too old, from the future, junk, no secret
  assert.equal(readTicket(SECRET, id, t, now + TICKET_MAX_AGE_S + 1), null);
  assert.equal(readTicket(SECRET, id, uploadTicket(SECRET, id, true, now + 3600), now), null);
  assert.equal(readTicket(SECRET, id, "nope", now), null);
  assert.equal(readTicket(SECRET, id, 42, now), null);
  assert.equal(readTicket("", id, t, now), null);
  assert.throws(() => uploadTicket("", id, true, now));
});

test("formats Cloudinary reports", () => {
  assert.equal(directFormat("JPG"), "jpg");
  assert.equal(directFormat("heic"), "heic");
  assert.equal(directFormat("svg"), null);
  assert.equal(directFormat("pdf"), null);
  assert.equal(directFormat("../x"), null);
  assert.equal(directFormat(undefined), null);
});

test("Cloudinary's errors in plain words", () => {
  assert.deepEqual(cloudinaryErrorText("File size too large. Got 26214400. Maximum is 10485760."), { error: "That file is over 10 MB.", code: "file_too_big" });
  assert.equal(cloudinaryErrorText("File size too large.").error, UPLOAD_ERRORS.tooBig);
  assert.equal(cloudinaryErrorText("Image is too large: 108.0 Megapixels. Max allowed: 25 Megapixels").error, "That image has too many pixels. Save a smaller copy under 25 megapixels and try again.");
  assert.match(cloudinaryErrorText("Resource has 108000000 pixels. Maximum allowed is 50000000 pixels").error, /under 50 megapixels/);
  assert.equal(cloudinaryErrorText("Image file format pdf not allowed").error, UPLOAD_ERRORS.notImage);
  assert.equal(cloudinaryErrorText("Invalid image file").error, UPLOAD_ERRORS.unreadable);
  assert.equal(cloudinaryErrorText("Stale request - reported time is 2026-11-09 10:00:00 +0000 which is more than 1 hour ago").code, "upload_expired");
  assert.equal(cloudinaryErrorText(undefined).code, "upload_failed");
});
