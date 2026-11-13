import type { HelpArticle } from "../types";
import {
  DELIVERY_MAX, DELIVERY_MIN, EDITION_MAX, FRAME_COLOR_NAMES, HELP_DAYS_AFTER_DELIVERY, MAX_PHOTOS, PRICE_TABLE, PRINT_BUSINESS_DAYS, REPRINT_REASON_TEXT,
  SHIP_BUSINESS_DAYS, SIZE_NAMES,
} from "../facts";

const section = "buyers" as const;
const SUPPORT = "support@theartfinity.com";

export const buyers: HelpArticle[] = [
  {
    slug: "shipping-delivery",
    section,
    audience: "buyer",
    title: "How long does shipping take?",
    summary: `Every print is made to order. Printing takes about ${PRINT_BUSINESS_DAYS.min}–${PRINT_BUSINESS_DAYS.max} business days and shipping about ${SHIP_BUSINESS_DAYS.min}–${SHIP_BUSINESS_DAYS.max}. US shipping is free.`,
    popular: 1,
    faq: true,
    related: ["order-status", "damaged-print", "sales-tax"],
    body: `
## Timing
- **Printing:** about ${PRINT_BUSINESS_DAYS.min}–${PRINT_BUSINESS_DAYS.max} business days. Each print is made just for you.
- **Shipping:** about ${SHIP_BUSINESS_DAYS.min}–${SHIP_BUSINESS_DAYS.max} business days.
- **In total:** roughly ${DELIVERY_MIN}–${DELIVERY_MAX} business days from your order.

The buy page and your order confirmation show an estimated delivery date range. Business days are Monday to Friday. Holidays and carrier delays can add time, so dates are estimates.

## Where we ship
US addresses only, for now. US shipping is free and is never added at checkout.

## Tracking
When your print ships, we email you the carrier and tracking number. See [Where's my order?](/help/buyers/order-status)
`,
  },
  {
    slug: "sales-tax",
    section,
    audience: "buyer",
    title: "Is sales tax added at checkout?",
    summary: "Yes, where the law requires it. Prices on the site are before tax. Checkout adds your state and local tax from the shipping address, and the total you see there is what you pay.",
    faq: true,
    related: ["shipping-delivery", "taxes"],
    body: `
Prices on artist pages and buy pages are before tax. At checkout, sales tax is worked out from your shipping address and added where the law requires it. The total on the checkout page is the price you pay, with no surprises after.

Shipping in the US is free, so there's no shipping charge on top.

Sales tax goes to the state. It never comes out of the artist's share.
`,
  },
  {
    slug: "print-quality",
    section,
    audience: "buyer",
    title: "What paper and print quality do you use?",
    summary: "12-color giclée prints on smooth matte, FSC-certified 310gsm archival paper, in four sizes from 5 × 7 to 18 × 24 inches.",
    faq: true,
    related: ["frames", "wrong-size", "file-sizes-print-sharp"],
    body: `
## The print
- 12-color giclée print on smooth matte, FSC-certified 310gsm archival paper
- Keeps the artwork's original proportions within the size you pick
- Includes a ½-inch handling border for safe production and framing

## Sizes
${SIZE_NAMES}. We only offer the sizes the artist's file can print sharply, so every size you see will look crisp.

## Prices
Artists set their own prices. Here's where each size starts:

${PRICE_TABLE}
`,
  },
  {
    slug: "frames",
    section,
    audience: "buyer",
    title: "Can I get my print framed?",
    summary: `Yes. Add a ${FRAME_COLOR_NAMES} frame on the buy page. It's made for your print's size and arrives ready to hang.`,
    related: ["print-quality", "shipping-delivery"],
    body: `
Turn on the frame option on the buy page and pick a color: ${FRAME_COLOR_NAMES}. The frame is made for the size you choose and arrives ready to hang.

Frames are priced by Artfinity, the same for every artist. The buy page shows the framed price before you pay.

Prefer to frame it yourself? Every print has a ½-inch handling border, which makes framing easier.
`,
  },
  {
    slug: "damaged-print",
    section,
    audience: "buyer",
    title: "My print arrived damaged or wrong",
    summary: `We reprint it free. Within ${HELP_DAYS_AFTER_DELIVERY} days of delivery, tap "Problem with your print?" in your shipping email, add a photo, and we'll make it right. No need to send it back.`,
    popular: 2,
    faq: true,
    link: { href: "/return-policy", label: "Return policy" },
    related: ["returns", "order-status", "contact-us"],
    body: `
Damaged in shipping, a misprint or color problem, or the wrong item? We'll fix it at no cost to you.

## How to ask for a reprint
1. Open your shipping email (or your order page) and tap **Problem with your print?**
2. Pick what went wrong: ${REPRINT_REASON_TEXT}.
3. Choose which prints are affected and add up to ${MAX_PHOTOS} photos.
4. Send it. Our support team reviews every request and emails you.

You can ask within ${HELP_DAYS_AFTER_DELIVERY} days of delivery. You don't need to send the print back.

## What happens next
We reprint and reship it free. If a reprint won't fix it, we refund you to your original payment method.

No email handy? Write to [${SUPPORT}](mailto:${SUPPORT}) with your order number and a photo.
`,
  },
  {
    slug: "wrong-size",
    section,
    audience: "buyer",
    title: "I ordered the wrong size",
    summary: "Because every print is made to order, we can't exchange or refund a wrong size choice. Check the inches on the size tiles before you buy.",
    related: ["returns", "print-quality"],
    body: `
Each print is made just for you once you order, so a size choice is final. We can't take returns or exchanges for picking the wrong size.

## Before you buy
- Each size tile on the buy page shows the print's size in inches.
- Measure the wall or frame first. A sheet of printer paper is 8.5 × 11 inches, close to the Medium print, if you want something to hold up.

If we sent a different size from the one you ordered, that's our mistake. See [My print arrived damaged or wrong](/help/buyers/damaged-print).
`,
  },
  {
    slug: "returns",
    section,
    audience: "buyer",
    title: "Can I return a print?",
    summary: "We can't take returns for a change of mind, because prints are made to order. Damaged, misprinted or wrong prints are reprinted free, or refunded.",
    link: { href: "/return-policy", label: "Return policy" },
    related: ["damaged-print", "wrong-size"],
    body: `
- **Damaged, misprinted or wrong:** we reprint and reship it free, or refund you if a reprint won't fix it. See [My print arrived damaged or wrong](/help/buyers/damaged-print).
- **Change of mind or wrong size choice:** no returns or exchanges. Each print is made just for you.
- **Shipping on reprints:** free, like all US shipping.

The full [return policy](/return-policy) has the details.
`,
  },
  {
    slug: "order-status",
    section,
    audience: "buyer",
    title: "Where's my order?",
    summary: "Your receipt email has a link to your order page. We email you again when it ships, with tracking, and when it's delivered.",
    popular: 3,
    faq: true,
    related: ["shipping-delivery", "damaged-print", "certificates"],
    body: `
## The emails you'll get
1. **Receipt:** right after you buy, with a link to your order page
2. **Shipped:** when your print leaves us, with the carrier and tracking number
3. **Delivered:** when it arrives

The order page shows what you bought, the estimated delivery dates and, for limited editions, your certificate.

## Can't find the emails?
- Check your spam or promotions folder for mail from Artfinity.
- Make sure you're looking at the inbox for the email you used at checkout.
- Still nothing? Write to [${SUPPORT}](mailto:${SUPPORT}) or [message us](/contact) with your name and the artwork.

All your orders are also in your free collection: see [Your orders and wishlist](/help/buyers/orders-and-wishlist). Have an artist account? Prints you've bought are also listed in your Studio under **My purchases**.
`,
  },
  {
    slug: "orders-and-wishlist",
    section,
    audience: "buyer",
    title: "Your orders and wishlist",
    summary: "A free, optional collection shows every order placed with your email, the artists you follow and the paintings you've saved. Sign in with a link we email you. No password, and you never need it to buy.",
    related: ["order-status", "follow-artist", "certificates"],
    link: { href: "/collector", label: "Open your collection" },
    body: `
## You never need an account to buy
Checkout works as a guest, and the links in your order emails (review, problem with your print, certificate) always work on their own. Your collection is an optional extra.

## Signing in
1. Go to [Your orders](/collector/sign-in) (it's in the menu and at the bottom of every page).
2. Enter the email you used at checkout. We email you a link.
3. Tap it within 15 minutes. Each link works once. You stay signed in on that device for 90 days, or until you sign out.

We never say whether an email has orders, so the page answers the same way for any address.

## What's in it
- **Orders:** every order placed with your email, newest first, including ones you placed as a guest before you had a collection. Each shows what you bought, its size and frame, and where it is: paid, printing, shipped (with tracking) and delivered. From there you can leave a review, report a problem with the print, open certificates for limited editions, and see the receipt.
- **Following:** the artists whose new work you get by email. Unfollow or resubscribe in one tap.
- **Wishlist:** paintings you saved with the heart, with today's starting price. Limited editions show when they've sold out.

## Saving paintings
Tap the heart on any painting or artwork card. If you're not signed in, enter your email and we send you a link: tap it and the painting is saved, and you're signed in.

## Rewards
When Artfinity runs a rewards offer (for example a discount after a number of prints), your collection shows your progress and we email you a one-time code. It's filled in at checkout while you're signed in with that email. Rewards come out of Artfinity's share, never the artist's.

## Privacy and deleting
You only ever see orders placed with the email you proved by opening the link. To delete your collection, open **Settings** in your collection. Your account and wishlist are deleted right away. Orders stay on record because we need them for accounting, and your order emails keep working. See the [privacy policy](/privacy-policy).
`,
  },
  {
    slug: "certificates",
    section,
    audience: "buyer",
    title: "Certificates of authenticity",
    summary: "Every limited-edition print comes with a numbered certificate of authenticity. Open and print it from your order page, and anyone can verify its number.",
    related: ["limited-editions", "order-status"],
    body: `
Some artists sell limited editions: only a set number of prints (up to ${EDITION_MAX}), each one numbered. If you buy one, you get a certificate.

## Your certificate
- Shows the artwork, the artist, your print number (for example "Print 8 of 25") and a certificate number
- Find it on your order page (the link in your receipt email). Open it and print it.
- Bought several prints of the same piece? Each number gets its own certificate.

## Verifying a certificate
Anyone can check a certificate number at theartfinity.com/certificate/verify. It shows the piece, the artist and the print number, never who bought it.
`,
  },
  {
    slug: "follow-artist",
    section,
    audience: "buyer",
    title: "Following an artist",
    summary: "Tap Follow on an artist's page or a buy page and enter your email. Confirm it, and you'll hear when they have new work.",
    related: ["unsubscribe", "followers-newsletter"],
    body: `
1. Tap **Follow** on the artist's page, a buy page or their links page, and enter your email.
2. We send a confirmation email. Click the link in it.
3. That's it. The artist can email you about new work.

You can also tick the follow box at checkout.

Your email goes on that artist's own list. It's never sold. Every email has an unsubscribe link. See [Unsubscribing](/help/buyers/unsubscribe).
`,
  },
  {
    slug: "unsubscribe",
    section,
    audience: "buyer",
    title: "Unsubscribing from emails",
    summary: "Every newsletter has an unsubscribe link at the bottom. One click and you won't get that artist's emails again.",
    related: ["follow-artist"],
    body: `
- **Artist newsletters:** click **unsubscribe** at the bottom of any email. Many email apps also show an unsubscribe button at the top. You won't be emailed by that artist again, even if they re-import their list.
- **Order emails** (receipt, shipped, delivered) are about your purchase, so they keep coming for that order.
- **Anything else:** write to [${SUPPORT}](mailto:${SUPPORT}) and we'll take you off.

To see, fix or delete the data we hold about you, see the [privacy policy](/privacy-policy).
`,
  },
  {
    slug: "discount-didnt-apply",
    section,
    audience: "buyer",
    title: "My scan discount didn't apply",
    summary: "Scan discounts only work when you arrive from the artist's printed code, and only while that code's offer is running.",
    related: ["scan-discounts", "order-status"],
    body: `
If you scanned a code with a discount, the buy page says your discount is applied, and checkout takes it off.

## Why it might not show
- **The offer has ended.** The artist removed the discount or turned the code off.
- **You didn't come from the code.** Discounts only apply when you arrive by scanning. Typing a discount into the web address doesn't work.

Still think something's wrong? [Message us](/contact) with the artwork and where you saw the code.
`,
  },
];
