import type { HelpArticle } from "../types";
import { LEGACY_MAX_PCT, LEGACY_UNTIL_TEXT, QR_DISCOUNTS, QR_EXTRAS, QR_FORMATS, QR_PAPER_TABLE, QR_PRESETS, QR_SEASONS, QUEUE_MAX_QTY } from "../facts";

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
    summary: `Pick a format, a style and an ink, or start from one of ${QR_PRESETS.length} looks. The Will it scan? panel checks every change.`,
    link: { href: "/studio/qr", label: "Open QR codes" },
    related: ["first-qr-code", "printing-sheets", "hanging-codes"],
    body: `
## How a card is laid out
The painting's title is the headline. Under it: your name, and the edition if there is one. The code is as big as the card allows, with the Artfinity "a" in the middle. One solid shape carries the message and the price.

## Format, style and ink
- **Style:** Pill ("Prints from $55" in a solid pill) or Panel (the code on a solid panel, "Scan for prints from $55" beside it). Wall labels also have Clean (no shape) and Brush (the price on a paint stroke).
- **Ink:** Black ink is pure black on white, so it prints sharp on an office laser printer. Color uses a garnet pill and garnet code corners.
- New cards start as Pill in black ink.

## The starting looks
${presetList}

## What you can change
- Title and artist, and the price
- Your own words in the pill or panel, up to 20 letters (the price stays)
- A scan discount, shown in the same message: "10% off · prints from $49"
- The venue or event name, printed on the card or kept for your stats only
- Under **Colors and code style**: the pill or panel color, code, card and corner colors, dots, corners and the "a" in the code

## Infinity looks
With [Infinity](/studio/infinity) you can add:
${QR_EXTRAS}

Seasonal looks: ${QR_SEASONS}. Each one comes in Pill or Panel, black ink or color, with small motifs in the margins. The code's clear area is never touched.

On Free you see each one on your own card. Tap it to start Infinity.

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
    summary: "Yes. A printed code holds only a short link like theartfinity.com/q/K7P2. Change the piece it opens, the discount or the venue in My codes, and the printed code follows.",
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
- **On or off:** turn a code off without throwing the label away

Open [My codes](/studio/codes), pick the code and save your changes. They apply to the next scan.

> If you change the discount on a code whose card shows a discount, the printed card won't change. Print a fresh card, or pick a code without a printed discount.

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
- **Status:** on, or paused

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
A discount is a nice reason to scan at a market like Smorgasburg or the Union Square Holiday Market. Pick ${QR_DISCOUNTS} in QR Studio and the card shows it next to the lower price. When someone scans, the buy page says "Your discount is applied", and checkout takes it off.

## Who pays for it
The discount lowers the sale price. Costs stay the same, so the profit is smaller, and your share and Artfinity's share both shrink. The QR Studio's **Each sale pays you** panel shows your earnings with the discount included. See [What you earn per sale](/help/selling/what-you-earn) for a worked example.

## It can't be faked
A discount only works when it comes from your code. Typing a discount into the web address by hand does nothing.

## Changing or ending it
Change or remove the discount any time in [My codes](/studio/codes). For a one-day event, remove it when the event is over.

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

Printing codes for several pieces? Line them up in the [print queue](/help/qr-codes/print-queue) and print them together on shared sheets.
`,
  },
  {
    slug: "print-queue",
    section,
    audience: "artist",
    title: "The print queue: print all your codes at once",
    summary: "Line up codes for several pieces, then print them together on label sheets at home, or have us print, laminate and mail them to you at cost.",
    link: { href: "/studio/qr/queue", label: "Open the print queue" },
    related: ["printing-sheets", "qr-templates", "hanging-codes"],
    body: `
## Add codes to the queue
- **From QR Studio:** pick a piece and a look, set how many, then **Add to print queue**. Download PDF still prints one sheet right away.
- **From My art:** tap **Select pieces to print codes**, pick several, choose a look (or your last-used one) and **Add codes to print queue**.
- **Right after an upload:** **Add its code to the print queue**.

Every card in the queue holds the piece's real code. If a piece doesn't have one yet, we make it when you add it, so what you print is what scans. Adding the same code in the same format again just adds to its quantity (up to ${QUEUE_MAX_QTY}).

In the queue you can change how many of each, switch a card to another look, or remove it. Your queue is saved to your account, so it's the same on your phone and your laptop.

## Print at home
The queue makes one PDF per format, and packs **different pieces onto the same sheets**: 3 labels of one painting and 7 of another fill one 10-up sheet. You see each sheet before you print.

${QR_PAPER_TABLE}

> Print at **100% scale** ("Actual size"), not "Fit to page". Test-scan one before you print them all: print sheet 1 on plain paper, hold it over a label sheet to check the fit, and scan a card with your phone.

When they're printed, tap **Mark as printed**. They leave the queue and My codes shows the date ("Printed Nov 5").

## Have us print them
Prefer not to fuss with label sheets? Choose **Have us print them**: we print every code in your queue, laminate them, cut them and mail them to you.

- **At cost.** You pay what printing, laminating and postage cost us. We don't make money on these. The page shows the full breakdown before you pay.
- **US addresses.** Pay on Stripe's secure checkout. We email you a confirmation, then the tracking link when they ship.
- Your orders and their tracking show on the print queue and in [My purchases](/studio/purchases).

> Payment didn't go through? Nothing was charged and your codes stay in the queue. Tap **Try again** on the order.
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
- **You turn it off** in [My codes](/studio/codes). The scan opens your artist page, with a note that the code has ended.
- **The piece is no longer live.** The scan opens your artist page.
- **You close your account.** Codes stop opening anything, because your page is offline.

Closing a [place](/help/qr-codes/places) never breaks its codes either. You pick what its scans do: open the painting, open your page, or pause.

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
2. Under **Hangs at**, pick the place from the list of partner venues (it shows the name and neighborhood). It becomes one of your [Places](/studio/places).
3. Save. That's it: the printed code doesn't change.

Not on the list? Choose **New place…** and type the name. It shows in your stats and on the buyer's page, just like before. If we later sign that place up as a partner, we link your code to it for you.

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
  {
    slug: "old-price-on-label",
    section,
    audience: "artist",
    title: "When your printed label shows an old price",
    summary: "Change a price, discount or title after printing and Artfinity tells you which labels on the wall now say something different, so you can reprint or mark them replaced.",
    link: { href: "/studio/codes?show=stale", label: "See labels out of date" },
    related: ["change-after-printing", "print-queue", "places"],
    body: `
Every time a card with a price is printed (a PDF or SVG download, Print all, the print queue, or codes we mail you), we remember what it says: the "Prints from" price, the discount and the title.

## When you change something
Change a piece's prices or title, or a code's discount, and you'll see a note before it saves: "2 printed labels show 'Prints from $55'. After this change scans show $65." Pick one:
- **Save and reprint:** saves, and puts those codes back in your [print queue](/studio/qr/queue) with the same look and the new price.
- **Save anyway:** saves. The labels stay as they are.
- **Cancel:** nothing changes.

Lowering a price is the gentle case. Buyers pay less than the label says, so it can wait.

## Afterwards
- [My codes](/studio/codes) marks each one **Label out of date**. The **Show** menu lists just those.
- The code's page shows what the label says next to what scans show now.
- Your Studio home lists them under **Next up**.

## Done reprinting?
Hang the new labels, then tap **Mark old labels as replaced** on the code (or **Mark all replaced** in My codes). Took the old label down without reprinting? Same button.

> Scans always show today's price. The printed label is the only thing that can be out of date.
`,
  },
  {
    slug: "places",
    section,
    audience: "artist",
    title: "Places: where your art hangs",
    summary: "A place is a café, gallery, market stall or show where your work hangs. Put paintings, codes and print jobs there, then move or close everything in one go.",
    link: { href: "/studio/places", label: "Open Places" },
    related: ["partner-venues", "codes-never-break", "old-price-on-label"],
    body: `
[Places](/studio/places) keeps track of where each painting and code is. Each place shows its paintings, codes, scans and sales, for the last 30 days and all time.

## Add a place
Tap **Add a place** and give it a name. Add the neighborhood, and dates for a show or pop-up. A place you pick on a code or type as a new name is added for you. Your Studio events get one too.

## Put things there
- **Codes:** pick the place under **Hangs at** on a code, or select several in [My codes](/studio/codes) and tap **Move**. Buyers see "You scanned this at" the place.
- **Paintings:** on [My art](/studio/art) tap **Hang at a place**, or set **Currently hanging at** on the piece. A painting hangs in one place at a time; past places stay in its history.
- **Print jobs:** on the place, **Print all codes for this place** puts every code there in your print queue, and makes a code for any painting that hasn't got one.

## When things change
- **Move everything to another place:** codes, paintings and queued prints, in one step.
- **Back home:** a painting came back to the studio.
- **This place closed / show ended:** pick what scans of its codes do now:
  - open the painting as usual, without the "scanned at" line
  - send scans to your artist page
  - pause the codes (scans open your page with a short note)

You get a few seconds to undo. A show also ends on its last day; scans then open the painting without the "scanned at" line, unless you pick something else. Printed codes never land on an error page.

## Partner venues
If the place is an Artfinity [partner venue](/help/qr-codes/partner-venues), pick it under **Details**. Its codes then count toward the venue's share. What you earn doesn't change.
`,
  },
];
