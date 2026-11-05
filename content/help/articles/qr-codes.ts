import type { HelpArticle } from "../types";
import { LEGACY_MAX_PCT, LEGACY_UNTIL_TEXT, QR_DISCOUNTS, QR_FORMATS, QR_PRESETS } from "../facts";

const section = "qr-codes" as const;

const presetList = QR_PRESETS.map((p) => `- **${p.name}:** ${p.sub.toLowerCase()}. ${p.format.name}, ${p.format.w} × ${p.format.h} in.`).join("\n");
const sheetTable = [
  "| Format | Size | Per US Letter sheet |",
  "|---|---|---|",
  ...QR_FORMATS.map((f) => `| ${f.name} | ${f.w} × ${f.h} in | ${f.sheet.note} |`),
].join("\n");

export const qrCodes: HelpArticle[] = [
  {
    slug: "qr-templates",
    section,
    audience: "artist",
    title: "QR code looks and templates",
    summary: `Start from one of ${QR_PRESETS.length} looks, then change the colors, dots, corners and wording. The Will it scan? panel checks every change.`,
    link: { href: "/studio/qr", label: "Open QR codes" },
    related: ["first-qr-code", "printing-sheets", "hanging-codes"],
    body: `
## The starting looks
${presetList}

## What you can change
- The call to action printed on the card
- Title and artist, and whether the Artfinity name shows
- Dot style, corner style, and the colors of the code, corners, card and price tag
- The Artfinity logo in the middle of the code
- The venue or event name, printed on the card or kept for your stats only
- Which print size the buyer sees first

## Will it scan?
Every change is checked as you make it. The panel warns you when:
- The code and card colors are too close (dark code on a light card is safest)
- A light code sits on a dark card, which some older scanner apps can't read
- The corners blend into the card (phones find a code by its corners)
- The dots are too small for the format

Preview it on the card, **On the wall** (to scale beside a 24 × 30 in painting) or as a **Print sheet**.
`,
  },
  {
    slug: "change-after-printing",
    section,
    audience: "artist",
    title: "Can I change a code after printing it?",
    summary: "Yes. A printed code holds only a short link like theartfinity.com/q/K7P2. Change the piece it opens, the discount, the venue or the end date in My codes, and the printed code follows.",
    faq: true,
    popular: 6,
    link: { href: "/studio/codes", label: "Open My codes" },
    related: ["codes-never-break", "scan-discounts", "scan-tracking"],
    body: `
Your QR code doesn't contain the painting's address. It holds a short link, and we look up what's behind it every time someone scans. So you can edit it after it's printed and hung.

## What you can change
- **Which piece it opens**, or point it at your artist page instead
- **The discount** (or remove it)
- **The venue or event name**
- **When it stops working:** never, or after a date
- **On or off:** turn a code off without throwing the label away

Open [My codes](/studio/codes), pick the code and save your changes. They apply to the next scan.

> If you change the discount on a code whose card shows a price tag, the printed tag won't change. Print a fresh card, or pick a code without a printed discount.

Need a second code for the same piece, say for a different café? In QR Studio, use **New code for this piece**. Each code keeps its own stats.
`,
  },
  {
    slug: "scan-tracking",
    section,
    audience: "artist",
    title: "Scan tracking: who scanned, where, and what sold",
    summary: "My codes shows each code's scans, people, revenue and what you earned, plus scans by day, city and device. No names or personal details.",
    link: { href: "/studio/codes", label: "Open My codes" },
    related: ["analytics", "change-after-printing", "hanging-codes"],
    body: `
## What you see
For every code in [My codes](/studio/codes):
- **Scans** and **people** (unique visitors)
- **Revenue** and **you earned** from sales that came through the code
- **Converts:** sales as a share of scans
- **Status:** live, or ended

Open a code for more: scans by day, where people scanned (city), on what (phone or tablet), and the latest scans.

## How sales are credited
When someone scans, we remember the code in their browser for a week. If they buy within that time, even after browsing around, the sale counts for that code. Your [Money](/studio/money) page also shows which code or venue each sale came from.

## Privacy
We record the device type, a rough location (city, region, country) and a random visitor id so you can count unique people. Never names or emails. Link checkers and bots aren't counted.

> Name each code after its wall (for example "Williamsburg café" or "Brooklyn Flea") so you can compare venues at a glance.
`,
  },
  {
    slug: "scan-discounts",
    section,
    audience: "artist",
    title: "Scan discounts",
    summary: `Add ${QR_DISCOUNTS} off to a code and buyers who scan it get that discount at checkout. It comes off the sale price, so your share shrinks a little too.`,
    link: { href: "/studio/qr", label: "Open QR codes" },
    related: ["what-you-earn", "change-after-printing", "discount-didnt-apply"],
    body: `
A discount is a nice reason to scan at a market like Smorgasburg or the Union Square Holiday Market. Pick ${QR_DISCOUNTS} in QR Studio and the card can show a price tag. When someone scans, the buy page says "Your discount is applied", and checkout takes it off.

## Who pays for it
The discount lowers the sale price. Costs stay the same, so the profit is smaller, and your share and Artfinity's share both shrink. The QR Studio's **Each sale pays you** panel shows your earnings with the discount included. See [What you earn per sale](/help/selling/what-you-earn) for a worked example.

## It can't be faked
A discount only works when it comes from your code. Typing a discount into the web address by hand does nothing.

## Changing or ending it
Change or remove the discount any time in [My codes](/studio/codes). Set an end date if it's for one event.

## Older cards
Cards printed before discounts were protected carry a plain discount in the link. We honor those up to ${LEGACY_MAX_PCT}% until ${LEGACY_UNTIL_TEXT}, so nobody holding an old card is let down. After that, print fresh codes.
`,
  },
  {
    slug: "printing-sheets",
    section,
    audience: "artist",
    title: "Printing codes on sheets",
    summary: "Every download is a US Letter PDF with crop marks. Print at 100% scale on matte card or label paper, then cut.",
    link: { href: "/studio/qr", label: "Open QR codes" },
    related: ["qr-templates", "hanging-codes", "first-qr-code"],
    body: `
## Sheet layouts
${sheetTable}

## Printing tips
- Print at **100% / actual size**. "Fit to page" shrinks the cards and the crop marks stop lining up.
- Matte card stock (or matte label sheets) scans better than glossy paper under lights.
- Print one test sheet first and scan a card with your phone.
- Round stickers fit standard 2-inch round labels.

## Downloads
- **Download PDF:** a print-ready sheet
- **SVG:** the card as a vector file, for a print shop or design app
- **Code PNG:** just the code, 1200 px, to drop into your own designs
- **Print all my codes:** one PDF with a card for every piece, in the same look

You can also print gallery labels for every live piece at once from [My art](/studio/art).
`,
  },
  {
    slug: "codes-never-break",
    section,
    audience: "artist",
    title: "Why your codes keep working",
    summary: "A code points to a short link we control, not to a page address. If you rename a piece, swap the image or point it elsewhere, the printed code keeps working.",
    link: { href: "/studio/codes", label: "Open My codes" },
    related: ["change-after-printing", "close-account"],
    body: `
Lots of QR codes break when a website changes. Ours hold only a short link like theartfinity.com/q/K7P2, and Artfinity looks up the destination on every scan. Nothing about the page address is printed.

## A code stops working only when
- **You set an end date** (for example, the last day of a market). After that, a scan opens your artist page instead, with a note that the code has ended.
- **You turn it off** in [My codes](/studio/codes). Same result: the scan opens your artist page.
- **The piece is no longer live.** The scan opens your artist page.
- **You close your account.** Codes stop opening anything, because your page is offline.

## Keeping old codes useful
Sold out of a limited edition, or took a piece down? Point its code at another piece or at your page in [My codes](/studio/codes). The label on the wall keeps selling.
`,
  },
  {
    slug: "partner-venues",
    section,
    audience: "artist",
    title: "Hanging codes at partner venues",
    summary: "When your work hangs at an Artfinity partner venue (a café, bar, shop or market), pick the venue on the code. Buyers see where they scanned it, the venue lists your piece on its own page, and nothing changes in what you earn.",
    link: { href: "/studio/codes", label: "Open My codes" },
    related: ["hanging-codes", "change-after-printing", "scan-tracking"],
    body: `
Partner venues are places around New York that hang local art and work with Artfinity: cafés, bars, shops and markets. Each one has a public page at theartfinity.com/venues listing the pieces on its walls, its address and a map link.

## Pick the venue on your code
1. Open the code in [My codes](/studio/codes), or make a new one in [QR codes](/studio/qr).
2. Under **Venue**, pick the place from the list of partner venues (it shows the name and neighborhood).
3. Save. That's it: the printed code doesn't change.

Not on the list? Choose **Other place** and type the name. It shows in your stats and on the buyer's page, just like before. If we later sign that place up as a partner, we link your code to it for you.

## What picking a venue does
- **Buyers see where they found it.** The buy page says "Scanned at" the venue, linked to the venue's page.
- **The venue shows your work.** While the code is on, the piece appears on the venue's page with a link to buy it. Turn the code off or let it end and the piece comes off the page.
- **Your stats show the venue** next to the code in My codes.

> Moving a piece to another café? Change the venue on the same code in My codes. The code, its scans and its sales history stay with you.

## Does it change what I earn?
No. Your share of each sale is the same with or without a venue. Some venues get a small thank-you from Artfinity's own share of the profit on sales from their walls. It never comes out of yours.

## Good to know
- One code, one place. If the same piece hangs in two spots, make a second code so each venue's scans are counted on their own.
- Ask before you hang. Partner venues have agreed to host art, but check with the staff where your piece should go.
- Venues get a window sticker that says "Local art here — scan to buy", so people know to look for your code.
`,
  },
];
