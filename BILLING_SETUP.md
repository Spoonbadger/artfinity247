# Infinity billing setup (Stripe Billing)

Infinity is a monthly subscription sold through Stripe Checkout and managed in the Stripe Customer Portal. The code is in `lib/billing.ts`; the price and split live in `lib/plans.ts` (`PRO`).

How it fits together: a subscription only moves `Artist.proUntil`. While it's active, `proUntil` is the end of the paid period plus 3 grace days. If the artist cancels, `proUntil` stays at the end of the period they paid for. Every Infinity feature, and the split saved on each new order, checks `isProActive(proUntil)`. Past orders keep their split.

Without `STRIPE_SECRET_KEY`, on localhost or a staging site with `ALLOW_TEST_CHECKOUT=1`, billing is **simulated**. /studio/infinity then shows test buttons: Subscribe, Cancel, Payment failed, Payment works and End now. Simulation never runs on a Vercel production deploy.

## 1. Product and prices

In Stripe, go to **Product catalog → Add product**:

1. Name it **Artfinity Infinity**. Set the tax code to *Software as a service (SaaS) – business use* (`txcd_10103001`), or whatever code your accountant picks.
2. Add a **recurring monthly price** of **$20.00** (it must match `PRO.priceCents` in `lib/plans.ts`). Set tax behavior to **Exclusive**.
3. Add a **recurring yearly price** of **$200.00/year** (it must match `PRO.yearlyCents`). Tax behavior **Exclusive**.
4. Copy each Price id (`price_…`) into the env vars below.

If `STRIPE_INFINITY_PRICE_ID` or `STRIPE_INFINITY_YEARLY_PRICE_ID` isn't set, Checkout builds that price inline from `lib/plans.ts`. That works, but every checkout then creates a new Price, so set the id for production.

**Changing the price or the split:** edit `PRO` in `lib/plans.ts`, or set `NEXT_PUBLIC_INFINITY_PRICE_CENTS`, `NEXT_PUBLIC_INFINITY_YEARLY_CENTS` or `NEXT_PUBLIC_INFINITY_SPLIT` and rebuild. For a new price, create a new Price in Stripe and update the env var. Existing subscribers stay on their old Price until you migrate them in Stripe.

## 2. Stripe Tax

