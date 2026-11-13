import type { HelpArticle } from "../types";
import { EDIT_WINDOW_DAYS, FREE_PCT, NEWSLETTER_GAP_HOURS, NEWSLETTER_MAX_ART, PRO_PCT, PRO_PRICE, REFERRALS, SOURCE_NAMES } from "../facts";
import { RANGES } from "@/lib/analytics";

const section = "growing" as const;
const rangeText = RANGES.map((r) => `${r}`).join(", ").replace(/, (\d+)$/, " or $1");

export const growing: HelpArticle[] = [
  {
    slug: "share-kit",
    section,
    audience: "artist",
    title: "Your share kit",
    summary: "Ready-made story and post images, a link sticker for bios and stories, a website widget and an email signature. Every one leads straight to the print.",
    link: { href: "/studio/share", label: "Open Share kit" },
    related: ["videos", "link-in-bio", "analytics"],
    body: `
Open [Share kit](/studio/share) and pick a piece. Everything is made for that piece.

## What's in it
- **Story and post images:** each one has a QR code to the piece.
- **Links per channel:** Instagram, TikTok and the rest each get their own link, so [Analytics](/help/growing/analytics) can show which one sells.
- **Bio or story link sticker:** a "Buy a print" link to paste into a story or bio.
- **Website widget:** paste it into your own site, blog or email. For more options, see [Embed](/studio/developers).
- **Email signature:** a small "Buy a print" line. In Gmail: Settings, Signature, paste.
- **Videos:** short vertical videos of the piece, on the Infinity plan. See [Auto videos](/help/growing/videos).

> Add the piece to your [links page](/help/getting-started/link-in-bio) so your bio link always shows it.
`,
  },
  {
    slug: "videos",
    section,
    audience: "artist",
    title: "Auto videos for Reels, TikTok and Shorts",
    summary: "On Infinity, the share kit turns any piece into a 10-second vertical video with its QR link, ready for Reels, TikTok and Shorts.",
    link: { href: "/studio/share", label: "Open Share kit" },
    related: ["share-kit", "infinity-plan"],
    body: `
Videos are an Infinity tool. Pick a piece in [Share kit](/studio/share), choose a style and the on-screen words, and the video is made right in your browser. Download it and post it.

- Vertical, 10 seconds, sized for Reels, TikTok and Shorts
- Each one leads to the piece's buy page
- Some older browsers can't record video. If yours can't, the share kit tells you. Try an up-to-date Chrome, Edge or Safari.

Not on Infinity? Share Artfinity with another artist and you can get it free. See [Referrals](/help/growing/referrals).
`,
  },
  {
    slug: "followers-newsletter",
    section,
    audience: "artist",
    title: "Followers and newsletters",
    summary: `Visitors can follow you by email from your page, buy pages and links page, or at checkout. Send them a newsletter with up to ${NEWSLETTER_MAX_ART} pieces. The list is yours.`,
    link: { href: "/studio/followers", label: "Open Followers" },
    related: ["follow-artist", "unsubscribe", "share-kit"],
    body: `
## How people follow you
- The **Follow** button on your artist page, every buy page and your links page asks for an email. We send a confirmation email, and they're on your list once they click it.
- Buyers can tick a box at checkout to follow you.
- You can **import** a list you already have, if those people agreed to hear from you. Tick the consent box when you paste it. People who unsubscribed before stay unsubscribed.

## Sending a newsletter
1. Open [Followers](/studio/followers), then the **Newsletter** tab.
2. Write a subject and a short note, and pick up to ${NEWSLETTER_MAX_ART} pieces to show.
3. Send yourself a test, then send it.

You can send one newsletter every ${NEWSLETTER_GAP_HOURS} hours. Every email has an unsubscribe link, and people who unsubscribe are never emailed again.

## Your list
The list is yours. **Export CSV** downloads every follower.
`,
  },
  {
    slug: "analytics",
    section,
    audience: "artist",
    title: "Analytics: views, sources and sales",
    summary: `See views, visitors, scans and sales by day, where visitors came from (${SOURCE_NAMES.split(", ").slice(0, 3).join(", ")} and more) and your top pieces, over ${rangeText} days.`,
    link: { href: "/studio/analytics", label: "Open Analytics" },
    related: ["scan-tracking", "share-kit", "link-in-bio"],
    body: `
[Analytics](/studio/analytics) shows which walls and posts bring people in, and what they buy.

## What's there
- **Views by day:** views, visitors, scans and sales over the last ${rangeText} days
- **Where visitors came from:** ${SOURCE_NAMES}
- **Bought:** sales divided by visitors, per source
- **Top artworks:** which pieces get looked at, and which sell

Download the numbers as a file from the top of the page.

## How it's counted
- A visitor is counted once per page every 30 minutes, so refreshes don't inflate numbers.
- Your own visits, admins and bots aren't counted.
- Visitors whose browser asks not to be tracked (Do Not Track or Global Privacy Control) aren't counted.
- We keep only the site someone came from, never the full link, and no names.

For each printed code's numbers, see [Scan tracking](/help/qr-codes/scan-tracking).
`,
  },
  {
    slug: "reviews",
    section,
    audience: "artist",
    title: "Reviews",
    summary: "After a print is delivered, we email the buyer to ask how it looks on their wall. Reviews show on your page, and you can reply once to each.",
    link: { href: "/studio/reviews", label: "Open Reviews" },
    related: ["medals", "verification-badge"],
    body: `
## How reviews arrive
Once a print has had time to arrive, we email the buyer: "How does it look on your wall?" They can leave a star rating, with or without words. Only real buyers can review, through the link in their email.

## What you can do
- See every review in [Reviews](/studio/reviews). We email you when a new one comes in.
- **Reply once** to each review. Your reply shows under it on your page.

Buyers can edit their review for ${EDIT_WINDOW_DAYS} days after posting it.

## Reviews waiting on a check
If a review has a link or rough language, our moderation team takes a quick look before it goes public. You don't need to do anything. It shows up in Reviews once it's cleared, usually within a day. You can reply as soon as it's public.

## No reviews yet?
Reviews only come from delivered prints, so they start after your first sales arrive. To get there sooner, [print a QR code](/studio/qr) for your paintings, and make the [delivered email](/studio/emails) sound like you.

> A problem with a print? Buyers get a free reprint through their order page, so a damaged parcel rarely turns into a bad review.
`,
  },
  {
    slug: "referrals",
    section,
    audience: "artist",
    title: `Referrals: get ${REFERRALS.rewardMonths} months of Infinity free`,
    summary: `Share your link. For each artist who joins with it, gets a piece live and prints a code or makes a sale, you get ${REFERRALS.rewardMonths} months of Infinity.`,
    faq: true,
    link: { href: "/studio/infinity", label: "Open Infinity" },
    related: ["infinity-plan", "videos"],
    body: `
Your referral link and QR code are in [Infinity plan](/studio/infinity).

## When a referral counts
An artist who signs up with your link earns you ${REFERRALS.rewardMonths} months of Infinity once they:
1. Have a piece live on their page, and
2. Print or download a QR code, or make a sale.

## The rules
- **${REFERRALS.holdDays}-day wait:** the months count ${REFERRALS.holdDays} days after they qualify, if they still qualify.
- **Up to ${REFERRALS.maxPerMonth} rewards a month.** More than that wait for next month.
- **Up to ${REFERRALS.maxBankedMonths} months banked** ahead of today. Extra rewards wait until there's room.
- **No second accounts.** If the new account looks like the same person as you, it doesn't count.

Nothing is lost by waiting. Held rewards count later. The Infinity page lists each artist you brought and where their referral stands.

Months you earn work exactly like paid Infinity: sales made while it's active pay ${PRO_PCT}.
`,
  },
  {
    slug: "infinity-plan",
    section,
    audience: "artist",
    title: "The Infinity plan",
    summary: `Infinity is ${PRO_PRICE} a month, billed by card through Stripe. You get ${PRO_PCT} of the profit instead of ${FREE_PCT}, plus auto videos. Referral months are free and stack.`,
    link: { href: "/studio/infinity", label: "Open Infinity" },
    related: ["referrals", "videos", "what-you-earn"],
    body: `
## What you get
- **${PRO_PCT} of the profit** on every print, instead of ${FREE_PCT}
- **Auto videos** in the share kit
- **Automations** (coming soon): posting new pieces and drafting newsletters for you
- **Priority support**

Everything else, including your page, QR codes, unlimited art, collections, editions and the links page, is free on both plans.

## Is it worth it?
At ${PRO_PRICE} a month, it pays for itself after a handful of sales a month. The calculator on [Pricing](/pricing) and in [Infinity plan](/studio/infinity) shows where your break-even is.

The "Does it pay for itself?" box in [Infinity plan](/studio/infinity) runs the same math on your own last 30 days of sales: the extra share Infinity would have paid you, against ${PRO_PRICE}.

## Getting it
- **Pay by card:** in [Infinity plan](/studio/infinity), tap **Get Infinity**. Stripe operates the checkout process. Sales tax may be added depending on where you are located. Infinity turns on as soon as the payment goes through.
- **Free, through referrals:** see [Referrals](/help/growing/referrals).

Referral months stack with a subscription. If you subscribe while you still have free months, the first charge waits until they run out. Months you earn while subscribed push your next charge back, so you're never charged for time you already have.

## Managing billing
In [Infinity plan](/studio/infinity), **Manage billing** opens Stripe's billing page. Change your card, see and download invoices, or cancel there.
- **Cancel:** no more charges. Infinity stays on until the end of the period you paid for, then you're on Free. There are no partial refunds.
- **Payment failed:** you'll get an email and see a banner in Studio. Infinity stays on for a few days while the payment is retried. Update your card to keep it; otherwise your plan goes back to Free.

## Good to know
- Your split is set when each order is placed. Sales made while Infinity is active pay ${PRO_PCT}. Earlier sales keep their split, even after you subscribe or cancel.
- If Infinity ends, new orders pay ${FREE_PCT}. Your art, page, codes and links all stay.
`,
  },
  {
    slug: "customers",
    section,
    audience: "artist",
    title: "Customers, notes and thank-you notes",
    summary: "Everyone who buys a print shows up in Customers with their orders. Keep private notes and send a thank-you, even printed in the parcel.",
    link: { href: "/studio/customers", label: "Open Customers" },
    related: ["buyer-emails", "order-status", "followers-newsletter"],
    body: `
## Who shows up
Every buyer of one of your prints appears in [Customers](/studio/customers) after their order is paid: name, city, what they bought, what they spent and where each print is (paid, at the printer, shipped, delivered). Emails are partly hidden in the list; open a customer to see theirs.

No customers yet? They arrive with your first sale. Most first sales start with a [QR code](/studio/qr) next to the real painting, or your [links page](/studio/links) in your bio.

## Notes and thank-you notes
Open a customer to write to them:
- **Thank-you note:** emailed from you via Artfinity. Replies go to your inbox. Until the print ships, you can also have it printed and put in the parcel.
- **Private note:** only you see it. Good for "loves big florals" or "met at the Saturday market".

You can send up to 40 notes a day.

## Automatic emails
Buyers also get a receipt, shipped, delivered and thank-you email. You can rewrite them in [Buyer emails](/studio/emails).
`,
  },
  {
    slug: "buyer-emails",
    section,
    audience: "artist",
    title: "Emails your buyers get, in your words",
    summary: "Buyers get a receipt, a shipped email, a delivered email and a thank-you a week later. Rewrite any of them in your own voice.",
    link: { href: "/studio/emails", label: "Open Automated emails" },
    related: ["order-status", "followers-newsletter", "reviews"],
    body: `
## The four emails
- **Receipt:** right after they buy
- **Shipped:** when the print ships, with tracking
- **Delivered:** when it arrives
- **Thank-you:** 7 days after delivery

Artfinity sends all four with our standard wording. In [Automated emails](/studio/emails) you can rewrite any of them, see a live preview, or switch yours off to go back to ours.

## Placeholders
Use {buyer_first_name}, {artwork_title}, {artist_name}, {size} and {order_link}, and they're filled in for each order.

You can also write to a buyer directly from [Customers](/studio/customers).
`,
  },
];
