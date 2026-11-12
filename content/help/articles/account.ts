import type { HelpArticle } from "../types";
import { PAYOUT_DAY, VENMO_CONFIRM_HOURS } from "../facts";

const section = "account" as const;

export const account: HelpArticle[] = [
  {
    slug: "login-reset-password",
    section,
    audience: "artist",
    title: "Logging in and resetting your password",
    summary: "Log in with your email and password. Forgot it? Use \"Forgot password?\" and we'll email a reset link that works for 30 minutes.",
    popular: 4,
    faq: true,
    link: { href: "/login", label: "Log in" },
    related: ["social-sign-in", "account-details", "close-account"],
    body: `
## Logging in
Go to [Log in](/login) and enter the email you signed up with and your password. Signed up with Google, Apple, Facebook or Instagram? Use that button instead. See [Signing in with Google, Apple, Facebook or Instagram](/help/account/social-sign-in).

## Forgot your password?
1. On the log-in page, tap **Forgot password?**
2. Enter the email you signed up with.
3. Open the email "Reset your Artfinity password" and follow the link to set a new one.

The link works for 30 minutes. You can ask for up to 3 reset emails an hour. No email? Check spam, and make sure it's the address you signed up with.

## Changing your password
Logged in? Open [My page](/studio/page) and choose **Change password**. Passwords need at least 8 characters.

## "This account is closed"
If you closed your account, you can't log in to the Studio. You'll still be paid what you earned. [Contact us](/contact) to reopen it.
`,
  },
  {
    slug: "social-sign-in",
    section,
    audience: "artist",
    title: "Signing in with Google, Apple, Facebook or Instagram",
    summary: "Choose \"Continue with Google\" (or Apple, Facebook, Instagram) on the log-in or sign-up page. You can connect or disconnect these, and set a password, in My page → Sign-in methods.",
    link: { href: "/studio/page#connected", label: "Sign-in methods" },
    related: ["login-reset-password", "account-details", "close-account"],
    body: `
## Signing up
On [Claim your page](/register), choose **Continue with Google** (or Apple, Facebook or Instagram). We fill in your name, email and photo from that account. You still pick your link and city and add your first piece. There's no password to make.

## Logging in
On [Log in](/login), choose the same button you signed up with. Already have a page with the same email? Google and Apple confirm your email, so they connect to your page automatically. Facebook and Instagram don't, so log in with your password first and connect them from [My page](/studio/page#connected).

## Instagram: what to know
- It only works with Instagram **professional** accounts (Creator or Business). Switching is free: in Instagram, go to Settings → Account type and tools → Switch to professional account.
- Instagram doesn't share your email, so we ask for it. That's where your sales notices go.
- We add your Instagram to your links for you.

## Apple: "Hide my email"
If you chose **Hide my email**, your account uses an Apple relay address. Our emails still reach you through Apple. To use your real address instead, change it in [Account details](/studio/page).

## Connect, disconnect, or add a password
Open [My page](/studio/page#connected) and scroll to **Sign-in methods**.
- **Connect** adds another way to log in.
- **Disconnect** removes one. You always need at least one way in, so you can't remove the last one.
- **Set a password** lets you log in with your email too. It's handy if you ever lose access to that Google, Apple, Facebook or Instagram account.

## Forgot your password?
If you signed up with Google (or Apple, Facebook, Instagram) and never set a password, "Forgot password?" emails you a reminder of which button to use instead of a reset link.

> Closed accounts can't log in either way. [Contact us](/contact) to reopen.
`,
  },
  {
    slug: "change-handle",
    section,
    audience: "artist",
    title: "Can I change my handle?",
    summary: "Not yet. Changing your handle from the Studio is coming soon. Your printed QR codes don't depend on it, so they won't break when it arrives.",
    related: ["create-your-page", "codes-never-break"],
    body: `
Your handle is the @name in your page address (theartfinity.com/@yourhandle). Changing it yourself isn't available yet. **Coming soon.**

Good to know in the meantime:
- Your **display name** (the name buyers see) can be changed any time in [My page](/studio/page).
- Your printed QR codes hold a short link, not your handle, so they'll keep working whatever your handle becomes. See [Why your codes keep working](/help/qr-codes/codes-never-break).
`,
  },
  {
    slug: "change-venmo",
    section,
    audience: "artist",
    title: "Changing your Venmo",
    summary: `Change it in My page. For your security, we email you a confirmation link (good for ${VENMO_CONFIRM_HOURS} hours). Payouts keep going to your old handle until you click it.`,
    link: { href: "/studio/page", label: "My page" },
    related: ["how-payouts-reach-you", "when-paid", "account-details"],
    body: `
1. Open [My page](/studio/page) and edit **Venmo handle**.
2. Save. If you already had a handle, we email you a confirmation link.
3. Click the link within ${VENMO_CONFIRM_HOURS} hours. Money then says "Venmo updated."

Until you click it, payouts keep going to your current handle, and [Money](/studio/money) shows that a change is waiting. This stops anyone who gets into your account from redirecting your earnings.

## If something goes wrong
- **Link expired:** change your Venmo again to get a new one.
- **"Already on another Artfinity account":** each Venmo handle can be used by one account only. [Message us](/contact) if it's yours.
- **Change it before the ${PAYOUT_DAY}** so that month's payout goes to the right place.

Getting paid through Stripe instead? See [How payouts reach you](/help/getting-paid/how-payouts-reach-you).
`,
  },
  {
    slug: "confirm-email",
    section,
    audience: "artist",
    title: "Confirming your email",
    summary: "We email you a link when you sign up or change your email. Click it to turn on payouts (Venmo and Stripe) and newsletters. The link works for 7 days; you can send a fresh one from the top of your Studio.",
    link: { href: "/studio#confirm-email", label: "Resend the link" },
    related: ["account-details", "change-venmo", "login-reset-password"],
    body: `
## Why we ask
Your email is where sales, payout notices and security emails go, so we check it's really yours before money moves. Until you confirm:
- You can use the whole Studio: add art, print codes, sell.
- Adding or changing your Venmo, connecting Stripe and sending newsletters wait.
- Your earnings are safe. They're paid out once a payout method is set.

## Confirm it
1. Open the email "Confirm your email for Artfinity".
2. Click the button. You'll see "Email confirmed".

Signed up with Google or Apple? They confirm your email for you, so there's nothing to do.

## No email, or the link expired?
- Check spam and promotions.
- At the top of any Studio page, press **Resend** in the "Confirm your email" bar. Each new link replaces the old one and works for 7 days.
- Typo in your address? Fix it in [Account details](/studio/page#account-details). We send a new link to the new address.
- Still nothing? [Contact us](/contact).
`,
  },
  {
    slug: "account-details",
    section,
    audience: "artist",
    title: "Changing your name, email or bio",
    summary: "Your public name, city, bio and photo are in My page. Your legal name, email and state are in Account details, and stay private.",
    link: { href: "/studio/page", label: "My page" },
    related: ["design-your-page", "change-venmo", "login-reset-password"],
    body: `
## Public (on your page)
In [My page](/studio/page): the name buyers see, your city, your bio and your photo. Changes show on your page as soon as you save.

## Private (never shown)
In **Account details** on the same page: your legal first and last name, email and state. They're used for payouts and tax. Your email is also where we send your sales and the address you log in with.

Each email can belong to one account only.
`,
  },
  {
    slug: "close-account",
    section,
    audience: "artist",
    title: "Closing your account",
    summary: "In My page, choose Close my account and type CLOSE. Your page, art and codes go offline right away, and you're still paid what you've earned.",
    link: { href: "/studio/page", label: "My page" },
    related: ["closing-and-earnings", "copyright", "codes-never-break"],
    body: `
## Steps
1. Open [My page](/studio/page).
2. Near the bottom, choose **Close my account**.
3. Type CLOSE and confirm.

## What happens
- Your page goes offline right away. Your art and codes stop showing to buyers, and printed codes stop opening anything.
- Orders already placed are still printed and shipped.
- Unpaid earnings are paid on the usual monthly payout, by the ${PAYOUT_DAY} of the following month.
- Past sales stay on record. We email you the details.
- Remaining personal data is removed after any unpaid earnings are paid out (see the [privacy policy](/privacy-policy)).

Just want a break? You can remove single pieces in [My art](/studio/art) instead, or turn codes off in [My codes](/studio/codes).

## Changed your mind?
[Contact us](/contact) to reopen your account. Your art comes back as it was.
`,
  },
  {
    slug: "contact-us",
    section,
    audience: "both",
    title: "How do I contact Artfinity?",
    summary: "Use the contact form, or email support@theartfinity.com about an order. A real person reads every message.",
    link: { href: "/contact", label: "Message us" },
    related: ["damaged-print", "order-status"],
    body: `
- **A problem with an order:** email [support@theartfinity.com](mailto:support@theartfinity.com) with your order number, or use the "Problem with your print?" link in your shipping email.
- **Artists and everything else:** use the [contact form](/contact). Selling, partnerships, press, or a café that wants art on its walls.
- **Copied or stolen art:** use [Report art](/report).

A real person reads every message. We answer on weekdays and are closed on weekends and holidays.
`,
  },
];
