import type { HelpArticle } from "../types";
import {
  BULK_FEE, BULK_TABLE, BULK_TIER_TEXT, EDITION_MAX, EDITION_MIN, EXAMPLE, FREE_PCT, LAST_FEW, PRICE_TABLE, PRO_CAP_NOTE, PRO_PCT, PRO_PRICE,
  RETURN_WINDOW_DAYS,
} from "../facts";

const section = "selling" as const;

export const selling: HelpArticle[] = [
  {
    slug: "set-prices",
    section,
    audience: "artist",
    title: "Setting your prices",
    summary: "You set a price for each print size, from Artfinity's lowest price up. Frames are priced by Artfinity, and US shipping is always free for buyers.",
    popular: 7,
    link: { href: "/studio/art", label: "My art" },
    related: ["what-you-earn", "price-guidance", "frames"],
    body: `
Each piece has its own price for each size. The upload form shows what you earn per print as you type.

## Lowest prices
${PRICE_TABLE}

You can't go below the lowest price for a size. It covers printing, packing and shipping.

## What else to know
- **Frames:** buyers can add one. Artfinity sets the frame price, and it's the same for every artist.
- **Shipping:** free for US buyers. It's part of the print cost, so it's never added at checkout.
- **Sales tax:** added at checkout where required. It never comes out of your share.
- **Scan discounts** come off the price you set. See [Scan discounts](/help/qr-codes/scan-discounts).

## Changing a price
Open the piece in [My art](/studio/art), change the price and save. New orders use the new price. Orders already placed keep theirs.
`,
  },
  {
    slug: "what-you-earn",
    section,
    audience: "artist",
    title: "What do I earn per sale?",
    summary: `After printing, shipping and payment costs, you get ${FREE_PCT} of the profit (${PRO_PCT} on Infinity). A ${EXAMPLE.size} print at ${EXAMPLE.price} pays you ${EXAMPLE.free}.`,
    popular: 2,
    faq: true,
    link: { href: "/studio/sales", label: "See your sales" },
    related: ["set-prices", "when-paid", "infinity-plan", "scan-discounts"],
    body: `
## How it's worked out
For every print sold, we take out what that order costs:
- Printing, packing and shipping (and the frame, if the buyer picked one)
- The card payment fee
- A small hosting fee per print

What's left is the profit. You get **${FREE_PCT}** of it on the Free plan, or **${PRO_PCT}** on Infinity${PRO_CAP_NOTE}. Artfinity keeps the rest.

## A worked example
Say you sell a ${EXAMPLE.size} print. The lowest price is ${EXAMPLE.base}, and you add ${EXAMPLE.markup}.

| | Amount |
|---|---|
| Buyer pays | ${EXAMPLE.price} |
| Printing, packing, shipping | −${EXAMPLE.cost} |
| Payment fee | −${EXAMPLE.fee} |
| Hosting | −${EXAMPLE.hosting} |
| **Profit** | **${EXAMPLE.profit}** |
| **You get (${FREE_PCT}, Free)** | **${EXAMPLE.free}** |
| You'd get on Infinity (${PRO_PCT}) | ${EXAMPLE.pro} |

At the lowest price with no markup, the same print pays you ${EXAMPLE.baseArtist}. With a 10% scan discount, the buyer pays ${EXAMPLE.offPrice} and you get ${EXAMPLE.offArtist}.

> Every extra dollar you add to the price is mostly profit, so pricing up raises your share fast.

## Good to know
- Your split is locked when the order is placed. Going on or off Infinity later doesn't change past sales.
- Each sale waits ${RETURN_WINDOW_DAYS} days before it's counted as available. See [When do I get paid?](/help/getting-paid/when-paid).
- Costs can change with supplier prices and payment fees. Each sale's costs and your share are listed in [Money](/studio/money).
- The calculator on [Sell with us](/sell-with-us) runs the same math.
`,
  },
  {
    slug: "limited-editions",
    section,
    audience: "artist",
    title: "Limited editions and certificates",
    summary: `Make a piece a limited edition of ${EDITION_MIN} to ${EDITION_MAX} prints. Each print is numbered, comes with a certificate of authenticity, and the piece sells out at the last number.`,
    link: { href: "/studio/art", label: "My art" },
    related: ["certificates", "bulk-prints", "set-prices"],
    body: `
Pieces are open editions by default: they print forever. A limited edition caps the total.

## How it works
- Pick **Limited edition of** and a number from ${EDITION_MIN} to ${EDITION_MAX} when you upload or edit a piece.
- The count covers all sizes, framed or not. An edition of 25 means 25 prints in total.
- Prints are numbered 1, 2, 3 and so on in order of sale. Two buyers can never get the same number.
- When ${LAST_FEW} or fewer are left, buyers see that it's nearly gone. At the last number it shows as sold out.
- Your own [bulk prints](/help/selling/bulk-prints) use numbers too.

## Locked once a print sells
You can switch between open and limited, or change the number, until the first print sells. After that the edition is locked, so collectors can trust the count.

## Certificates
Every limited-edition print gets a certificate of authenticity with the piece, your name, its print number and a certificate number. Buyers open and print it from their order page. Anyone can check a certificate number at theartfinity.com/certificate/verify. You can see each buyer's certificate in [Customers](/studio/customers).
`,
  },
  {
    slug: "collections",
    section,
    audience: "artist",
    title: "Collections",
    summary: "Group pieces into a series, a place or a season. Each collection gets its own link and shows on your page in the order you choose.",
    link: { href: "/studio/collections", label: "Open Collections" },
    related: ["design-your-page", "share-kit"],
    body: `
## Make one
1. Open [Collections](/studio/collections) and name a new collection.
2. Add a line about it if you like, for example "Painted on walks along the East River, spring 2026."
3. Tap pieces to add or take them out.
4. Drag, or use the arrows, to sort pieces and collections.

## Where it shows
Collections get their own tab on your artist page, and each one has its own link (theartfinity.com/@yourhandle/collections/...) to share on its own.

A piece can be in more than one collection.
`,
  },
  {
    slug: "bulk-prints",
    section,
    audience: "artist",
    title: "Bulk prints at cost for markets",
    summary: `Order your own prints at cost to sell in person, plus a ${BULK_FEE} handling fee per order. Bigger orders get a discount: ${BULK_TIER_TEXT}.`,
    link: { href: "/studio/bulk", label: "Open Bulk prints" },
    related: ["hanging-codes", "limited-editions", "price-guidance"],
    body: `
Selling at the Brooklyn Flea, Smorgasburg or a holiday market? Order a stack of your own prints at what they cost us to make, and keep everything you sell them for.

## Prices
${BULK_TABLE}

- **Handling:** ${BULK_FEE} once per order. Shipping is included.
- **Volume discount:** ${BULK_TIER_TEXT}, taken off the print cost.

The order page shows your total, the cost per print all in, and what you keep at the price you plan to charge.

## Good to know
- Sizes your file can't print sharply are greyed out.
- Bulk prints don't count as sales or earnings, and they don't count toward medals.
- They do use up numbers in a [limited edition](/help/selling/limited-editions).
- Tick **Include matching QR hang tags** to print market tags for the same pieces, so people who don't buy on the spot can scan and order later.
`,
  },
  {
    slug: "price-guidance",
    section,
    audience: "artist",
    title: "How should I price my prints?",
    summary: "Start from what similar work sells for. The upload form shows the middle range of other artists' prices for each size, once there's enough data.",
    link: { href: "/studio/art/new", label: "Upload a piece" },
    related: ["set-prices", "what-you-earn", "infinity-plan"],
    body: `
There's no single right price, but a few things help.

## The price guide
When there's enough data, the upload form shows what similar work sells for at each size: the middle half of live prices on other artists' work. Sizes with too few pieces show no range yet.

## Rules of thumb
- **Bigger sizes should pay more.** Buyers expect it, and the extra is mostly profit for you.
- **Price above the lowest price.** At the floor, your share is small. Even a few dollars more makes a real difference (see [What do I earn per sale?](/help/selling/what-you-earn)).
- **Limited editions can cost more** than open editions. Collectors pay for scarcity.
- **Keep prices consistent** across similar pieces so buyers trust them.
- **Leave room for a scan discount** if you plan to offer one at events.

> Selling in person? [Bulk prints](/help/selling/bulk-prints) at cost leave you room for a market price that still pays well.
`,
  },
];
