// Unit checks for the import allowlists (POST /api/uploads/import). No test runner needed:
//   node --test lib/cloudImport/sources.test.mjs   (Node 22.18+ strips the TypeScript types itself;
//                                                 on older Node add --experimental-strip-types)
import { test } from "node:test";
import assert from "node:assert/strict";

// Computed path keeps TypeScript/Next from trying to resolve a ".ts" import in this plain-JS file.
const { driveDownloadUrl, isDriveMediaUrl, dropboxUrl, isPrivateAddress, mockImportAllowed, mockUrl, importedType, isImportType } =
  await import(new URL("./sources" + ".ts", import.meta.url).href);

test("Drive: only builds googleapis media URLs from real file ids", () => {
  const id = "1AbC-dEf_GhIjKlMnOpQrStUv";
  assert.equal(driveDownloadUrl(id), `https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  for (const bad of ["", "short", "../../etc/passwd", "abc/def/ghijklmnop", "id?alt=media&x=1", "id#frag12345", "http://evil.com/aaaa", "a b c d e f g h", null, 42, {}]) {
    assert.equal(driveDownloadUrl(bad), null, `should refuse ${JSON.stringify(bad)}`);
  }
  assert.ok(new URL(driveDownloadUrl(id)).hostname === "www.googleapis.com");
});

test("Drive: redirect hops must stay on the exact media URL", () => {
  const ok = new URL(driveDownloadUrl("1AbC-dEf_GhIjKlMnOpQrStUv"));
  assert.equal(isDriveMediaUrl(ok), true);
  for (const bad of [
    "http://www.googleapis.com/drive/v3/files/1AbC-dEf_GhIjKlMnOpQrStUv?alt=media",
    "https://www.googleapis.com:8443/drive/v3/files/1AbC-dEf_GhIjKlMnOpQrStUv?alt=media",
    "https://googleapis.com/drive/v3/files/1AbC-dEf_GhIjKlMnOpQrStUv?alt=media",
    "https://www.googleapis.com.evil.com/drive/v3/files/1AbC-dEf_GhIjKlMnOpQrStUv?alt=media",
    "https://www.googleapis.com/drive/v3/files/1AbC-dEf_GhIjKlMnOpQrStUv",
    "https://www.googleapis.com/drive/v3/files/1AbC-dEf_GhIjKlMnOpQrStUv/permissions?alt=media",
    "https://www.googleapis.com/upload/drive/v3/files/1AbC-dEf_GhIjKlMnOpQrStUv?alt=media",
    "https://user:pw@www.googleapis.com/drive/v3/files/1AbC-dEf_GhIjKlMnOpQrStUv?alt=media",
    "https://doc-0s-1c-docs.googleusercontent.com/docs/securesc/abc",
  ]) assert.equal(isDriveMediaUrl(new URL(bad)), false, bad);
});

test("Dropbox: accepts Chooser direct links only", () => {
  for (const good of [
    "https://dl.dropboxusercontent.com/1/view/abc123/Paintings/river.jpg",
    "https://uc4a1b2c3d.dl.dropboxusercontent.com/cd/0/get/xyz/file",
    "https://dl.dropbox.com/s/abc/river.jpg",
    "https://DL.DropboxUserContent.com/1/view/abc/x.png",
  ]) assert.ok(dropboxUrl(good), good);
});

test("Dropbox: rejects other hosts, private IPs and tricks", () => {
  for (const bad of [
    "http://dl.dropboxusercontent.com/1/view/abc/x.jpg",
    "https://dl.dropboxusercontent.com:8443/1/view/abc/x.jpg",
    "https://user:pass@dl.dropboxusercontent.com/1/view/abc/x.jpg",
    "https://dl.dropboxusercontent.com.evil.com/x.jpg",
    "https://evil.com/dl.dropboxusercontent.com/x.jpg",
    "https://evil.com/?u=https://dl.dropboxusercontent.com/x.jpg",
    "https://evildl.dropboxusercontent.com/x.jpg",
    "https://a.b.dl.dropboxusercontent.com/x.jpg",
    "https://www.dropbox.com/s/abc/x.jpg?dl=1",
    "https://dropboxusercontent.com/x.jpg",
    "https://127.0.0.1/x.jpg",
    "https://localhost/x.jpg",
    "https://10.0.0.5/x.jpg",
    "https://192.168.1.1/x.jpg",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::1]/x.jpg",
    "https://[fd00::1]/x.jpg",
    "https://2130706433/x.jpg",
    "file:///etc/passwd",
    "ftp://dl.dropboxusercontent.com/x.jpg",
    "javascript:alert(1)",
    "not a url",
    "",
    null,
    123,
  ]) assert.equal(dropboxUrl(bad), null, `should refuse ${JSON.stringify(bad)}`);
});

test("private address check (used on every resolved host)", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "192.0.0.8", "198.18.0.1", "::1", "::", "fd12::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "[::1]", "999.1.1.1", "localhost"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["162.125.4.15", "8.8.8.8", "142.250.80.10", "172.32.0.1", "100.128.0.1", "2620:100:6020:15::a27d:450f", "2a00:1450:4001:82a::200a", "::ffff:8.8.8.8"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("mock source: dev only, opt-in, localhost only", () => {
  assert.equal(mockImportAllowed({ NODE_ENV: "production", ALLOW_MOCK_IMPORT: "1" }), false);
  assert.equal(mockImportAllowed({ NODE_ENV: "development" }), false);
  assert.equal(mockImportAllowed({ NODE_ENV: "development", ALLOW_MOCK_IMPORT: "true" }), false);
  assert.equal(mockImportAllowed({ NODE_ENV: "development", ALLOW_MOCK_IMPORT: "1" }), true);
  assert.equal(mockImportAllowed({ NODE_ENV: "test", ALLOW_MOCK_IMPORT: "1" }), true);
  assert.ok(mockUrl("http://localhost:3000/seed/art-01.jpg"));
  assert.ok(mockUrl("http://127.0.0.1:3000/seed/art-01.jpg"));
  for (const bad of ["http://169.254.169.254/", "https://example.com/x.jpg", "http://localhost.evil.com/x.jpg", "file:///etc/passwd", "http://u:p@localhost/x.jpg"]) {
    assert.equal(mockUrl(bad), null, bad);
  }
});

test("imported type: image content types, else the picker's type or the extension", () => {
  assert.equal(importedType("image/jpeg", "a.bin"), "image/jpeg");
  assert.equal(importedType("image/png; charset=binary", "a"), "image/png");
  assert.equal(importedType("application/octet-stream", "river.HEIC"), "image/heic");
  assert.equal(importedType(null, "x", "image/webp"), "image/webp");
  assert.equal(importedType("text/html", "river.jpg"), null);
  assert.equal(importedType("application/pdf", "river.jpg", "image/jpeg"), null);
  assert.equal(importedType("application/octet-stream", "notes.txt"), null);
});

test("import types: only what the pipeline prints (JPG, PNG, WEBP, TIFF, HEIC)", () => {
  for (const t of ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/heic", "image/heif"]) assert.equal(isImportType(t), true, t);
  for (const t of ["image/gif", "image/avif", "image/svg+xml", "image/bmp", "application/pdf", "text/html", ""]) assert.equal(isImportType(t), false, t);
  assert.equal(importedType("image/jpg", "x"), "image/jpeg");
  assert.equal(importedType(null, "x", "image/pjpeg"), "image/jpeg");
  assert.equal(importedType("application/octet-stream", "scan.TIF"), "image/tiff");
});
