"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apply, cssMatrix3d, frameBox, orderQuad, ppiAt, rgbToHex, solveWall, usableSizes, type P } from "@/lib/scenes/geometry";
import {
  FLAG_TAGS,
  FRAME_KEYS,
  PRINT_SIZE_KEYS,
  REF2_KINDS,
  REF_KINDS,
  ROOM_TAGS,
  ROOM_TAG_LABEL,
  creditLine,
  type FrameKey,
  type PhotoCredit,
  type PrintSizeKey,
  type Ref2Kind,
  type RefKind,
  type SceneAnnotation,
} from "@/lib/scenes/types";
import { cn } from "@/lib/utils";
import MoreMenu from "./MoreMenu";

type Photo = { id: string; w: number; h: number; source: "photo" | "fixture"; credit: PhotoCredit | null };
type Art = { slug: string; title: string; imageUrl: string };
type Mode = "quad" | "anchor" | "alt" | "ref" | "ref2" | null;
type Line = { a: P | null; b: P | null };
type Draft = {
  quad: P[];
  anchors: P[];
  ref: Line & { kind: RefKind; inches: number };
  ref2: Line & { kind: Ref2Kind; inches: number };
  lens: number | null;
  tint: string;
  tintAuto: boolean;
  shadow: { angle: number; strength: number };
  exposure: number;
  softness: number;
  tags: string[];
  status: "ok" | "rejected";
};

const SIZE_IN: Record<PrintSizeKey, string> = { small: "5×7", medium: "8×12", large: "11×17", xl: "18×24" };
const FRAME_CSS: Record<Exclude<FrameKey, "none">, string> = { black: "#1b1c20", white: "#f4f3ef", natural: "#b98a58" };

function guessTags(c: PhotoCredit | null): string[] {
  const q = `${c?.query || ""} ${c?.alt || ""}`.toLowerCase();
  const t: string[] = [];
  if (/caf|coffee|restaurant|bar\b/.test(q)) t.push("cafe");
  else if (/gallery|museum/.test(q)) t.push("gallery");
  else if (/bedroom/.test(q)) t.push("bedroom");
  else if (/office|desk|studio/.test(q)) t.push("office");
  else if (/kitchen|dining/.test(q)) t.push("kitchen");
  else if (/living|apartment|loft|sofa|home|brooklyn|hallway/.test(q)) t.push("living");
  if (/person|people|visitor|woman|man\b/.test(q)) t.push("person");
  const fixtureTags = (c as { tags?: string[] } | null)?.tags;
  return Array.from(new Set([...t, ...(Array.isArray(fixtureTags) ? fixtureTags : [])]));
}

function toDraft(a: SceneAnnotation | undefined, p: Photo): Draft {
  if (!a)
    return {
      quad: [],
      anchors: [],
      ref: { a: null, b: null, kind: "adult", inches: 66 },
      ref2: { a: null, b: null, kind: "doorw", inches: 32 },
      lens: null,
      tint: "#e9e6e0",
      tintAuto: true,
      shadow: { angle: 70, strength: 0.5 },
      exposure: 1,
      softness: 0.4,
      tags: guessTags(p.credit),
      status: "ok",
    };
  return {
    quad: a.quad?.slice() ?? [],
    anchors: a.anchors?.slice() ?? [],
    ref: { a: a.ref?.a ?? null, b: a.ref?.b ?? null, kind: a.ref?.kind ?? "adult", inches: a.ref?.inches ?? 66 },
    ref2: { a: a.ref2?.a ?? null, b: a.ref2?.b ?? null, kind: a.ref2?.kind ?? "doorw", inches: a.ref2?.inches ?? 32 },
    lens: a.lens ?? null,
    tint: a.tint || "#e9e6e0",
    tintAuto: false,
    shadow: a.shadow ?? { angle: 70, strength: 0.5 },
    exposure: a.exposure ?? 1,
    softness: a.softness ?? 0.4,
    tags: a.tags ?? [],
    status: a.status === "rejected" ? "rejected" : "ok",
  };
}

function toAnnotation(id: string, p: Photo, d: Draft): SceneAnnotation {
  return {
    id,
    version: 1,
    image: { w: p.w, h: p.h },
    status: d.status,
    quad: (d.quad.length === 4 ? orderQuad(d.quad) : d.quad) as SceneAnnotation["quad"],
    anchors: d.anchors,
    ref: { a: d.ref.a ?? [0, 0], b: d.ref.b ?? [0, 0], kind: d.ref.kind, inches: d.ref.inches },
    ref2: d.ref2.a && d.ref2.b && d.ref2.inches > 0 ? { a: d.ref2.a, b: d.ref2.b, kind: d.ref2.kind, inches: d.ref2.inches } : null,
    lens: d.lens,
    tint: d.tint,
    shadow: d.shadow,
    tags: d.tags,
    exposure: d.exposure,
    softness: d.softness,
  };
}

