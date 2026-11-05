import type { HelpArticle } from "../types";
import { LATE_AFTER_DAYS, PAYOUT_DAY, RETURN_WINDOW_DAYS } from "../facts";

const section = "getting-paid" as const;

export const gettingPaid: HelpArticle[] = [
  {
    slug: "when-paid",
    section,
    audience: "artist",
    title: "When do I get paid?",
    summary: `Each sale is held ${RETURN_WINDOW_DAYS} days for returns. Each month's earnings are paid by the ${PAYOUT_DAY} of the following month.`,
    popular: 1,
    faq: true,
    link: { href: "/studio/money", label: "Open Money" },
    related: ["how-payouts-reach-you", "what-you-earn", "payout-late"],
    body: `
## The ${RETURN_WINDOW_DAYS}-day hold
Every sale shows as **pending** for ${RETURN_WINDOW_DAYS} days after the order. That's our return window, so a damaged print can be reprinted or refunded before the money is counted. After that it shows as **available**.

## Payday: the ${PAYOUT_DAY}
Earnings are paid monthly. All of a month's sales are paid by the ${PAYOUT_DAY} of the next month. For example, everything you sell in March is paid by April ${PAYOUT_DAY}.

Sales from the last days of a month may still be inside the ${RETURN_WINDOW_DAYS}-day window on the ${PAYOUT_DAY}. They're still in that month's payout.

## Where to see it
[Money](/studio/money) shows what's pending, what's coming in the next payout and when, every past payout, and each sale with its costs and your share. We email you when a payout is sent.

You don't need to request a payout. Artfinity sends them automatically.
`,
  },
  {
    slug: "how-payouts-reach-you",
    section,
    audience: "artist",
    title: "How payouts reach you: Venmo or Stripe",
    summary: "Connect your bank through Stripe in Money → Get paid for automatic payouts, or add your Venmo handle and we'll send it there.",
    popular: 5,
    faq: true,
    link: { href: "/studio/money", label: "Open Money" },
    related: ["when-paid", "change-venmo", "taxes"],
    body: `
## Automatic payouts with Stripe
Connect your bank through Stripe in **[Money](/studio/money) → Get paid**. Stripe asks for a few details to confirm who you are and where to send money. Once Stripe says your account is ready, each monthly payout goes to your bank automatically.

Artfinity never sees your full bank details. Stripe handles them.

## Venmo
Prefer Venmo? Add your Venmo handle in [My page](/studio/page) and we'll send your monthly payout there. Artists who haven't connected Stripe are paid by Venmo.

If you have neither set up, Money shows a reminder. Your earnings wait for you, so nothing is lost. Add a payout method before the ${PAYOUT_DAY} so the payout isn't held up.

## Changing where you're paid
- Changing your Venmo needs an email confirmation. See [Changing your Venmo](/help/account/change-venmo).
- Questions about a payout method? [Message us](/contact).
`,
  },
  {
    slug: "payout-late",
    section,
    audience: "artist",
    title: "My payout hasn't arrived",
    summary: `Check your Venmo handle or Stripe connection in Money first. If a payout is more than ${LATE_AFTER_DAYS} days past the ${PAYOUT_DAY}, Money flags it and we're on it. Message us any time.`,
    link: { href: "/studio/money", label: "Open Money" },
    related: ["when-paid", "how-payouts-reach-you"],
    body: `
## Check these first
1. **Is it after the ${PAYOUT_DAY}?** Payouts go out by the ${PAYOUT_DAY} of the month after the sales.
2. **Is your payout method right?** Look at [Money](/studio/money). A wrong or missing Venmo handle, or an unfinished Stripe connection, holds things up.
3. **Did you change your Venmo recently?** The change only applies after you click the confirmation link we email you.
4. **Did the sale clear?** Sales show as pending for ${RETURN_WINDOW_DAYS} days.

## Late payouts
If a month is still unpaid ${LATE_AFTER_DAYS} days after the ${PAYOUT_DAY}, Money shows a "late" notice. We see it too. You can also [message us](/contact) and a real person will look into it.
`,
  },
  {
    slug: "taxes",
    section,
    audience: "artist",
    title: "Do I pay taxes on my earnings?",
    summary: "Yes, you report your own income. Artists are independent sellers and Artfinity doesn't withhold taxes. Sales tax on orders is handled at checkout and never comes out of your share.",
    faq: true,
    link: { href: "/studio/money", label: "Open Money" },
    related: ["when-paid", "sales-tax"],
    body: `
## Income tax
You're an independent seller, not an employee. You report the income you get from Artfinity and pay any taxes on it. Artfinity doesn't withhold taxes for you.

[Money](/studio/money) lists every sale with its costs and your share, which helps when you do your taxes. Keep your own records too. If you're not sure what to report, ask a tax professional.

Your legal name and state in **Account details** (in My page) are private. They're used for payouts and tax, never shown on your public page.

## Sales tax
Buyers pay sales tax at checkout where the law requires it. Artfinity collects it as the seller of the print, and it never comes out of your share.
`,
  },
  {
    slug: "closing-and-earnings",
    section,
    audience: "artist",
    title: "What happens to my earnings if I close my account?",
    summary: "You still get paid. Unpaid earnings go out on the normal monthly schedule, even after your page is offline.",
    link: { href: "/studio/page", label: "My page" },
    related: ["close-account", "when-paid"],
    body: `
Closing your account takes your page, art and codes offline right away, but it doesn't cancel what you've earned.

- Sales you've already made are paid on the usual schedule: each month's earnings by the ${PAYOUT_DAY} of the following month.
- Orders already placed are still printed and shipped.
- Your past sales stay on record.

Keep your payout method working until your last payout arrives. If you need to change it after closing, [message us](/contact).

See [Closing your account](/help/account/close-account) for the steps. Changed your mind? [Contact us](/contact) to reopen.
`,
  },
];
