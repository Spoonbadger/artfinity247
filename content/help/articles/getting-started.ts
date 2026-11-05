import type { HelpArticle } from "../types";
import { AUTO_APPROVE_AFTER, DAILY_UPLOAD_LIMIT, FREE_PCT, LARGEST, LAYOUT_NAMES, MAX_PINNED, PAINT_COUNT, PIXEL_TABLE, PRINT_DPI, QUEUE_MAX, SIZE_NAMES, SMALLEST } from "../facts";

const section = "getting-started" as const;

export const gettingStarted: HelpArticle[] = [
  {
    slug: "create-your-page",
    section,
    audience: "artist",
    title: "How do I start selling on Artfinity?",
    summary: `Claim a handle, add your name and city, and upload a piece. It's free, there's no card, and you keep ${FREE_PCT} of the profit on every print.`,
    popular: 1,
    faq: true,
    link: { href: "/register", label: "Claim your page" },
    related: ["upload-art", "first-qr-code", "what-you-earn"],
    body: `
Signing up takes about a minute and costs nothing. There's no inventory and no upfront printing cost.

## What you need
- To be at least 18 and live in the United States
- An email address (we send your sales there)
- A way to get paid: a Venmo handle today, or a bank account through Stripe (see [How payouts reach you](/help/getting-paid/how-payouts-reach-you))

## The steps
1. Go to [Start selling free](/register) and pick your handle. Your page lives at theartfinity.com/@yourhandle.
2. Add the name buyers will see and your city. Your city puts you on the local map.
3. Upload your first piece and set your prices.
4. Print a QR code and hang it beside the real painting.

## Picking a handle
Handles use 3 to 30 letters, numbers, dots or underscores. Pick the name people already know you by, like your Instagram name. You can't change it yourself yet, so choose carefully.

> Your printed QR codes don't contain your handle. They hold a short link, so they keep working whatever happens to your page name.
`,
  },
  {
    slug: "upload-art",
    section,
    audience: "artist",
    title: "Uploading your art",
    summary: `Drop in a JPG, PNG or HEIC up to 25 MB, give it a title and set your prices. Your first ${AUTO_APPROVE_AFTER} pieces get a quick look from a person before they go live.`,
    popular: 3,
    link: { href: "/studio/art/new", label: "Upload a piece" },
    related: ["upload-several", "file-sizes-print-sharp", "why-sizes-hidden", "set-prices"],
    body: `
## The basics
- **Files:** JPG, PNG or HEIC, up to 25 MB.
- **Best source:** a straight-on scan or photo of the original, in even daylight, with no frame or wall in the shot.
- **Title:** required. Add a line about the piece if you like.
- **Original size:** optional. Enter the real painting's width and height and buyers see which print size is closest to it.

## How it prints
After the upload you see every print size with a preview of how it crops. Sizes your file is too small for are marked and hidden from buyers. See [Which file sizes print sharp](/help/getting-started/file-sizes-print-sharp).

## Review for new artists
New artists' first ${AUTO_APPROVE_AFTER} pieces wait for a quick look from a person before they go live. After that, or once you're [verified](/help/trust/verification-badge), new pieces go live right away. You'll get an email when a piece is live.

You tick a box to confirm the work is yours and you hold the rights to sell prints of it.

## Sensitive work
If a piece shows nudity, violence or gore, disturbing imagery, drug use or strong language, tick the matching label. Buyers see it blurred until they tap to view it.

New uploads also get an automatic image check: if it spots nudity or violence you didn't label, it adds the label for you (change it anytime). Anything that looks explicit, graphic or not like artwork waits for a quick look from a person before it goes live.

## Limited editions
You can make a piece a limited edition when you upload it. See [Limited editions and certificates](/help/selling/limited-editions).

## Got a lot?
Once your first piece is up, you can pick several paintings or a whole folder at once. See [Uploading several paintings at once](/help/getting-started/upload-several).
`,
  },
  {
    slug: "upload-several",
    section,
    audience: "artist",
    title: "Uploading several paintings at once",
    summary: `Pick up to ${QUEUE_MAX} images or a whole folder in the upload form. They upload in the background while you fill in each painting, one by one, in the same form.`,
    link: { href: "/studio/art/new", label: "Upload art" },
    related: ["upload-art", "file-sizes-print-sharp", "printing-sheets", "collections"],
    body: `
Have a stack of paintings to get online? You don't need a separate tool. The normal upload form takes several at once, as soon as your first piece is on your page.

## Steps
1. Open [Upload art](/studio/art/new).
2. Pick several images, choose a folder, or drag them in. Up to ${QUEUE_MAX} at a time: JPG, PNG, WEBP or HEIC, each up to 25 MB.
3. They start uploading right away, a few at a time. You don't have to wait.
4. Fill in the first painting: the title is already filled in from the file name ("east_river-late.jpg" becomes "East River Late"), so check it and set your prices.
5. Press **Publish and next**. You see straight away whether it's live or in review, and the next painting opens.

## From Google Drive or Dropbox
Under the drop zone, press **Google Drive** or **Dropbox** and pick your paintings (in Google Drive you can pick a whole folder). They join the same batch and import in the background: you'll see "Importing 3 of 12…", then "12 pieces added". If a file can't come in, it says why with a fix, like **Pick it again** for a Dropbox link that has expired.

## Same as last one
Each new painting starts with the prices, print run (open or limited edition) and sensitive labels of the one before it, so a batch priced the same way takes a few clicks. Change anything on a painting and it only changes that one.

You tick the box confirming the work is yours and you hold the rights to sell prints of it once for the whole batch.

## Moving around
- The strip of thumbnails at the top shows every painting. Click one to jump to it.
- A green dot means it's published. A red dot means it needs something: a title, a bigger file, or a price that's too low.
- **Back** and **Next** move without publishing. **Skip and remove** takes a painting out of the batch.
- Each painting shows which print sizes it's sharp enough for, like a single upload. Sizes a file is too small for are hidden from buyers (see [Why are some print sizes hidden?](/help/getting-started/why-sizes-hidden)).

## Review
The same rules as a single upload apply. New artists' first ${AUTO_APPROVE_AFTER} pieces get a quick look from a person before they go live, and so does anything that looks like a piece already on Artfinity. Everything else goes live the moment you publish it.

## When you're done
You get a short summary of what's live and what's in review, with two shortcuts:
- **Print all their QR codes**: one PDF with a code for every new live piece. See [Printing sheets of codes](/help/qr-codes/printing-sheets).
- **Add them to a collection**: put the whole batch in a new or existing [collection](/help/selling/collections).

We send one email for the batch, not one per painting.

## Good to know
- If the page reloads, the paintings that finished uploading are still there, titles and all. Images that were still uploading need adding again.
- Your browser warns you if you try to leave while images are still uploading.
- You can publish up to ${DAILY_UPLOAD_LIMIT} new pieces a day.
- Your very first upload is always a single piece, so you can see how it works first.
`,
  },
  {
    slug: "file-sizes-print-sharp",
    section,
    audience: "artist",
    title: "Which file sizes print sharp?",
    summary: `We need about ${PRINT_DPI} pixels per inch of print. A file around 3,600 × 2,700 px prints sharp at every size, up to ${LARGEST}.`,
    popular: 4,
    faq: true,
    link: { href: "/studio/art/new", label: "Upload a piece" },
    related: ["why-sizes-hidden", "upload-art", "print-quality"],
    body: `
We offer four print sizes: ${SIZE_NAMES}. Below ${PRINT_DPI} pixels per inch a print starts to look soft, so each size needs a minimum number of pixels.

${PIXEL_TABLE}

The check doesn't care which way round the image is. Portrait and landscape both work.

## How to get a bigger file
- Use the original photo from your phone or camera, not a copy saved from Instagram or a messaging app. Those shrink images.
- Scan at 300 dpi or more if your scanner allows it.
- On iPhone, share the photo as "Actual Size" or send the original file.
- Don't upscale a small file with an app. It adds pixels but not detail, and the print still looks soft.

> Even a modern phone photo is usually big enough for every size, as long as it's the original.
`,
  },
  {
    slug: "why-sizes-hidden",
    section,
    audience: "artist",
    title: "Why are some print sizes hidden?",
    summary: "If your file doesn't have enough pixels for a size, buyers don't see that size. Upload a bigger file to unlock it.",
    related: ["file-sizes-print-sharp", "upload-art"],
    link: { href: "/studio/art", label: "My art" },
    body: `
We check every upload against the pixels each size needs. A size the file can't print sharply is marked "Too small for this size — hidden from buyers" in the upload form, and the buy page leaves it out.

This protects you. A soft, blurry print is the fastest way to a disappointed buyer.

## To unlock a size
1. Open the piece in [My art](/studio/art).
2. Replace the image with a bigger version of the same piece (see [Which file sizes print sharp](/help/getting-started/file-sizes-print-sharp)).
3. Save. The preview shows which sizes are now sharp.

If a file is too small even for ${SMALLEST}, it can't be listed. Try the original photo or a bigger scan.

Pieces uploaded before this check existed show every size.
`,
  },
  {
    slug: "first-qr-code",
    section,
    audience: "artist",
    title: "Making your first QR code",
    summary: "Open QR codes in the Studio, pick a piece and a look, and download a PDF. Print it at 100% and hang it beside the painting.",
    popular: 2,
    faq: true,
    link: { href: "/studio/qr", label: "Open QR codes" },
    related: ["hanging-codes", "qr-templates", "printing-sheets"],
    body: `
Every piece on your page gets its own code. A buyer scans it, lands on that piece's buy page, picks a size and pays. We print and ship.

## Steps
1. In the Studio, open [QR codes](/studio/qr).
2. Pick the piece. Codes appear once a piece is approved.
3. Pick a look: gallery label, sticker, market tag or show poster.
4. Optional: add the venue or event, a scan discount, or an end date.
5. Check the **Will it scan?** panel. It warns you if the colors are too close or the code is too small.
6. Click **Download PDF** and print it at 100% scale (not "fit to page").

The code is saved when you download or save it. You'll find it later in [My codes](/studio/codes), where you can change what it does even after printing.

> Have several pieces? **Print all my codes** makes one PDF with a code for every piece, in the same look.
`,
  },
  {
    slug: "hanging-codes",
    section,
    audience: "artist",
    title: "Hanging codes in cafés, markets and shows",
    summary: "Hang the code right beside the piece at about chest height, in good light, and protect it from hands and weather. Then test it with your own phone.",
    related: ["first-qr-code", "qr-templates", "scan-tracking", "bulk-prints"],
    link: { href: "/studio/qr", label: "Open QR codes" },
    body: `
A code only sells if people notice it and their phone can read it, whether it hangs in a Williamsburg café, at the Brooklyn Flea or in your studio during Bushwick Open Studios.

## Where to put it
- **Beside the piece, not across the room.** People scan what they're looking at. Put the label on the wall just to the right of the frame, like a gallery label.
- **Around chest height.** Somewhere between 4 and 5 feet from the floor is comfortable for most people. Don't put it behind a table or above head height.
- **One code per piece.** Each code opens that piece, so a buyer never has to hunt for it.

## Size and distance
A phone reads a code from roughly ten times its width. A 1-inch code scans from about 10 inches away, which is fine for a label people walk up to. For a door, an easel or across a booth, use the **Show poster** look. The QR Studio shows the scan distance for each format.

## Light and contrast
- Avoid spots with glare from a window or spotlight on glossy paper. Matte paper is easier to scan.
- Dark code on a light card is the safest. The **Will it scan?** panel flags risky color choices.
- Dim bars and restaurants: put the code where some light reaches it.

## Protecting it
- **Laminate** labels that people will touch, or that hang near coffee and sinks. Matte laminate cuts glare.
- **Outdoor markets:** laminate, and tape all four edges so the wind can't catch a corner.
- **Tape:** removable mounting putty or painter's tape is kind to café walls. Ask the venue what they allow.
- **Hang tags:** punch the hole after cutting, and use string or a small binder ring on the frame.

## Before you leave
- Scan it with your own phone from where a visitor would stand.
- Ask the café or venue to tell you if a label goes missing.
- Add the venue name to the code (in QR Studio or [My codes](/studio/codes)) so your scan stats show which wall is working.

> Hosting a market or show? [Bulk prints](/help/selling/bulk-prints) lets you order your own prints at cost, with matching hang tags.
`,
  },
  {
    slug: "design-your-page",
    section,
    audience: "artist",
    title: "Designing your artist page",
    summary: `Pick an accent color, a banner, a layout and up to ${MAX_PINNED} pinned pieces. Changes show live before you save.`,
    related: ["link-in-bio", "collections", "medals"],
    link: { href: "/studio/design", label: "Design your page" },
    body: `
Your page at theartfinity.com/@yourhandle is what buyers see when they scan. Open [My page](/studio/page) to edit your name, city, bio and photo, then **Design** for the look.

## What you can change
- **Accent color:** ${PAINT_COUNT} paint colors to pick from.
- **Banner:** your best seller (picked for you), a piece of yours, or a solid paint color.
- **Layout:** ${LAYOUT_NAMES}.
- **Pinned pieces:** up to ${MAX_PINNED} pieces that always show first.
- **Medals and sales count:** show or hide them. See [Medals](/help/trust/medals).

The preview updates as you go. Press save and your page is updated right away.

> Group pieces into series with [Collections](/help/selling/collections). They get their own tab and link on your page.
`,
  },
  {
    slug: "link-in-bio",
    section,
    audience: "artist",
    title: "Your link-in-bio page",
    summary: "One link for your Instagram or TikTok bio: your socials, any links you like, and your prints. It lives at theartfinity.com/@yourhandle/links.",
    related: ["share-kit", "design-your-page", "followers-newsletter"],
    link: { href: "/studio/links", label: "Open Links" },
    body: `
Social apps give you one link. Your links page holds everything behind it.

## What's on it
- **Socials:** icons at the top. They also show on your artist page.
- **Links:** big buttons to anything you like, with your own labels. Drag or use the arrows to reorder.
- **Your prints:** your newest work, ready to buy.
- **Follow:** visitors can leave their email to hear about new work.

## Set it up
1. Open [Links](/studio/links) in the Studio.
2. Add your socials and links. The live preview shows the page as you build it.
3. Pick the background and colors. If text gets hard to read, the editor tells you.
4. Copy **Your link for bios** and paste it into Instagram, TikTok or wherever you post.

Visits from your links page show up in [Analytics](/help/growing/analytics).
`,
  },
];
