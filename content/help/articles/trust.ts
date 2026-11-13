import type { HelpArticle } from "../types";
import { AUTO_APPROVE_AFTER, MEDAL_TEXT } from "../facts";

const section = "trust" as const;

export const trust: HelpArticle[] = [
  {
    slug: "copyright",
    section,
    audience: "artist",
    title: "Do I keep the copyright to my art?",
    summary: "Yes. You keep your copyright. Artfinity only gets a limited license to print, sell and promote the work while it's listed.",
    faq: true,
    popular: 8,
    link: { href: "/artist-terms-and-agreement", label: "Read the artist terms" },
    related: ["no-ai-training", "report-stolen-art", "close-account"],
    body: `
You keep the copyright and all other rights in your art. Selling on Artfinity doesn't transfer them. When you upload a piece, you give Artfinity a limited, non-exclusive license to:
- Print it and sell those prints to buyers
- Show it on Artfinity, including your page, QR codes and share images
- Promote it, and you, in Artfinity's marketing

The license covers nothing else. It lasts while the piece is listed. Remove the piece or close your account and we stop selling it. We still finish orders already placed.

Buyers get a print, not the copyright. They can't copy, resell or reproduce the image.

Full details are in the [artist terms](/artist-terms-and-agreement).
`,
  },
  {
    slug: "no-ai-training",
    section,
    audience: "both",
    title: "Is my art used to train AI?",
    summary: "No. Artfinity doesn't use your art to train AI, and doesn't sell or license it to anyone who does. We also ask AI crawlers not to collect it.",
    faq: true,
    link: { href: "/artist-terms-and-agreement", label: "Read the artist terms" },
    related: ["copyright", "report-stolen-art"],
    body: `
- Artfinity does not use uploaded art to train AI models.
- We don't sell or license your art to anyone who does.
- Our robots.txt asks AI crawlers not to collect art from the site, and every page and image carries a machine-readable "no text and data mining" signal.

We can't stop crawlers that ignore these requests, but they don't have our permission.

See someone selling AI-made copies of a real artist's work here? [Report it](/report).
`,
  },
  {
    slug: "report-stolen-art",
    section,
    audience: "both",
    title: "Reporting stolen or copied art (DMCA)",
    summary: "Use the report form and choose \"It's my work / copied\". Our moderation team reviews every report, usually within 2 business days, and infringing work comes down.",
    link: { href: "/report", label: "Report art" },
    related: ["duplicate-detection", "copyright", "no-ai-training"],
    body: `
## If someone is selling your work
1. Go to [Report art](/report) and choose **It's my work / copied**.
2. The form asks for everything a DMCA notice needs: a link to your original, the Artfinity link, your contact details, two short statements and your typed signature.
3. Submit. We email you a copy.

Our moderation team reviews every report, usually within 2 business days. If it's valid, we take the work down quickly, tell the artist why, and email you when it's done. Artists who keep uploading other people's work lose their account.

Not the owner? You can still report AI-made or harmful work on the same form.

## If your work was taken down by mistake
Log in and use the link in your takedown email to send a counter-notice. We pass it to the person who filed the report. If they don't tell us within 10 business days that they've gone to court, we put your work back up within 14 business days.

Filing a false notice or counter-notice can make you liable for damages. Full details, and our copyright agent's address, are on [Copyright and DMCA](/dmca).
`,
  },
  {
    slug: "duplicate-detection",
    section,
    audience: "artist",
    title: "Duplicate detection",
    summary: "Every upload is fingerprinted. If it looks like a piece another artist already has on Artfinity, our moderation team checks it before it goes live.",
    related: ["report-stolen-art", "upload-art", "verification-badge"],
    body: `
When you upload, we make a fingerprint of the image and compare it with every piece on Artfinity. It still matches after resizing, re-saving, light crops and small color changes.

- **It matches another artist's piece:** your upload waits for our moderation team to check it before it goes live. You'll see a note saying so.
- **It matches one of your own pieces:** that's fine. We just let you know you've uploaded it before.

This catches people re-uploading art they found online. If your own work is held for review, you don't need to do anything. It goes live once our moderation team has checked it. If someone else has uploaded *your* work, [report it](/help/trust/report-stolen-art).
`,
  },
  {
    slug: "verification-badge",
    section,
    audience: "both",
    title: "The verified badge",
    summary: "A verified badge means our team checked that the artist is real. Artists apply with their Instagram or website and a photo of themselves with their work.",
    link: { href: "/studio/verify", label: "Get verified" },
    related: ["medals", "upload-art", "duplicate-detection"],
    body: `
## For buyers
The badge next to an artist's name means our team confirmed they're a real artist making this work.

## For artists: how to apply
1. Open [Get verified](/studio/verify).
2. Add your Instagram or your website.
3. Upload a photo of you with your work, or of your studio.
4. Add a note if it helps, then send it.

Our team reviews it and emails you the result. If something needs another look, the email says what.

Verified artists' new pieces go live right away, without the review new artists' first ${AUTO_APPROVE_AFTER} pieces get.
`,
  },
  {
    slug: "medals",
    section,
    audience: "both",
    title: "Seller medals",
    summary: `Medals show an artist's track record: ${MEDAL_TEXT} sold. Artists can hide them on their page.`,
    link: { href: "/studio/design", label: "Design your page" },
    related: ["verification-badge", "reviews", "design-your-page"],
    body: `
Medals sit next to an artist's name so buyers can see who has sold before.

- ${MEDAL_TEXT.replace(/, | and /g, "\n- ")}

Only prints bought by buyers count. An artist's own [bulk prints](/help/selling/bulk-prints) don't.

Artists see their progress to the next medal in the Studio. To hide medals and the sales count, turn off **Medals and sales count** in [Design your page](/studio/design).
`,
  },
];
