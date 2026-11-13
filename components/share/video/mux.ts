// Tiny, dependency-free muxers for WebCodecs output: one video track, constant frame rate.
// MP4 (H.264, moov first so it streams) and WebM (VP8/VP9).

export type Chunk = { data: Uint8Array; key: boolean };

// ---------------- byte helpers ----------------
class Bytes {
  parts: Uint8Array[] = [];
  size = 0;
  push(u: Uint8Array) { this.parts.push(u); this.size += u.length; return this; }
  u8(v: number) { return this.push(Uint8Array.of(v & 255)); }
  u16(v: number) { return this.push(Uint8Array.of((v >> 8) & 255, v & 255)); }
  u32(v: number) { return this.push(Uint8Array.of((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255)); }
  str(s: string) { return this.push(new TextEncoder().encode(s)); }
  zeros(n: number) { return this.push(new Uint8Array(n)); }
  join() { const out = new Uint8Array(this.size); let o = 0; for (const p of this.parts) { out.set(p, o); o += p.length; } return out; }
}

// ---------------- MP4 ----------------
function box(type: string, ...body: Uint8Array[]) {
  const len = 8 + body.reduce((a, b) => a + b.length, 0);
  const b = new Bytes().u32(len).str(type);
  body.forEach((x) => b.push(x));
  return b.join();
}
const full = (type: string, version: number, flags: number, body: Bytes) =>
  box(type, new Bytes().u8(version).u8(flags >> 16).u8(flags >> 8).u8(flags).join(), body.join());
const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];

export function muxMP4(chunks: Chunk[], avcC: Uint8Array, width: number, height: number, fps: number): Blob {
  const n = chunks.length;
  const timescale = fps * 1000, delta = 1000; // media time units
  const durMs = Math.round((n / fps) * 1000);

  const ftyp = box("ftyp", new Bytes().str("isom").u32(512).str("isom").str("iso2").str("avc1").str("mp41").join());

  const moov = (mdatDataOffset: number) => {
    const mvhd = new Bytes().u32(0).u32(0).u32(1000).u32(durMs).u32(0x00010000).u16(0x0100).zeros(10);
    MATRIX.forEach((m) => mvhd.u32(m));
    mvhd.zeros(24).u32(2);

    const tkhd = new Bytes().u32(0).u32(0).u32(1).u32(0).u32(durMs).zeros(8).u16(0).u16(0).u16(0).u16(0);
    MATRIX.forEach((m) => tkhd.u32(m));
    tkhd.u32(width << 16).u32(height << 16);

    const mdhd = new Bytes().u32(0).u32(0).u32(timescale).u32(n * delta).u16(0x55c4).u16(0);
    const hdlr = new Bytes().u32(0).str("vide").zeros(12).str("VideoHandler").u8(0);
    const vmhd = new Bytes().u16(0).u16(0).u16(0).u16(0);
    const dref = new Bytes().u32(1).push(full("url ", 0, 1, new Bytes()));
    const dinf = box("dinf", full("dref", 0, 0, dref));

    const name = new Uint8Array(32);
    const avc1 = new Bytes().zeros(6).u16(1).zeros(16).u16(width).u16(height).u32(0x00480000).u32(0x00480000).u32(0).u16(1).push(name).u16(0x0018).u16(0xffff)
      .push(box("avcC", avcC));
    const stsd = new Bytes().u32(1).push(box("avc1", avc1.join()));
    const stts = new Bytes().u32(1).u32(n).u32(delta);
    const keys = chunks.map((c, i) => (c.key ? i + 1 : 0)).filter(Boolean);
    const stss = new Bytes().u32(keys.length); keys.forEach((k) => stss.u32(k));
    const stsc = new Bytes().u32(1).u32(1).u32(n).u32(1);
    const stsz = new Bytes().u32(0).u32(n); chunks.forEach((c) => stsz.u32(c.data.length));
    const stco = new Bytes().u32(1).u32(mdatDataOffset);
    const stbl = box("stbl", full("stsd", 0, 0, stsd), full("stts", 0, 0, stts), full("stss", 0, 0, stss), full("stsc", 0, 0, stsc), full("stsz", 0, 0, stsz), full("stco", 0, 0, stco));
    const minf = box("minf", full("vmhd", 0, 1, vmhd), dinf, stbl);
    const mdia = box("mdia", full("mdhd", 0, 0, mdhd), full("hdlr", 0, 0, hdlr), minf);
    const trak = box("trak", full("tkhd", 0, 3, tkhd), mdia);
    return box("moov", full("mvhd", 0, 0, mvhd), trak);
  };

  const moovSize = moov(0).length; // offsets are fixed width, so the size doesn't depend on them
  const dataLen = chunks.reduce((a, c) => a + c.data.length, 0);
  const mdatHead = new Bytes().u32(8 + dataLen).str("mdat").join();
  const parts: BlobPart[] = [ftyp, moov(ftyp.length + moovSize + 8), mdatHead, ...chunks.map((c) => c.data as BlobPart)];
  return new Blob(parts, { type: "video/mp4" });
}

