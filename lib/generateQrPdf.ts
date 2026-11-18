// Print sheets for QR cards: each card is drawn as SVG (components/qr/card.ts),
// rasterised at print resolution with sharp, then tiled on US Letter with pdf-lib.
import sharp from "sharp";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFImage } from "pdf-lib";
import { blackAndWhite, cardSVG, customName, freeDesign, renderCard, sheetLayout, FORMATS, type ArtInfo, type Design, type FormatKey } from "@/components/qr/card";
import { loadFonts } from "@/components/qr/text";
import { artPalette, artThumb } from "@/lib/qr/palette";
import { pack, type PaperSize } from "@/lib/printPack";
import { cardBox, type PrintColor, type SizeKey } from "@/lib/printOptions";

export type CardJob = { design: Design; art: ArtInfo; qrText: string };
/**
 * pro: the artist's plan. false = a Free artist: Infinity extras fall back to the closest free look (same format,
 * style, ink and colours) instead of failing, e.g. an old link to an Infinity design. Leave it out only where the
 * designs are known to be free.
 */
export type PdfPlan = { pro?: boolean };

/**
 * Ready a job to print: the plan fallback, Match your art's palette for THIS piece (Print all shares one design across
 * pieces), and the thumbnail as an embedded image (the rasteriser can't fetch URLs).
 */
export async function prepareJob(job: CardJob, plan: PdfPlan = {}): Promise<CardJob> {
  let design = plan.pro === false ? freeDesign(job.design) : job.design;
  let art = job.art;
  if (design.extras.includes("match") && (design.paletteOf !== art.slug || !design.palette.length)) {
    const p = await artPalette(art.imageUrl).catch(() => null);
    design = { ...design, palette: p?.palette ?? [], paletteOf: art.slug };
  }
  if (design.extras.includes("thumb") && !art.thumb?.startsWith("data:")) {
    const t = await artThumb(art).catch(() => null);
    art = { ...art, thumb: t ?? "" };
  }
  return design === job.design && art === job.art ? job : { ...job, design, art };
}

/**
 * One job + fill: a full sheet of the same card (the Studio's "Download PDF").
 * Several jobs: one card each, as many sheets as needed. All jobs use the first job's format.
 */
export async function generateQrPdf(rawJobs: CardJob[], opts: PdfPlan & { fill?: boolean; hint?: string | ((sheet: number, sheets: number) => string); title?: string } = {}): Promise<Uint8Array> {
  if (!rawJobs.length) throw new Error("No cards to print");
  // Same job object in, same prepared job out, so repeated cards are still rasterised once.
  const ready = new Map<CardJob, CardJob>();
  for (const j of rawJobs) if (!ready.has(j)) ready.set(j, await prepareJob(j, opts));
  const jobs = rawJobs.map((j) => ready.get(j)!);
  const fonts = await loadFonts();
  const fmt = jobs[0].design.format, custom = jobs[0].design.custom;
  const L = sheetLayout(fmt, custom);
  const list = opts.fill && jobs.length === 1 ? Array.from({ length: L.slots.length }, () => jobs[0]) : jobs;
  // Big cards (the poster, large custom sizes) rasterise at 200 dpi to keep the file small.
  const dpi = L.cw * L.ch > 30 * 72 * 72 ? 200 : 300;
  const gapY = L.gy;
  const name = custom ? customName(custom) : FORMATS[fmt].name;

  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title || (jobs.length === 1 ? `${jobs[0].art.title} · ${name}` : `Artfinity QR cards · ${name}`));
  pdf.setAuthor(jobs[0].art.artist);
  pdf.setCreator("Artfinity QR Studio");
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.08, 0.09, 0.11);

  const images = new Map<CardJob, PDFImage>();
  let page = null as ReturnType<typeof pdf.addPage> | null;
  for (let i = 0; i < list.length; i++) {
    const slot = i % L.slots.length;
    if (slot === 0) {
      page = pdf.addPage([L.W, L.H]);
      for (const [x1, y1, x2, y2] of L.marks) page.drawLine({ start: { x: x1, y: L.H - y1 }, end: { x: x2, y: L.H - y2 }, thickness: 0.5, color: ink });
      const bottom = L.slots.length ? L.H - (L.slots[L.slots.length - 1].y + L.ch) : 0;
      if (bottom > 22) {
        const sheets = Math.ceil(list.length / L.slots.length);
        const hint = (typeof opts.hint === "function" ? opts.hint(i / L.slots.length + 1, sheets) : opts.hint) || (custom && custom.sheet !== "auto" ? `Print at 100% (actual size) on ${name}.` : "Print at 100% (actual size). Cut on the marks.");
        page.drawText(hint, { x: (L.W - helv.widthOfTextAtSize(hint, 7)) / 2, y: 8, size: 7, font: helv, color: rgb(0.45, 0.46, 0.5) });
      }
    }
    const job = list[i];
    let img = images.get(job);
    if (!img) {
      const card = renderCard(job.design, job.art, fonts, job.qrText, `p${images.size}`);
      const png = await sharp(Buffer.from(cardSVG(card)), { density: dpi }).png({ compressionLevel: 9 }).toBuffer();
      img = await pdf.embedPng(png);
      images.set(job, img);
    }
    const p = L.slots[slot];
    page!.drawImage(img, { x: p.x, y: L.H - p.y - L.ch, width: L.cw, height: L.ch });
    // Mixed sheets with gaps (stickers): a small caption below each card, outside the cut, says which piece it is.
    if (!opts.fill && gapY >= 18) {
      let cap = job.art.title;
      while (cap.length > 3 && helv.widthOfTextAtSize(cap, 6.5) > L.cw) cap = cap.slice(0, -2);
      if (cap !== job.art.title) cap = cap.trimEnd() + "...";
      try {
        page!.drawText(cap, { x: p.x + (L.cw - helv.widthOfTextAtSize(cap, 6.5)) / 2, y: L.H - p.y - L.ch - 11, size: 6.5, font: helv, color: rgb(0.45, 0.46, 0.5) });
      } catch { /* title has characters the standard PDF font can't draw: skip the caption */ }
    }
  }
  return pdf.save();
}