/** Average wall color inside the quad (trimmed mean, ignoring the darkest/brightest 15%). */
function sampleTint(img: HTMLImageElement, quad: P[], w: number): string | null {
  try {
    const W = 360, H = Math.round((img.naturalHeight / img.naturalWidth) * W);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, W, H);
    const s = W / w;
    const q = quad.map((p) => [p[0] * s, p[1] * s] as P);
    const data = ctx.getImageData(0, 0, W, H).data;
    const px: [number, number, number, number][] = [];
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(H, Math.ceil(Math.max(...ys))); y += 2)
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(W, Math.ceil(Math.max(...xs))); x += 2) {
        if (!inQuad([x, y], q)) continue;
        const o = (y * W + x) * 4;
        px.push([data[o], data[o + 1], data[o + 2], 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]]);
      }
    if (!px.length) return null;
    px.sort((a, b) => a[3] - b[3]);
    const lo = Math.floor(px.length * 0.15), hi = Math.max(lo + 1, Math.ceil(px.length * 0.85));
    const keep = px.slice(lo, hi);
    const m = [0, 1, 2].map((k) => keep.reduce((t, p) => t + p[k], 0) / keep.length);
    return rgbToHex(m[0], m[1], m[2]);
  } catch {
    return null;
  }
}
function inQuad(p: P, q: P[]) {
  let inside = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if (q[i][1] > p[1] !== q[j][1] > p[1] && p[0] < ((q[j][0] - q[i][0]) * (p[1] - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) inside = !inside;
  }
  return inside;
}

function useAspect(url: string | null) {
  const [aspect, setAspect] = useState(0.8);
  useEffect(() => {
    if (!url) return setAspect(0.8);
    const i = new Image();
    i.onload = () => i.naturalHeight && setAspect(i.naturalWidth / i.naturalHeight);
    i.src = url;
  }, [url]);
  return aspect;
}

export default function SceneAnnotator({ photos, annotations, arts, writable }: { photos: Photo[]; annotations: Record<string, SceneAnnotation>; arts: Art[]; writable: boolean }) {
  const [anns, setAnns] = useState(annotations);
  const [showFixtures, setShowFixtures] = useState(true);
  const [todoOnly, setTodoOnly] = useState(false);
  const list = useMemo(
    () => photos.filter((p) => (showFixtures || p.source !== "fixture") && (!todoOnly || !anns[p.id])),
    [photos, showFixtures, todoOnly, anns],
  );
  const [cur, setCur] = useState(() => Math.max(0, photos.findIndex((p) => !annotations[p.id])));
  const photo = list[Math.min(cur, list.length - 1)] as Photo | undefined;
  const [draft, setDraft] = useState<Draft | null>(photo ? toDraft(annotations[photo.id], photo) : null);
  const [mode, setMode] = useState<Mode>(null);
  const [size, setSize] = useState<PrintSizeKey>("large");
  const [frame, setFrame] = useState<FrameKey>("black");
  const [mat, setMat] = useState(true);
  const [artSlug, setArtSlug] = useState<string>("");
  const [anchorIdx, setAnchorIdx] = useState(0);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; msg?: string }>({ kind: "idle" });
  const [render, setRender] = useState<{ url: string; info: string } | null>(null);
  const [buildMsg, setBuildMsg] = useState<string>("");
  const [dispW, setDispW] = useState(0);
  const [drag, setDrag] = useState<{ kind: "quad" | "anchor" | "ref" | "ref2"; i: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const loadedId = useRef<string | null>(null);

  // load the draft when the photo changes
  useEffect(() => {
    if (!photo || loadedId.current === photo.id) return;
    loadedId.current = photo.id;
    const d = toDraft(anns[photo.id], photo);
    setDraft(d);
    setAnchorIdx(0);
    setRender(null);
    setStatus({ kind: "idle" });
    setMode(d.quad.length === 4 ? null : "quad");
  }, [photo, anns]);

  // display width of the photo, for the CSS preview
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDispW(el.clientWidth));
    ro.observe(el);
    setDispW(el.clientWidth);
    return () => ro.disconnect();
  }, [photo?.id]);

  const art = arts.find((a) => a.slug === artSlug) ?? null;
  const artAspect = useAspect(art?.imageUrl ?? null);

  const ann = photo && draft ? toAnnotation(photo.id, photo, draft) : null;
  const solve = useMemo(() => (ann && draft && draft.quad.length === 4 && draft.ref.a && draft.ref.b && draft.ref.inches > 0 ? solveWall(ann) : null), [ann, draft]);
  const anchor = draft?.anchors[Math.min(anchorIdx, (draft?.anchors.length || 1) - 1)] ?? null;
  const ppi = solve && anchor ? ppiAt(solve, anchor) : null;
  const usable = solve && draft?.anchors[0] ? usableSizes(solve, draft.anchors[0]) : [];
  const done = !!(solve && draft?.anchors.length);

  // live CSS preview of the framed print, warped with the wall homography
  const preview = useMemo(() => {
    if (!solve || !anchor || !photo || !dispW) return null;
    const box = frameBox(size, art ? artAspect : 0.8, frame, mat);
    const c = apply(solve.Ginv, anchor);
    const corners: P[] = [[c[0] - box.W / 2, c[1] - box.H / 2], [c[0] + box.W / 2, c[1] - box.H / 2], [c[0] + box.W / 2, c[1] + box.H / 2], [c[0] - box.W / 2, c[1] + box.H / 2]];
    const k = dispW / photo.w;
    const disp = corners.map((p) => apply(solve.G, p)).map((p) => [p[0] * k, p[1] * k] as P);
    const U = 10; // css px per inch inside the element
    let transform = "";
    try {
      transform = cssMatrix3d(box.W * U, box.H * U, disp);
    } catch {
      return null;
    }
    return { box, U, transform };
  }, [solve, anchor, photo, dispW, size, frame, mat, art, artAspect]);

  const set = useCallback((f: (d: Draft) => Draft) => setDraft((d) => (d ? f(d) : d)), []);

  const toImg = (e: { clientX: number; clientY: number }): P | null => {
    const svg = svgRef.current;
    if (!svg || !photo) return null;
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * photo.w, ((e.clientY - r.top) / r.height) * photo.h];
  };

  function onClick(e: React.MouseEvent) {
    if (drag || !mode || !draft || !photo) return;
    const p = toImg(e);
    if (!p) return;
    if (mode === "quad") {
      const quad = [...(draft.quad.length >= 4 ? [] : draft.quad), p];
      let next: Draft = { ...draft, quad };
      if (quad.length === 4) {
        next = { ...next, quad: orderQuad(quad) };
        if (next.tintAuto && imgRef.current) {
          const t = sampleTint(imgRef.current, next.quad, photo.w);
          if (t) next.tint = t;
        }
        setMode(draft.anchors.length ? (draft.ref.b ? null : "ref") : "anchor");
      }
      setDraft(next);
    } else if (mode === "anchor") {
      setDraft({ ...draft, anchors: [p, ...draft.anchors.slice(1)] });
      setAnchorIdx(0);
      setMode(draft.ref.b ? null : "ref");
    } else if (mode === "alt") {
      if (!draft.anchors.length) return setDraft({ ...draft, anchors: [p] });
      const anchors = [...draft.anchors.slice(0, 1), ...draft.anchors.slice(1).slice(-1), p].slice(0, 3);
      setDraft({ ...draft, anchors });
      setAnchorIdx(anchors.length - 1);
      if (anchors.length >= 3) setMode(null);
    } else if (mode === "ref" || mode === "ref2") {
      const line = draft[mode];
      const nl = !line.a || line.b ? { ...line, a: p, b: null } : { ...line, b: p };
      // keep a at the bottom (the floor end) for the main reference
      if (mode === "ref" && nl.a && nl.b && nl.a[1] < nl.b[1]) [nl.a, nl.b] = [nl.b, nl.a];
      setDraft({ ...draft, [mode]: nl });
      if (nl.b) setMode(null);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || !draft) return;
    const p = toImg(e);
    if (!p) return;
    if (drag.kind === "quad") set((d) => ({ ...d, quad: d.quad.map((q, i) => (i === drag.i ? p : q)) }));
    else if (drag.kind === "anchor") set((d) => ({ ...d, anchors: d.anchors.map((q, i) => (i === drag.i ? p : q)) }));
    else set((d) => ({ ...d, [drag.kind]: { ...d[drag.kind as "ref"], [drag.i ? "b" : "a"]: p } }));
  }
  function endDrag() {
    if (drag?.kind === "quad" && draft && photo && draft.tintAuto && imgRef.current && draft.quad.length === 4) {
      const t = sampleTint(imgRef.current, draft.quad, photo.w);
      if (t) set((d) => ({ ...d, tint: t }));
    }
    if (drag) setTimeout(() => setDrag(null), 0);
  }

  const save = useCallback(
    async (advance: boolean, override?: Partial<Draft>) => {
      if (!photo || !draft) return;
      const d = { ...draft, ...override };
      const a = toAnnotation(photo.id, photo, d);
      setStatus({ kind: "busy", msg: "Saving…" });
      try {
        const res = await fetch("/api/admin/scenes/annotation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ annotation: a }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't save.");
        const nextAnns = { ...anns, [photo.id]: data.annotation as SceneAnnotation };
        setAnns(nextAnns);
        setStatus({ kind: "ok", msg: d.status === "rejected" ? "Marked unusable." : `Saved. ${data.annotation.computed ? `${data.annotation.computed.ppi} px/in at the anchor.` : ""}` });
        if (advance) {
          const i = list.findIndex((p, k) => k > cur && !nextAnns[p.id]);
          const j = i >= 0 ? i : list.findIndex((p) => !nextAnns[p.id]);
          if (j >= 0 && j !== cur) setCur(j);
          else if (cur < list.length - 1) setCur(cur + 1);
        }
      } catch (e) {
        setStatus({ kind: "error", msg: e instanceof Error ? e.message : "Couldn't save." });
      }
    },
    [photo, draft, anns, list, cur],
  );

  const realRender = useCallback(async () => {
    if (!ann || !done) return;
    setStatus({ kind: "busy", msg: "Rendering…" });
    try {
      const res = await fetch("/api/admin/scenes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotation: ann, size, frame, mat, art: artSlug || undefined, anchor: anchorIdx }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Render failed.");
      const blob = await res.blob();
      setRender((r) => {
        if (r) URL.revokeObjectURL(r.url);
        return { url: URL.createObjectURL(blob), info: `${res.headers.get("X-Print-Size")} · ${res.headers.get("X-Ppi")} px/in${res.headers.get("X-Fits") === "1" ? "" : " · outside the wall region"}` };
      });
      setStatus({ kind: "ok", msg: "Rendered with the real compositor." });
    } catch (e) {
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : "Render failed." });
    }
  }, [ann, done, size, frame, mat, artSlug, anchorIdx]);

  async function rebuild(fixtures: boolean) {
    setBuildMsg("Building…");
    const res = await fetch("/api/admin/scenes/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fixtures }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setBuildMsg(data.error || "Build failed.");
    const r = data.report;
    setBuildMsg(`${r.annotated} photos → ${r.variants} variants, ${r.distinct}/1000 distinct${r.distinct < 1000 && r.annotated ? ` (~${r.photosFor1000} photos fill all 1,000)` : ""}. Reload pages to see it.`);
  }

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") && e.key !== "Escape") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const go = (fn: () => void) => (e.preventDefault(), fn());
      if (k === "q") go(() => (set((d) => ({ ...d, quad: [] })), setMode("quad")));
      else if (k === "a") go(() => setMode("anchor"));
      else if (k === "l") go(() => setMode("alt"));
      else if (k === "r") go(() => (set((d) => ({ ...d, ref: { ...d.ref, a: null, b: null } })), setMode("ref")));
      else if (k === "h") go(() => (set((d) => ({ ...d, ref2: { ...d.ref2, a: null, b: null } })), setMode("ref2")));
      else if (k === "escape") go(() => setMode(null));
      else if (/^[1-8]$/.test(k)) {
        const r = REF_KINDS[Number(k) - 1];
        go(() => {
          set((d) => ({ ...d, ref: { ...d.ref, kind: r.key, inches: r.inches || d.ref.inches } }));
          if (r.key === "custom") setTimeout(() => customRef.current?.focus(), 0);
        });
      } else if (k === "z") go(() => setSize((s) => PRINT_SIZE_KEYS[(PRINT_SIZE_KEYS.indexOf(s) + 1) % 4]));
      else if (k === "f") go(() => setFrame((f) => FRAME_KEYS[(FRAME_KEYS.indexOf(f) + 1) % 4]));
      else if (k === "m") go(() => setMat((m) => !m));
      else if (k === "p") go(() => void realRender());
      else if (k === "s") go(() => void save(false));
      else if (k === "enter") go(() => void save(true));
      else if (k === "d") go(() => void save(true, { status: "rejected" }));
      else if (k === "arrowright" || k === "n") go(() => setCur((c) => Math.min(list.length - 1, c + 1)));
      else if (k === "arrowleft" || k === "b") go(() => setCur((c) => Math.max(0, c - 1)));
      else if (k === "[") go(() => set((d) => ({ ...d, shadow: { ...d.shadow, angle: (d.shadow.angle + 345) % 360 } })));
      else if (k === "]") go(() => set((d) => ({ ...d, shadow: { ...d.shadow, angle: (d.shadow.angle + 15) % 360 } })));
      else if (k === "tab" && draftAnchors() > 1) go(() => setAnchorIdx((i) => (i + 1) % draftAnchors()));
      else if (k === "backspace" || k === "u")
        go(() =>
          set((d) => {
            if (mode === "quad" || (!mode && d.quad.length && !d.anchors.length)) return { ...d, quad: d.quad.slice(0, -1) };
            if (mode === "alt" && d.anchors.length > 1) return { ...d, anchors: d.anchors.slice(0, -1) };
            if (mode === "ref") return { ...d, ref: { ...d.ref, a: d.ref.b ? d.ref.a : null, b: null } };
            return d;
          }),
        );
    };
    const draftAnchors = () => draft?.anchors.length || 0;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set, save, realRender, list.length, mode, draft]);

  if (!photos.length)
    return (
      <div className="af-panel grid gap-2 p-6 text-[15px]">
        <h2 className="display text-[24px]">No photos yet</h2>
        <p>
          Run <code>npm run scenes:fetch</code> (needs <code>PEXELS_API_KEY</code>) or drop JPG/PNG files into <code>scenes/photos/</code>. Synthetic test fixtures:{" "}
          <code>node scripts/scenes/make-fixtures.mjs</code>.
        </p>
      </div>
    );
  if (!photo || !draft) return <p className="text-[15px]">No photos match the filter.</p>;

  const k = dispW && photo ? dispW / photo.w : 1;
  const hr = Math.max(6, photo.w / 140);
  const nAnn = photos.filter((p) => anns[p.id] && anns[p.id].status !== "rejected").length;
  const credit = creditLine(photo.credit);
  const refKind = REF_KINDS.find((r) => r.key === draft.ref.kind);

  return (
    <div className="grid gap-4">
      {/* grid of photos */}
      <section className="af-panel grid gap-2 p-3">
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <strong className="text-[14px]">
            {nAnn}/{photos.length} annotated
          </strong>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={todoOnly} onChange={(e) => (setTodoOnly(e.target.checked), setCur(0))} /> To do only
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showFixtures} onChange={(e) => (setShowFixtures(e.target.checked), setCur(0))} /> Show test fixtures
          </label>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={!writable} onClick={() => rebuild(false)} title="npm run scenes:build">
              Build scenes.json
            </button>
            <MoreMenu>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!writable} onClick={() => rebuild(true)} title="Includes synthetic fixtures: testing only">
                Build with fixtures (test)
              </button>
            </MoreMenu>
          </span>
        </div>
        {buildMsg && <p className="text-[13px] text-ink-2">{buildMsg}</p>}
        <ul className="flex gap-1.5 overflow-x-auto pb-1">
          {list.map((p, i) => {
            const a = anns[p.id];
            return (
              <li key={p.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setCur(i)}
                  className={cn("relative block h-[64px] w-[88px] overflow-hidden rounded-md border-2", p.id === photo.id ? "border-ink" : "border-transparent opacity-80 hover:opacity-100")}
                  title={p.id}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/admin/scenes/photo?id=${encodeURIComponent(p.id)}&w=200`} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span
                    className={cn("absolute right-1 top-1 h-3 w-3 rounded-full border border-white", !a ? "bg-sticker" : a.status === "rejected" ? "bg-coral" : "bg-[#0f7a55]")}
                    aria-label={!a ? "To do" : a.status === "rejected" ? "Unusable" : "Annotated"}
                  />
                  {p.source === "fixture" && <span className="absolute bottom-0 left-0 bg-[#b0124a] px-1 text-[9px] font-bold uppercase text-white">fixture</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* the photo */}
        <section className="grid content-start gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <strong className="text-[15px]">{photo.id}</strong>
            {photo.source === "fixture" ? <span className="rounded bg-[#b0124a] px-1.5 py-0.5 text-[12px] font-bold text-white">SYNTHETIC FIXTURE · not a photo</span> : null}
            {credit && <span className="text-ink-2">{credit}</span>}
            <span className="text-ink-2">
              {photo.w}×{photo.h}
            </span>
            <span className="ml-auto rounded-full bg-ink px-2.5 py-0.5 text-[13px] font-semibold text-white">
              {mode === "quad" ? `Click wall corner ${Math.min(4, draft.quad.length + 1)} of 4` : mode === "anchor" ? "Click the print's center" : mode === "alt" ? "Click an alternate spot (left/right)" : mode === "ref" ? (draft.ref.a && !draft.ref.b ? "Click the top of the object" : "Click the bottom (floor) of the object") : mode === "ref2" ? "Click both ends of the width reference" : "Drag handles to adjust"}
            </span>
          </div>
          <div ref={boxRef} className="relative w-full select-none overflow-hidden rounded-xl bg-ink/5" style={{ aspectRatio: `${photo.w} / ${photo.h}`, width: `min(100%, calc(78vh * ${(photo.w / photo.h).toFixed(4)}))` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imgRef} src={`/api/admin/scenes/photo?id=${encodeURIComponent(photo.id)}`} alt={photo.id} className="absolute inset-0 h-full w-full" draggable={false} />
            {preview && (
              <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: preview.box.W * preview.U, height: preview.box.H * preview.U, transform: preview.transform }}>
                <div
                  className="h-full w-full shadow-[6px_8px_14px_rgba(0,0,0,.35)]"
                  style={{ background: frame === "none" ? "transparent" : FRAME_CSS[frame], padding: preview.box.mold * preview.U }}
                >
                  <div className="h-full w-full" style={{ background: frame === "none" ? "transparent" : mat ? "#f3f0e9" : "#fff", padding: preview.box.mat * preview.U }}>
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-[repeating-linear-gradient(45deg,#8b2a4b_0_8px,#a3405f_8px_16px)] text-center text-[28px] font-bold text-white">
                        {SIZE_IN[size]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <svg
              ref={svgRef}
              data-annotator=""
              viewBox={`0 0 ${photo.w} ${photo.h}`}
              preserveAspectRatio="none"
              className={cn("absolute inset-0 h-full w-full", mode ? "cursor-crosshair" : "cursor-default")}
              onClick={onClick}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              {draft.quad.length > 0 && (
                <polygon
                  points={draft.quad.map((p) => p.join(",")).join(" ")}
                  fill={draft.quad.length === 4 ? "rgba(139,42,75,.08)" : "none"}
                  stroke="#8b2a4b"
                  strokeWidth={2}
                  strokeDasharray="8 5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {draft.quad.map((p, i) => (
                <circle key={`q${i}`} cx={p[0]} cy={p[1]} r={hr} fill="#8b2a4b" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" className="cursor-move" onPointerDown={(e) => (e.stopPropagation(), setDrag({ kind: "quad", i }))} />
              ))}
              {(["ref", "ref2"] as const).map((key) => {
                const l = draft[key];
                if (!l.a) return null;
                const col = key === "ref" ? "#ff2d6f" : "#e3a008";
                const label = key === "ref" ? `${l.inches} in` : `${l.inches} in wide`;
                return (
                  <g key={key}>
                    {l.b && <line x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke={col} strokeWidth={3} vectorEffect="non-scaling-stroke" />}
                    {[l.a, l.b].map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={hr * 0.8} fill={col} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" className="cursor-move" onPointerDown={(e) => (e.stopPropagation(), setDrag({ kind: key, i }))} />)}
                    {l.b && (
                      <text x={(l.a[0] + l.b[0]) / 2 + hr * 1.5} y={(l.a[1] + l.b[1]) / 2} fontSize={hr * 2.6} fontWeight={700} fill={col} stroke="#fff" strokeWidth={hr / 3} paintOrder="stroke">
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}
              {draft.anchors.map((p, i) => (
                <g key={`a${i}`} className="cursor-move" onPointerDown={(e) => (e.stopPropagation(), setDrag({ kind: "anchor", i }))}>
                  <circle cx={p[0]} cy={p[1]} r={hr * 1.3} fill={i === anchorIdx ? "#ffd43b" : "rgba(255,212,59,.5)"} stroke="#15161b" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  <line x1={p[0] - hr * 2.4} y1={p[1]} x2={p[0] + hr * 2.4} y2={p[1]} stroke="#15161b" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  <line x1={p[0]} y1={p[1] - hr * 2.4} x2={p[0]} y2={p[1] + hr * 2.4} stroke="#15161b" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  {i > 0 && (
                    <text x={p[0] + hr * 1.8} y={p[1] - hr * 1.8} fontSize={hr * 2.2} fontWeight={700} fill="#15161b">
                      {i + 1}
                    </text>
                  )}
                </g>
              ))}
              {/* shadow direction gizmo */}
              {anchor && (
                <line
                  x1={anchor[0]}
                  y1={anchor[1]}
                  x2={anchor[0] + Math.cos((draft.shadow.angle * Math.PI) / 180) * hr * 6}
                  y2={anchor[1] + Math.sin((draft.shadow.angle * Math.PI) / 180) * hr * 6}
                  stroke="#15161b"
                  strokeOpacity={0.6}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>
          <p className="text-[13px] text-ink-2">
            Keys: <b>Q</b> wall corners · <b>A</b> anchor · <b>L</b> alternate spots · <b>R</b> reference · <b>1–8</b> reference kind · <b>H</b> width reference (oblique walls) · <b>Z</b> size · <b>F</b> frame · <b>M</b> mat ·{" "}
            <b>Tab</b> next spot · <b>[ ]</b> shadow · <b>P</b> real render · <b>S</b> save · <b>Enter</b> save &amp; next · <b>D</b> unusable &amp; next · <b>← →</b> browse · <b>U</b> undo point · scale {k.toFixed(2)}
          </p>
          {render && (
            <figure className="grid gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={render.url} alt="Compositor output" className="w-full rounded-xl" />
              <figcaption className="text-[13px] text-ink-2">Compositor output: {render.info}</figcaption>
            </figure>
          )}
        </section>

        {/* controls */}
        <aside className="grid content-start gap-3 text-[14px]">
          <div className="af-panel grid gap-2 p-3">
            <h2 className="text-[15px] font-bold">Steps</h2>
            <ol className="grid gap-1">
              {[
                { k: "Q", label: "Wall region, 4 corners of a real rectangle on the wall", ok: draft.quad.length === 4, m: "quad" as Mode },
                { k: "A", label: "Anchor: where the print's center goes", ok: draft.anchors.length > 0, m: "anchor" as Mode },
                { k: "R", label: "Reference line on an object of known height", ok: !!draft.ref.b, m: "ref" as Mode },
              ].map((s) => (
                <li key={s.k}>
                  <button type="button" onClick={() => setMode(s.m)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left", mode === s.m ? "bg-wall" : "hover:bg-wall")}>
                    <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[12px] font-bold", s.ok ? "bg-[#0f7a55] text-white" : "bg-sticker text-ink")}>{s.ok ? "✓" : s.k}</span>
                    {s.label}
                  </button>
                </li>
              ))}
            </ol>
            <label className="grid gap-1">
              <span className="text-[13px] font-semibold">Reference is a…</span>
              <select
                value={draft.ref.kind}
                onChange={(e) => {
                  const r = REF_KINDS.find((x) => x.key === e.target.value)!;
                  set((d) => ({ ...d, ref: { ...d.ref, kind: r.key, inches: r.inches || d.ref.inches } }));
                }}
                className="rounded-lg border border-line px-2 py-1.5"
              >
                {REF_KINDS.map((r, i) => (
                  <option key={r.key} value={r.key}>
                    {i + 1}. {r.label}
                    {r.inches ? ` (${r.inches} in)` : ""}
                  </option>
                ))}
              </select>
            </label>
            {refKind?.key === "custom" && (
              <label className="flex items-center gap-2">
                Height
                <input ref={customRef} type="number" min={1} step={0.5} value={draft.ref.inches} onChange={(e) => set((d) => ({ ...d, ref: { ...d.ref, inches: Number(e.target.value) || 0 } }))} className="w-24 rounded-lg border border-line px-2 py-1" />
                in
              </label>
            )}
            <p className="rounded-lg bg-wall px-2 py-1.5 text-[13px] leading-snug text-ink-2">
              Draw the line on something <b>touching the wall</b> (a door, a sofa back against it, a person leaning on it), from where it meets the floor to its top. Objects in front of the wall
              look bigger than they would at the wall, so a person 3 ft out from the wall in a 10 ft deep shot makes prints about 30% too big.
            </p>
            <details className="text-[13px]">
              <summary className="cursor-pointer font-semibold">Oblique wall? Width reference (H) and lens</summary>
              <p className="mt-1 text-[13px] text-ink-2">
                When the wall recedes at an angle and verticals stay vertical, the photo alone can&apos;t tell how wide the wall is. Draw a horizontal line across something on the wall of known width (H), or
                give the lens.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <select
                  value={draft.ref2.kind}
                  onChange={(e) => {
                    const r = REF2_KINDS.find((x) => x.key === e.target.value)!;
                    set((d) => ({ ...d, ref2: { ...d.ref2, kind: r.key, inches: r.inches || d.ref2.inches } }));
                  }}
                  className="rounded-lg border border-line px-2 py-1"
                >
                  {REF2_KINDS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                      {r.inches ? ` (${r.inches} in)` : ""}
                    </option>
                  ))}
                </select>
                <input type="number" min={0} step={0.5} value={draft.ref2.inches} onChange={(e) => set((d) => ({ ...d, ref2: { ...d.ref2, inches: Number(e.target.value) || 0 } }))} className="w-20 rounded-lg border border-line px-2 py-1" aria-label="Width in inches" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => (set((d) => ({ ...d, ref2: { ...d.ref2, a: null, b: null } })), setMode("ref2"))}>
                  Draw (H)
                </button>
                {draft.ref2.a && (
                  <button type="button" className="text-[13px] underline" onClick={() => set((d) => ({ ...d, ref2: { ...d.ref2, a: null, b: null } }))}>
                    clear
                  </button>
                )}
              </div>
              <label className="mt-2 flex items-center gap-2">
                Lens (35mm eq.)
                <input type="number" min={0} step={1} value={draft.lens ?? ""} placeholder="auto" onChange={(e) => set((d) => ({ ...d, lens: Number(e.target.value) || null }))} className="w-20 rounded-lg border border-line px-2 py-1" />
                mm
              </label>
            </details>
          </div>

          <div className="af-panel grid gap-1.5 p-3">
            <h2 className="text-[15px] font-bold">Scale</h2>
            {solve && ppi ? (
              <>
                <p>
                  <b className="num">{ppi.ppi.toFixed(2)}</b> px per inch at the anchor <span className="text-ink-2">({ppi.x.toFixed(1)} across, {ppi.y.toFixed(1)} up)</span>
                </p>
                <p>
                  Wall region: <span className="num">{solve.wallIn.w.toFixed(0)} × {solve.wallIn.h.toFixed(0)} in</span> <span className="text-ink-2">({(solve.wallIn.w / 12).toFixed(1)} × {(solve.wallIn.h / 12).toFixed(1)} ft)</span>
                </p>
                <p className="text-ink-2">
                  Lens: {solve.focalSource === "perspective" ? "measured from perspective" : solve.focalSource === "ref2" ? "width from the width reference" : solve.focalSource === "lens" ? "as given" : solve.focalSource === "frontal" ? "frontal wall (not needed)" : "assumed 28mm, add a width reference if the wall is oblique"}
                </p>
                <p>
                  Fits: {usable.length ? usable.map((s) => SIZE_IN[s]).join(", ") : <span className="text-coral">nothing (make the wall region bigger)</span>}
                </p>
              </>
            ) : (
              <p className="text-ink-2">Mark the wall and a reference to see the scale.</p>
            )}
          </div>

          <div className="af-panel grid gap-2 p-3">
            <h2 className="text-[15px] font-bold">Preview</h2>
            <div className="grid grid-cols-4 gap-1">
              {PRINT_SIZE_KEYS.map((s) => (
                <button key={s} type="button" onClick={() => setSize(s)} className={cn("rounded-lg border-2 px-1 py-1 text-[13px] font-semibold", size === s ? "border-ink bg-wall" : "border-line", solve && !usable.includes(s) && "text-coral")}>
                  {SIZE_IN[s]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {FRAME_KEYS.map((f) => (
                <button key={f} type="button" onClick={() => setFrame(f)} className={cn("rounded-full border-2 px-2.5 py-0.5 text-[13px] font-semibold capitalize", frame === f ? "border-ink" : "border-line")}>
                  {f}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-1 text-[13px]">
                <input type="checkbox" checked={mat} onChange={(e) => setMat(e.target.checked)} /> mat
              </label>
            </div>
            <select aria-label="Artwork to preview" value={artSlug} onChange={(e) => setArtSlug(e.target.value)} className="rounded-lg border border-line px-2 py-1.5">
              <option value="">Placeholder</option>
              {arts.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.title}
                </option>
              ))}
            </select>
            {draft.anchors.length > 1 && (
              <div className="flex items-center gap-1 text-[13px]">
                Spot:
                {draft.anchors.map((_, i) => (
                  <button key={i} type="button" onClick={() => setAnchorIdx(i)} className={cn("rounded-full border-2 px-2", anchorIdx === i ? "border-ink" : "border-line")}>
                    {i + 1}
                  </button>
                ))}
                <button type="button" className="ml-auto underline" onClick={() => (set((d) => ({ ...d, anchors: d.anchors.slice(0, 1) })), setAnchorIdx(0))}>
                  clear extra spots
                </button>
              </div>
            )}
            <button type="button" className="btn btn-ghost btn-sm" disabled={!done} onClick={realRender}>
              Real render (P)
            </button>
          </div>

          <div className="af-panel grid gap-2 p-3">
            <h2 className="text-[15px] font-bold">Light</h2>
            <label className="flex items-center gap-2">
              Wall tint
              <input type="color" value={draft.tint} onChange={(e) => set((d) => ({ ...d, tint: e.target.value, tintAuto: false }))} className="h-7 w-12 rounded border border-line" />
              <span className="num text-[13px] text-ink-2">{draft.tint}</span>
              <button
                type="button"
                className="ml-auto text-[13px] underline"
                onClick={() => {
                  if (imgRef.current && draft.quad.length === 4) {
                    const t = sampleTint(imgRef.current, draft.quad, photo.w);
                    if (t) set((d) => ({ ...d, tint: t, tintAuto: true }));
                  }
                }}
              >
                resample
              </button>
            </label>
            <label className="grid grid-cols-[110px_1fr_40px] items-center gap-2">
              Shadow falls
              <input type="range" min={0} max={359} value={draft.shadow.angle} onChange={(e) => set((d) => ({ ...d, shadow: { ...d.shadow, angle: Number(e.target.value) } }))} />
              <span className="num text-[13px]">{draft.shadow.angle}°</span>
            </label>
            <label className="grid grid-cols-[110px_1fr_40px] items-center gap-2">
              Strength
              <input type="range" min={0} max={1} step={0.05} value={draft.shadow.strength} onChange={(e) => set((d) => ({ ...d, shadow: { ...d.shadow, strength: Number(e.target.value) } }))} />
              <span className="num text-[13px]">{draft.shadow.strength.toFixed(2)}</span>
            </label>
            <label className="grid grid-cols-[110px_1fr_40px] items-center gap-2">
              Art brightness
              <input type="range" min={0.5} max={1.5} step={0.05} value={draft.exposure} onChange={(e) => set((d) => ({ ...d, exposure: Number(e.target.value) }))} />
              <span className="num text-[13px]">{draft.exposure.toFixed(2)}</span>
            </label>
            <label className="grid grid-cols-[110px_1fr_40px] items-center gap-2">
              Softness
              <input type="range" min={0} max={2} step={0.1} value={draft.softness} onChange={(e) => set((d) => ({ ...d, softness: Number(e.target.value) }))} />
              <span className="num text-[13px]">{draft.softness.toFixed(1)}</span>
            </label>
          </div>

          <div className="af-panel grid gap-2 p-3">
            <h2 className="text-[15px] font-bold">Tags</h2>
            <div className="flex flex-wrap gap-1">
              {ROOM_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set((d) => ({ ...d, tags: [...d.tags.filter((x) => !(ROOM_TAGS as readonly string[]).includes(x)), ...(d.tags.includes(t) ? [] : [t])] }))}
                  className={cn("rounded-full border-2 px-2.5 py-0.5 text-[13px] font-semibold", draft.tags.includes(t) ? "border-ink bg-ink text-white" : "border-line")}
                >
                  {ROOM_TAG_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {FLAG_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set((d) => ({ ...d, tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags.filter((x) => !(t === "warm" ? x === "cool" : t === "cool" ? x === "warm" : false)), t] }))}
                  className={cn("rounded-full border-2 px-2.5 py-0.5 text-[13px] font-semibold", draft.tags.includes(t) ? "border-ink bg-wall" : "border-line")}
                >
                  {t === "person" ? "has person" : t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="flex gap-2">
              <button type="button" className="btn btn-blue flex-1" disabled={!writable || !done || status.kind === "busy"} onClick={() => save(true)}>
                Save &amp; next (Enter)
              </button>
              <button type="button" className="btn btn-ghost" disabled={!writable || status.kind === "busy"} onClick={() => save(true, { status: "rejected" })} title="Not usable (D)">
                Unusable
              </button>
            </div>
            <p role="status" aria-live="polite" className={cn("min-h-[18px] text-[13px]", status.kind === "error" ? "text-coral" : "text-ink-2")}>
              {!writable ? "Read-only here: annotate in development." : status.msg || (anns[photo.id] ? `Saved ${anns[photo.id].updatedAt?.slice(0, 16).replace("T", " ") ?? ""}` : "Not saved yet.")}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