// ---------------- WebM (EBML) ----------------
function idBytes(id: number) {
  const out: number[] = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v & 255);
  return Uint8Array.from(out);
}
function sizeBytes(n: number) {
  // 8-byte length: 0x01 then 7 bytes
  const b = new Uint8Array(8);
  b[0] = 0x01;
  for (let i = 7, v = n; i >= 1; i--, v = Math.floor(v / 256)) b[i] = v & 255;
  return b;
}
function el(id: number, ...body: Uint8Array[]) {
  const len = body.reduce((a, b) => a + b.length, 0);
  const b = new Bytes().push(idBytes(id)).push(sizeBytes(len));
  body.forEach((x) => b.push(x));
  return b.join();
}
function uint(id: number, v: number) {
  const out: number[] = [];
  do { out.unshift(v & 255); v = Math.floor(v / 256); } while (v > 0);
  return el(id, Uint8Array.from(out));
}
const str = (id: number, s: string) => el(id, new TextEncoder().encode(s));
function f64(id: number, v: number) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, v);
  return el(id, b);
}

export function muxWebM(chunks: Chunk[], codecId: "V_VP8" | "V_VP9", width: number, height: number, fps: number): Blob {
  const header = el(0x1a45dfa3, uint(0x4286, 1), uint(0x42f7, 1), uint(0x42f2, 4), uint(0x42f3, 8), str(0x4282, "webm"), uint(0x4287, 4), uint(0x4285, 2));
  const frameMs = 1000 / fps;
  const info = el(0x1549a966, uint(0x2ad7b1, 1_000_000), str(0x4d80, "artfinity"), str(0x5741, "artfinity"), f64(0x4489, chunks.length * frameMs));
  const tracks = el(0x1654ae6b, el(0xae, uint(0xd7, 1), uint(0x73c5, 1), uint(0x83, 1), uint(0x9c, 0), str(0x86, codecId), el(0xe0, uint(0xb0, width), uint(0xba, height))));

  const clusters: Uint8Array[] = [];
  let i = 0;
  while (i < chunks.length) {
    const startMs = Math.round(i * frameMs);
    const blocks: Uint8Array[] = [uint(0xe7, startMs)];
    let j = i;
    // A new cluster starts at each keyframe (or after ~5 s, well inside the 16-bit block timecode).
    while (j < chunks.length && (j === i || (!chunks[j].key && j - i < fps * 5))) {
      const rel = Math.round(j * frameMs) - startMs;
      const head = Uint8Array.of(0x81, (rel >> 8) & 255, rel & 255, chunks[j].key ? 0x80 : 0x00);
      blocks.push(el(0xa3, head, chunks[j].data));
      j++;
    }
    clusters.push(el(0x1f43b675, ...blocks));
    i = j;
  }
  const segment = el(0x18538067, info, tracks, ...clusters);
  return new Blob([header as BlobPart, segment as BlobPart], { type: "video/webm" });
}