Checkout turns on `automatic_tax` for subscriptions whenever Stripe Tax is on in the app (`STRIPE_TAX` isn't `off`). It asks for a billing address so Stripe can work out the tax.

- In Stripe, go to **Settings → Tax**: switch it on, set the head office address, and add registrations for the states where you collect.
- To turn tax off for subscriptions only, set `STRIPE_BILLING_TAX=off`.
- `STRIPE_INFINITY_TAX_CODE` overrides the tax code used for the inline price.

## 3. Customer Portal

In Stripe, go to **Settings → Billing → Customer portal**:

- **Turn on:** update payment methods, view invoice history, and update billing address and tax id.
- **Cancellations:** on, with mode **At end of billing period** (Artfinity promises Infinity until then). Proration: none.
- **Switch plans:** only if you offer yearly. Add both Infinity prices to the product list.
- **Business information:** set the terms link to `https://theartfinity.com/artist-terms-and-agreement` and the privacy policy link.
- Default return URL: `https://theartfinity.com/studio/infinity`.
- Optional: save the setup as a named configuration and put its id (`bpc_…`) in `STRIPE_PORTAL_CONFIGURATION_ID`.

## 4. Webhook

In Stripe, go to **Developers → Webhooks → Add endpoint**:

- URL: `https://theartfinity.com/api/webhook/billing`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- Copy the signing secret (`whsec_…`) into `STRIPE_BILLING_WEBHOOK_SECRET`.

Keep the orders endpoint (`/api/webhook`, `STRIPE_WEBHOOK_SECRET`) as it is. It ignores subscription checkouts. Don't add the subscription and invoice events to it.

Also recommended, under **Settings → Billing**:

- **Subscriptions and emails:** turn on Smart Retries and failed-payment emails. Artfinity also emails the artist once per failed invoice and raises a low-priority admin alert.
- **If all retries fail:** **cancel the subscription**. Infinity then ends, and new orders pay the Free split.

Local testing with the Stripe CLI:

```
stripe listen --forward-to localhost:3000/api/webhook/billing
```

Put the `whsec_…` it prints into `STRIPE_BILLING_WEBHOOK_SECRET`.

## 5. Env vars

| Var | Needed | What it does |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | yes | Already used for orders. Turns real billing on. |
| `STRIPE_BILLING_WEBHOOK_SECRET` | yes | Signing secret of the `/api/webhook/billing` endpoint. |
| `STRIPE_INFINITY_PRICE_ID` | recommended | Monthly Price id. Without it, an inline price comes from `lib/plans.ts`. |
| `STRIPE_INFINITY_YEARLY_PRICE_ID` | recommended | Yearly Price id. Without it, an inline yearly price comes from `lib/plans.ts`. |
| `STRIPE_PORTAL_CONFIGURATION_ID` | optional | A named Customer Portal configuration. |
| `STRIPE_BILLING_TAX` | optional | `off` turns automatic tax off for subscriptions only. |
| `STRIPE_INFINITY_TAX_CODE` | optional | Tax code for the inline price (default `txcd_10103001`). |
| `NEXT_PUBLIC_INFINITY_PRICE_CENTS` | optional | Overrides `PRO.priceCents` (keep it equal to the Stripe Price). |
| `NEXT_PUBLIC_INFINITY_YEARLY_CENTS` | optional | Overrides `PRO.yearlyCents` (keep it equal to the Stripe Price). |
| `NEXT_PUBLIC_INFINITY_SPLIT` | optional | Overrides `PRO.split` (between 0.6 and 0.9). Applies to new orders only. |

The **Integrations** panel on the admin dashboard shows whether billing is set up.

## 6. How referral months and subscriptions stack

- **Subscribing with free months left** (from referrals or an admin grant, at least 49 hours of them): the subscription starts with `trial_end` set to the current `proUntil`. No charge happens until the free months run out.
- **Earning months while subscribed:** `proUntil` grows first. Then the subscription's next charge moves to the new `proUntil` minus the grace days (`trial_end`, no proration), so the artist is never charged for time they already have.
- **A later `proUntil` wins:** a subscription event never cuts back a `proUntil` that referrals or an admin pushed later.

## 7. Admin

- **/admin/artists/[id]** has an **Infinity billing** card showing status, subscription, period end, failures and customer, with links to Stripe.
  - Owners and admins (the `money` role) can **Cancel at period end**, **Undo cancel**, **Cancel now** (no refund; refund in Stripe if one is owed) and **Sync from Stripe**.
  - **End Infinity** is blocked while a paid subscription is live: cancel the subscription first.
- **/admin** shows Infinity MRR next to the business numbers: paying subscribers × price, with yearly counted at a twelfth of its price and subscribers still in free months left out.

## 8. Going live checklist

1. Products and prices created, and the Price ids set.
2. Stripe Tax on, with registrations.
3. Customer Portal configured to cancel at period end.
4. Webhook endpoint added with the six events, and `STRIPE_BILLING_WEBHOOK_SECRET` set.
5. Test mode end to end with test keys:
   1. Subscribe with card `4242 4242 4242 4242`.
   2. Check that Studio shows "Infinity until … (renews)".
   3. Cancel in the portal and check that it shows "Cancels on …".
   4. Use card `4000 0000 0000 0341` (it attaches but then fails) and trigger the renewal with a test clock. Check for the payment-failed banner and the admin alert.
6. Swap in the live keys and the live webhook secret.

## 9. How the payment pages look (Stripe Dashboard, all payments)

Stripe hosts the payment page, the receipts and the billing portal, so their look and wording live in the Stripe
Dashboard, not in the code. Set these once (in test mode and again in live mode) for every Artfinity payment: buyer
prints, Infinity, painting scans, printed QR codes and bulk prints.

| Where in the Dashboard | Set it to |
|---|---|
| Settings → Business → **Public details** | Business name **Artfinity**. Support email **support@theartfinity.com**. Website **https://theartfinity.com**. Terms of service **/terms-and-conditions** and privacy policy **/privacy-policy** (full https links). |
| Settings → Business → **Branding** | Icon: the square Artfinity mark (`public/` app icon, 512 px). Logo: the Artfinity wordmark. Brand colour **#8b2a4b** (Garnet). Accent colour **#2e1219** (black cherry ink). |
| Settings → Payments → **Checkout and Payment Links** | Turn on **Contact information** and **Legal policies**, so the terms and privacy links show under the Pay button. Turn on the **refund policy** and say: damaged, misprinted or wrong prints are reprinted free within 14 days of delivery (`HELP_DAYS_AFTER_DELIVERY`); no change-of-mind returns, each print is made to order. Leave "require agreement to terms" off: the code doesn't send `consent_collection`. |
| Settings → Business → **Statement descriptor** | Statement descriptor **ARTFINITY**, shortened descriptor **ARTFINITY**. Checkout adds the order code as a suffix, so cards show `ARTFINITY* XX1KP4` (prints and bulk), the CP-code for printed QR codes and the SC-code for scans. Keep the shortened one to 10 characters or fewer. |
| Settings → Customer emails | Turn on **Successful payments** and **Refunds**. Under Billing, turn on **Email finalized invoices** and **failed payment** emails, so Infinity subscribers get Stripe's receipt with the amount and tax every month. |
| Settings → Billing → **Customer portal** | Same branding applies. Headline "Artfinity Infinity". See section 3 for the cancel settings. |
| Settings → Payments → **Payment methods** | Cards, **Apple Pay** and **Google Pay** on (the checkout page promises these). Apple Pay needs the domain verified: Settings → Payment method domains → add theartfinity.com. |

What the code already sends on every Checkout Session (so nobody needs to set it in the Dashboard): line items with the
print image and "Print — title by artist, size", `submit_type: "pay"`, US shipping address collection (prints), the
buyer's email when known, a delivery-date note above the address and a reprint note under the button (`custom_text`),
the order code in `payment_intent_data.description`, a 2-hour expiry, and Stripe Tax exactly as before (lib/tax.ts).
Promotion codes are off for prints.