/**
 * A mailed order's sheets for the lab (admin): DIFFERENT pieces packed onto the same sheets, each repeated `qty` times, in order
 * (3 labels of piece A and 7 of piece B fill one 10-up sheet). Every job must be in `fmt`; others are skipped.
 * Each distinct card is rasterised once.
 */
export async function generateMixedQrPdf(items: { job: CardJob; qty: number }[], fmt: FormatKey, opts: PdfPlan & { title?: string; footer?: string } = {}): Promise<Uint8Array> {
  const list: CardJob[] = [];
  for (const it of items) {
    if (it.job.design.format !== fmt) continue;
    // Queue sheets share one grid per format, so a custom size (which the queue doesn't take) prints at the format's size.
    const job = it.job.design.custom ? { ...it.job, design: { ...it.job.design, custom: null } } : it.job;
    for (let i = 0; i < Math.max(0, Math.floor(it.qty)); i++) list.push(job);
  }
  if (!list.length) throw new Error("No cards to print");
  return generateQrPdf(list, {
    title: opts.title,
    pro: opts.pro,
    hint: (sheet, sheets) => `${opts.footer ? `${opts.footer} · ` : ""}Sheet ${sheet} of ${sheets} · Print at 100% (actual size). Cut on the marks.`,
  });
}

/**
 * Print codes (/studio/print): any mix of cards, each `copies` times, packed onto as few sheets of `paper` as fit
 * (lib/printPack.ts, the same layout the screen previews). Thin grey cut lines go round every card on plain paper;
 * ready-cut label sheets get none. Each distinct card is rasterised once. color "bw": black ink on every card, and
 * anything still in colour (a thumbnail of the painting) goes grey.
 */
export async function generatePackedPdf(
  lines: { job: CardJob; copies: number; size: SizeKey }[],
  paper: PaperSize,
  opts: PdfPlan & { title?: string; paperName?: string; color?: PrintColor } = {},
): Promise<{ pdf: Uint8Array; sheets: number; cards: number; unplaced: number }> {
  const bw = opts.color === "bw";
  const ready = await Promise.all(lines.map((l) => prepareJob(bw ? { ...l.job, design: blackAndWhite(l.job.design) } : l.job, opts)));
  const items = lines.flatMap((l, i) => {
    const box = cardBox(l.size, ready[i].design.custom);
    return box ? Array.from({ length: Math.max(0, Math.floor(l.copies)) }, () => ({ ...box, ref: i })) : [];
  });
  if (!items.length) throw new Error("No cards to print");
  const laid = pack(items, paper);
  if (!laid.sheets.length) throw new Error("None of these cards fit on this paper");
  const fonts = await loadFonts();
  const W = paper.w * 72, H = paper.h * 72;

  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title || "Artfinity QR codes");
  pdf.setAuthor(lines[0].job.art.artist);
  pdf.setCreator("Artfinity Print codes");
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const grey = rgb(0.72, 0.73, 0.76);
  const images = new Map<number, PDFImage>();
  const image = async (i: number) => {
    let img = images.get(i);
    if (!img) {
      const job = ready[i];
      const card = renderCard(job.design, job.art, fonts, job.qrText, `p${i}`);
      // Big cards (the poster, large custom sizes) rasterise at 200 dpi to keep the file small.
      const dpi = card.w * card.h > 30 * 72 * 72 ? 200 : 300;
      const raster = sharp(Buffer.from(cardSVG(card)), { density: dpi });
      img = await pdf.embedPng(await (bw ? raster.grayscale() : raster).png({ compressionLevel: 9 }).toBuffer());
      images.set(i, img);
    }
    return img;
  };

  const total = laid.sheets.length;
  for (let s = 0; s < total; s++) {
    const page = pdf.addPage([W, H]);
    const cards = laid.sheets[s].cards;
    const wholePage = cards.length === 1 && cards[0].scale !== 1;
    for (const c of cards) {
      const img = await image(c.ref);
      const x = c.x * 72, y = c.y * 72, w = c.w * 72, h = c.h * 72;
      // Turned cards: pdf-lib turns an image about its bottom-left corner, so start from the box's bottom-right.
      if (c.rotated) page.drawImage(img, { x: x + w, y: H - y - h, width: h, height: w, rotate: degrees(90) });
      else page.drawImage(img, { x, y: H - y - h, width: w, height: h });
      if (!paper.slots && !wholePage) {
        if (c.round) page.drawEllipse({ x: x + w / 2, y: H - y - h / 2, xScale: w / 2, yScale: h / 2, borderColor: grey, borderWidth: 0.35 });
        else page.drawRectangle({ x, y: H - y - h, width: w, height: h, borderColor: grey, borderWidth: 0.35 });
      }
    }
    if (!wholePage) {
      const hint = `${total > 1 ? `Sheet ${s + 1} of ${total} · ` : ""}Print at 100% (actual size)${opts.paperName ? ` on ${opts.paperName}` : ""}.${paper.slots ? "" : " Cut on the grey lines."}`;
      page.drawText(hint, { x: (W - helv.widthOfTextAtSize(hint, 7)) / 2, y: 6, size: 7, font: helv, color: rgb(0.45, 0.46, 0.5) });
    }
  }
  return { pdf: await pdf.save(), sheets: total, cards: items.length - laid.unplaced.length, unplaced: laid.unplaced.length };
}
