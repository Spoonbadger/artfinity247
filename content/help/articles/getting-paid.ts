import type { HelpArticle } from "../types";
import { LATE_AFTER_DAYS, PAYOUT_DAY, RETURN_WINDOW_DAYS } from "../facts";

const section = "getting-paid" as const;

export const gettingPaid: HelpArticle[] = [
  {
    slug: "when-paid",
    section,
    audience: "artist",
    title: "When do I get paid?",
    summary: `Each sale is held ${RETURN_WINDOW_DAYS} days for returns. Each month's earnings are paid through Stripe by the ${PAYOUT_DAY} of the following month.`,
    popular: 1,
    faq: true,
    link: { href: "/studio/money", label: "Open Money" },
    related: ["how-payouts-reach-you", "what-you-earn", "payout-late"],
    body: `
## The ${RETURN_WINDOW_DAYS}-day hold
Every sale shows as **pending** for ${RETURN_WINDOW_DAYS} days after the order. That's our return window, so a damaged print can be reprinted or refunded before the money is counted. After that it shows as **available**.

## Payday: the ${PAYOUT_DAY}
Earnings are paid monthly, through Stripe to your bank. All of a month's sales are paid by the ${PAYOUT_DAY} of the next month. For example, everything you sell in March is paid by April ${PAYOUT_DAY}.

Until Stripe is connected, your earnings are held in a temporary account. Once you connect, every month that's waiting is paid by the next ${PAYOUT_DAY}. See [How payouts reach you](/help/getting-paid/how-payouts-reach-you).

Sales from the last days of a month may still be inside the ${RETURN_WINDOW_DAYS}-day window on the ${PAYOUT_DAY}. They're still in that month's payout.

## Refunds after you're paid
Sometimes a sale you were already paid for is refunded later, for a buyer return or a chargeback. Your share may then come off your next payout as a **Refund adjustment** (with the order number) on your Money page. A payout never goes below $0; anything left carries to the next one. Refunds for damaged, misprinted or wrong prints never come out of money you've been paid.

## Where to see it
[Money](/studio/money) shows what's pending, what's coming in the next payout and when, every past payout, and each sale with its costs and your share. We email you when a payout is sent.

You don't need to request a payout. Artfinity sends them automatically.
`,
  },
  {
    slug: "how-payouts-reach-you",
    section,
    audience: "artist",
    title: "How payouts reach you: Stripe",
    summary: `We pay every artist through Stripe, straight to your bank. Connect it once in Money. Until you do, your earnings are held for you.`,
    popular: 5,
    faq: true,
    link: { href: "/studio/money", label: "Open Money" },
    related: ["when-paid", "change-payout-bank", "taxes"],
    body: `
## Connect Stripe
1. Open [Money](/studio/money) and press **Connect with Stripe**.
2. Stripe opens. Fill in its short form. It takes about 5 minutes.
3. You come back to Money. Once Stripe says your account is ready, Money shows **Ready**.

You need a confirmed email first. See [Confirming your email](/help/account/confirm-email).

## What Stripe asks for
Stripe is a payments company. It asks for what US law requires to send you money:
- Your legal name, date of birth, address and phone number
- Your Social Security number (or the last 4 digits), for identity and tax
- The bank account to pay into
- Sometimes a photo of your ID

Stripe keeps these details, including the tax information a US payout needs. Artfinity never sees your full bank account or Social Security number.

## When you're paid
Each month's sales are paid by the ${PAYOUT_DAY} of the next month, as one transfer to your bank. Stripe then sends it on to your bank, which usually takes a couple of business days.

Not connected yet? Nothing is lost. Your earnings are held in your balance, and every month that's waiting is paid by the first ${PAYOUT_DAY} after you connect.

## If Stripe needs more
Sometimes Stripe asks for another detail, or reviews an account. Money says what's missing and gives you a **Finish setup** button. Your earnings stay held until it's sorted.

Questions? [Message us](/contact).
`,
  },
  {
    slug: "payout-late",
    section,
    audience: "artist",
    title: "My payout hasn't arrived",
    summary: `Check your Stripe connection in Money first. If you're connected and a payout is more than ${LATE_AFTER_DAYS} days past the ${PAYOUT_DAY}, Money flags it and we look into it.`,
    link: { href: "/studio/money", label: "Open Money" },
    related: ["when-paid", "how-payouts-reach-you"],
    body: `
## Check these first
1. **Is it after the ${PAYOUT_DAY}?** Payouts go out by the ${PAYOUT_DAY} of the month after the sales.
2. **Is Stripe connected and ready?** Look at [Money](/studio/money). Until Stripe says your account is ready, your earnings are held, not lost. Press **Connect with Stripe** or **Finish setup** there.
3. **Has it reached your bank?** Once we send a payout, Stripe usually takes a couple of business days to get it to your bank. You can check it with **Manage in Stripe** on Money.
4. **Did the sale clear?** Sales show as pending for ${RETURN_WINDOW_DAYS} days.

## Late payouts
If you're connected and a month is still unpaid ${LATE_AFTER_DAYS} days after the ${PAYOUT_DAY}, Money shows a "late" notice. We see it too. You can also [message us](/contact) and we'll look into it.
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

Your legal name and state in **Account details** (in My page) are private, never shown on your public page. When you connect Stripe for payouts, Stripe collects the tax details US payouts need.

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

- Sales you've already made are paid through Stripe on the usual schedule: each month's earnings by the ${PAYOUT_DAY} of the following month.
- Orders already placed are still printed and shipped.
- Your past sales stay on record.

Connect Stripe in [Money](/studio/money) before you close, and keep that bank account open until your last payout arrives. Already closed without it? [Message us](/contact) and we'll help.

See [Closing your account](/help/account/close-account) for the steps. Changed your mind? [Contact us](/contact) to reopen.
`,
  },
];
