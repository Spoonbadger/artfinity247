// Print sheets for QR cards: each card is drawn as SVG (components/qr/card.ts),
// rasterised at print resolution with sharp, then tiled on US Letter with pdf-lib.
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { cardSVG, renderCard, sheetLayout, FORMATS, type ArtInfo, type Design, type FormatKey } from "@/components/qr/card";
import { loadFonts } from "@/components/qr/text";

export type CardJob = { design: Design; art: ArtInfo; qrText: string };

/**
 * One job + fill: a full sheet of the same card (the Studio's "Download PDF").
 * Several jobs: one card each, as many sheets as needed. All jobs use the first job's format.
 */
export async function generateQrPdf(jobs: CardJob[], opts: { fill?: boolean; hint?: string | ((sheet: number, sheets: number) => string); title?: string } = {}): Promise<Uint8Array> {
  if (!jobs.length) throw new Error("No cards to print");
  const fonts = await loadFonts();
  const fmt = jobs[0].design.format;
  const L = sheetLayout(fmt);
  const list = opts.fill && jobs.length === 1 ? Array.from({ length: L.slots.length }, () => jobs[0]) : jobs;
  const dpi = fmt === "poster" ? 200 : 300;
  const gapY = FORMATS[fmt].sheet.gy * 72;

  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title || (jobs.length === 1 ? `${jobs[0].art.title} · ${FORMATS[fmt].name}` : `Artfinity QR cards · ${FORMATS[fmt].name}`));
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
        const hint = (typeof opts.hint === "function" ? opts.hint(i / L.slots.length + 1, sheets) : opts.hint) || "Print at 100% (actual size). Cut on the marks.";
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
 * The print queue's mixed sheets: DIFFERENT pieces packed onto the same sheets, each repeated `qty` times, in order
 * (3 labels of piece A and 7 of piece B fill one 10-up sheet). Every job must be in `fmt`; others are skipped.
 * Each distinct card is rasterised once.
 */
export async function generateMixedQrPdf(items: { job: CardJob; qty: number }[], fmt: FormatKey, opts: { title?: string; footer?: string } = {}): Promise<Uint8Array> {
  const list: CardJob[] = [];
  for (const it of items) {
    if (it.job.design.format !== fmt) continue;
    for (let i = 0; i < Math.max(0, Math.floor(it.qty)); i++) list.push(it.job);
  }
  if (!list.length) throw new Error("No cards to print");
  return generateQrPdf(list, {
    title: opts.title,
    hint: (sheet, sheets) => `${opts.footer ? `${opts.footer} · ` : ""}Sheet ${sheet} of ${sheets} · Print at 100% (actual size). Cut on the marks.`,
  });
}
