# Deploying Artfinity

A step-by-step guide to putting Artfinity online, written for someone who isn't a developer. Plan on an afternoon.
You click through websites and copy values from one to another. Nothing here needs a terminal except the optional
backup section.

**What runs where**

| Piece | Service | Why |
| --- | --- | --- |
| The website, its API and the scheduled jobs | **Vercel** | Builds from GitHub on every push. |
| The database | **Neon** (Postgres) | Hosted Postgres with branches (staging) and point-in-time restore (backups). |
| Images | **Cloudinary** | Vercel has no disk to keep uploads on. **Required.** |
| Email | **Resend** | Receipts, sign-in links, payout emails, admin alerts. |
| Payments and payouts | **Stripe** | Checkout, Infinity subscriptions, artist payouts (Connect). |
| Error alerts | **Sentry** (optional) | Emails you when something breaks. |
| Uptime | UptimeRobot or Better Stack (optional, free) | Pings `/api/health` and texts you if the site is down. |

Other setup guides, linked where they come up:

- [AUTH_SETUP.md](AUTH_SETUP.md): Google, Apple, Facebook and Instagram sign-in
- [BILLING_SETUP.md](BILLING_SETUP.md): Stripe Billing for the Infinity plan
- [MODERATION_SETUP.md](MODERATION_SETUP.md): automatic image checks on upload
- [IMPORT_SETUP.md](IMPORT_SETUP.md): Import from Google Drive and Dropbox in Studio
- [PEXELS_LOCAL_PROMPT.md](PEXELS_LOCAL_PROMPT.md): fetching room photos from Pexels or Pixabay (done on your computer, not on Vercel)
- [LOCAL_DEV.md](LOCAL_DEV.md): running it on your own computer

---

## 1. Accounts you need

Create these first (all have free tiers to start):

1. GitHub (the code already lives there)
2. [Vercel](https://vercel.com): sign up **with GitHub**
3. [Neon](https://neon.tech)
4. [Cloudinary](https://cloudinary.com)
5. [Resend](https://resend.com)
6. [Stripe](https://stripe.com): the business account
7. Optional: [Sentry](https://sentry.io), [UptimeRobot](https://uptimerobot.com)

Keep a private note (a password manager is best) as you go. You'll collect about 15 values.

---

## 2. Neon: the database

1. In Neon, **Create project**.
   - Name: `artfinity`
   - Postgres version: the newest offered (16 or 17)
   - Region: **AWS US East (N. Virginia)**, so it sits next to Vercel's default region
2. Neon creates a branch called `main` (or `production`). This is the **live** database.
3. Get the two connection strings. On the project dashboard, press **Connect**:
   - Turn **Connection pooling ON** and copy the string. Its host has `-pooler` in it. Add
     `&pgbouncer=true&connect_timeout=15` to the end (after `?sslmode=require`). This is **`DATABASE_URL`**.
   - Turn **Connection pooling OFF** and copy again. This is **`DIRECT_URL`**. Migrations and backups use it.
4. Make a **staging** branch: **Branches → Create branch**, name `staging`, parent `main`, "current data".
   Copy its two connection strings the same way (pooled and direct). These go in Vercel's **Preview** environment.
5. Backups: Neon keeps a history you can restore to any moment within its restore window (Settings → Storage /
   "History retention"). The Free plan's window is short (hours); a paid plan keeps days. Once real money is moving,
   use a paid plan **and** the backup script in section 12.

You don't need to create tables: the first deploy does it (section 5).

---

## 3. Vercel: the website

1. In Vercel, **Add New → Project**, and **Import** the Artfinity GitHub repository.
2. On the configure screen:
   - Framework preset: **Next.js** (detected)
   - Root directory: leave as is
   - **Install command**: `pnpm install`
   - **Build command**:
     ```
     DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}" pnpm exec prisma migrate deploy && pnpm exec next build
     ```
     This applies any new database changes before each build (section 5). It uses the direct URL because
     migrations don't work through Neon's pooler.
   - Don't deploy yet: open **Environment Variables** first and add the required ones from section 4
     (at least `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, Cloudinary, `CRON_SECRET`).
     Then **Deploy**.
3. After the project exists, in **Settings**:
   - **Git → Production Branch**: the branch the live site builds from. Pick one and stick to it
     (for example `main`, after `redesign/artist-first` is merged into it). Every other branch,
     including `redesign/artist-first`, gets **Preview** deployments (the staging site, section 10).
   - **General → Node.js Version**: 22.x
   - **Functions → Function Region**: Washington, D.C. (`iad1`), next to Neon.
4. The repo has only `pnpm-lock.yaml` (the stray `package-lock.json` was removed), so Vercel uses pnpm.
   If a `package-lock.json` ever comes back, delete it: two lockfiles confuse Vercel.

---

## 4. Environment variables

Set them in Vercel under **Settings → Environment Variables**. Each variable can apply to **Production**,
**Preview** (staging) or both. Where the value differs (database, Stripe test vs live), add it twice, once per
environment. Every variable is also listed, with a comment, in [`.env.example`](.env.example).

`NEXT_PUBLIC_*` values are baked in at build time: after changing one, **redeploy** (Deployments → ⋯ → Redeploy).

### Required: the site doesn't work without these

| Variable | What it is | Where to get it | Without it |
| --- | --- | --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string (+ `&pgbouncer=true&connect_timeout=15`) | Neon → Connect | Nothing loads. |
| `DIRECT_URL` | Neon **direct** connection string | Neon → Connect, pooling off | Migrations on deploy fail (the build command falls back to `DATABASE_URL`, which fails through the pooler). |
| `JWT_SECRET` | Random secret that signs log-ins, links and QR discounts. 48+ random characters. | Any password generator. **Different** for Production and Preview. Never change it once live (everyone is logged out and signed links break). | Nobody can log in. |
| `NEXT_PUBLIC_APP_URL` | The site's address, e.g. `https://theartfinity.com` (Preview: your staging address) | You choose | Links in emails, QR codes and Stripe return pages point to the wrong place. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image storage | Cloudinary → Dashboard (section 9) | Uploads fail: Vercel can't save files to disk. |
| `CRON_SECRET` | Random secret Vercel sends to the scheduled jobs | Password generator | No scheduled job runs (payouts, digests, retries). "Run now" on /admin/jobs still works. |

### Required to sell: payments and email

| Variable | What it is | Without it |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_…`; Preview: `sk_test_…`) | Checkout doesn't take payments. Production refuses test orders unless `ALLOW_TEST_CHECKOUT=1`. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the **orders** webhook (`/api/webhook`) | Paid orders are never recorded. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Signing secret of the **Connect** webhook (`/api/webhook/connect`) | Artists who connect Stripe stay "pending"; payouts fall back to Venmo by hand. |
| `STRIPE_BILLING_WEBHOOK_SECRET` | Signing secret of the **billing** webhook (`/api/webhook/billing`) | Infinity subscriptions don't activate. See BILLING_SETUP.md. |
| `RESEND_API_KEY` | Resend API key | No email at all (receipts, sign-in links, payouts, alerts). |
| `PRINTER_EMAIL` | The print lab's order inbox (or use Prodigi instead: section 7, "Prodigi") | Work orders aren't sent; tick "Sent to printer" by hand in the admin. |

### Recommended

| Variable | What it does | Without it |
| --- | --- | --- |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Error alerts (section 11). Same DSN in both is fine. | Errors only show in Vercel's logs; nobody is told. |
| `ALERT_WEBHOOK_URL` | Slack or Discord incoming-webhook URL: one-line alerts when a job or webhook fails | Those alerts only show on /admin/alerts and in alert emails. |
| `SHIPPO_API_KEY` or `EASYPOST_API_KEY`, plus `SHIPPING_WEBHOOK_SECRET` | Carrier tracking updates (webhook `/api/shipping/webhook`) | Mark shipped/delivered by hand. |
| `SCAN_SIGNING_SECRET` | Separate secret for QR discounts | Falls back to `JWT_SECRET` (fine). |
| `TEST_START_DATE` | 90-day test start, `YYYY-MM-DD` | The dashboard uses the first paid order. **On Vercel set it here**: the dashboard's Save can't write files there. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps on artist and venue pages | Maps show a placeholder. |
| `GOOGLE_MAPS_API_KEY` | Street address suggestions (Places API New, server only, `GET /api/places/address`) | Address fields finish the city, state and ZIP from our own list; the browser's autofill does the rest. |

### Optional, by feature

| Group | Variables | Notes |
| --- | --- | --- |
| Social sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `META_GRAPH_VERSION` | Each button shows only when its vars are set. [AUTH_SETUP.md](AUTH_SETUP.md) |
| Infinity plan | `STRIPE_INFINITY_PRICE_ID`, `STRIPE_INFINITY_YEARLY_PRICE_ID`, `STRIPE_PORTAL_CONFIGURATION_ID`, `STRIPE_BILLING_TAX`, `STRIPE_INFINITY_TAX_CODE`, `NEXT_PUBLIC_INFINITY_PRICE_CENTS`, `NEXT_PUBLIC_INFINITY_YEARLY_MONTHLY_CENTS`, `NEXT_PUBLIC_INFINITY_SPLIT` | [BILLING_SETUP.md](BILLING_SETUP.md) |
| Sales tax | `STRIPE_TAX` (`off` disables), `STRIPE_TAX_CODE` | On by default; set up Stripe Tax first (section 7). |
| Image checks | `IMAGE_MODERATION_PROVIDER`, `IMAGE_MODERATION_TIMEOUT_MS`, `SIGHTENGINE_USER`, `SIGHTENGINE_SECRET`, `SIGHTENGINE_MODELS`, `GOOGLE_VISION_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`, `AWS_DEFAULT_REGION` | Off by default. [MODERATION_SETUP.md](MODERATION_SETUP.md) |
| Drive / Dropbox import | `NEXT_PUBLIC_GOOGLE_API_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_APP_ID`, `NEXT_PUBLIC_DROPBOX_APP_KEY` | Buttons hidden without them. [IMPORT_SETUP.md](IMPORT_SETUP.md) |
| Email senders | `RESEND_FROM_EMAIL`, `EMAIL_FROM`, `CONTACT_EMAIL`, `REPORTS_EMAIL`, `ADMIN_NOTIFY_EMAIL`, `BOOKKEEPING_EMAIL` | Defaults use @theartfinity.com addresses. |
| Print lab | `PRINTER_PROVIDER` (`email` / `none` / `prodigi`), `PRINTER_FROM`, `PRINTER_REPLY_TO`, `PRINTER_PAPER` | Defaults are fine. |
| Prodigi | `PRODIGI_API_KEY`, `PRODIGI_ENV`, `PRODIGI_SKUS`, `PRODIGI_WEBHOOK_TOKEN`, `PRODIGI_SHIPPING_METHOD`, `PRODIGI_PACKING_SLIP`, `PRODIGI_DASHBOARD_URL`, `PRINTER_API` | Only with `PRINTER_PROVIDER=prodigi`. Section 7, "Prodigi". |
| Business rules | `REFUND_PAID_OUT_POLICY` (`absorb` / `deduct_next_payout`), `REPRINT_AUTO_MAX`, `COLLECTOR_REWARDS`, `COLLECTOR_REWARD_EVERY`, `COLLECTOR_REWARD_PCT`, `LEGACY_DISCOUNT_UNTIL` | Set here to pin a value. The refund rule is normally chosen on /admin/settings (saved in the database, works on Vercel). Collector rewards' admin page saves a file, which **doesn't work on Vercel**: set the env vars instead. |
| Sentry extras | `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Section 11. |
| Staging only | `ALLOW_TEST_CHECKOUT=1` | Lets a Preview deploy without Stripe keys record test orders. **Never in Production.** |
| Backups | `BACKUP_DATABASE_URL`, `BACKUP_DIR`, `BACKUP_KEEP`, `BACKUP_S3_*` | Used by the backup script on your computer, not on Vercel (section 12). |

**Local only, not on Vercel:** `ORIGINALS_DIR`, `SCENES_ADMIN_WRITE`, `SCENES_CACHE_DIR`, `PEXELS_API_KEY`,
`PEXELS_API_URL`, `PIXABAY_API_KEY`, `PIXABAY_API_URL`, `PORT`, `A11Y_*`, `ALLOW_MOCK_OAUTH`, `ALLOW_MOCK_IMPORT`.

**Set automatically, never by hand:** `NODE_ENV`, `NEXT_RUNTIME`, `NEXT_PHASE`, `CI`, `VERCEL_ENV`,
`NEXT_PUBLIC_VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`.

---

## 5. Database changes on every deploy

The build command from section 3 runs `prisma migrate deploy` before `next build`. It applies any new files in
`prisma/migrations/` to that environment's database (Production → the Neon `main` branch, Preview → `staging`),
and does nothing if there's nothing new. If a migration fails, the build fails and the live site stays on the
previous version, so a bad change never goes half-live.

The first production deploy creates every table. It does **not** add the demo data (the seed is for local use).

**Your owner account.** Sign up on the live site as an artist with your own email. Then in Neon → **SQL Editor**
(branch `main`) run, with your email:

```sql
UPDATE "Artist" SET role = 'ADMIN', "adminRole" = 'owner' WHERE email = 'you@example.com';
```

Log out and back in: you now have /admin. Invite the rest of the team from /admin/team.

---

## 6. Scheduled jobs (crons) and the Vercel plan

`vercel.json` schedules these (times are UTC):

| Job | Schedule | What it does |
| --- | --- | --- |
| `/api/cron/payouts` | 5th of the month, 15:17 | Pays artists through Stripe ("Pay all") |
| `/api/cron/admin-digest` | daily 12:07 | Admin email digest + alert sweep |
| `/api/cron/work-order-retries` | **every hour** at :07 | Re-sends failed print-lab work orders |
| `/api/cron/prodigi-sync` | **every hour** at :37 | Checks open Prodigi orders (only with `PRINTER_PROVIDER=prodigi`) |
| `/api/cron/stuck-orders` | daily 12:23 | Flags paid orders not sent to the printer |
| `/api/cron/artist-digest` | Mondays 13:00 **and** 14:00 | Weekly artist email (two runs so it lands at 9am New York in summer and winter) |
| `/api/cron/bookkeeping` | 1st of the month, 13:37 | Monthly books CSV email |

They need `CRON_SECRET` set (Vercel sends it automatically). Crons only run on the **Production** deployment.

**Plan note:** Vercel's free Hobby plan only allows jobs that run **once a day** at most. The hourly work-order
retry, the hourly Prodigi sync and the twice-on-Monday artist digest need **Pro** ($20/month); on Hobby the deploy is rejected with these
schedules. Either upgrade to Pro (recommended once you're selling), or edit `vercel.json` to make those two daily.

You can always run any job by hand from **/admin/jobs → Run now**, and see each run's result there.

---

## 7. Domain, Stripe webhooks, Resend, Cloudinary

### Domain

1. Vercel → **Settings → Domains → Add** `theartfinity.com` and `www.theartfinity.com`. Choose "redirect www to
   theartfinity.com".
2. Vercel shows DNS records (an `A` record for the bare domain, a `CNAME` for `www`). Add them where the domain is
   registered. HTTPS turns on by itself within minutes.
3. Set `NEXT_PUBLIC_APP_URL=https://theartfinity.com` for Production and redeploy.

### Stripe webhooks (one endpoint per URL, per mode)

Stripe → **Developers → Webhooks → Add endpoint**. Make three in **live** mode for the live site, and the same
three in **test** mode pointing at the staging address. Copy each endpoint's **Signing secret** (`whsec_…`) into
the matching variable.

| URL | Listen to | Events | Secret goes in |
| --- | --- | --- | --- |
| `https://theartfinity.com/api/webhook` | Your account | `checkout.session.completed` | `STRIPE_WEBHOOK_SECRET` |
| `https://theartfinity.com/api/webhook/connect` | **Connected accounts** | `account.updated`, `account.application.deauthorized` | `STRIPE_CONNECT_WEBHOOK_SECRET` |
| `https://theartfinity.com/api/webhook/billing` | Your account | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` | `STRIPE_BILLING_WEBHOOK_SECRET` |

Also in Stripe: turn on **Connect** (Express accounts) for artist payouts, and set up **Stripe Tax** (Tax →
Registrations: add New York) so sales tax is collected. BILLING_SETUP.md covers the Infinity price and portal.

A wrong signing secret shows up as a Sentry warning ("stripe-signature") and as 400s on the endpoint's page in Stripe.

### Prodigi (automatic printing and tracking)

With `PRINTER_PROVIDER=prodigi`, every paid order and every approved free reprint becomes a Prodigi order by itself.
Prodigi tells us as it prints and ships. Tracking marks the order shipped and the buyer gets the usual shipped email.
Code: `lib/prodigi.ts` (payload, SKU map, status mapping), `lib/prodigiSync.ts` (applying it), `lib/printer.ts`.

**How an order moves**

1. Paid (Stripe webhook, test checkout, bulk order) or reprint approved → `POST /v4.0/Orders` with our order number
   as `merchantReference` and our order id as `idempotencyKey` (a retry can't print twice). The order shows
   `prodigi:ord_…` and "Work order sent". A failure (missing SKU, unreadable address, Prodigi down) shows the reason in
   /admin/orders; the hourly retry job tries 3 times, then alerts.
2. Prodigi calls `/api/webhook/prodigi` on every change. We fetch the order again from Prodigi (the callback body
   isn't trusted) and apply it. The hourly `prodigi-sync` job does the same for every order not shipped yet.
3. Printing → shown on the admin order page. Shipment with tracking → order **shipped**, tracking saved, buyer and
   artist emails same as when an admin marks it shipped. Cancelled, a problem, or our account waiting for payment →
   an admin alert ("Print lab cancelled or flagged an order").
4. Delivered: Prodigi doesn't report it. With `SHIPPO_API_KEY` or `EASYPOST_API_KEY` set (section 4), the tracking
   number is registered there and delivery is marked automatically. Without one, the daily stuck-orders job flags
   orders shipped 10+ days ago and an admin marks them delivered.

The manual buttons on the admin order page still work and win: tracking typed by hand is never replaced.
"Resend work order" creates a **new** Prodigi order (new idempotency key), so use it only to print again.

**Set it up, sandbox first**

1. Make a Prodigi account. In the dashboard, open **Settings → API** (sandbox and live each have their own key).
2. Find the SKUs in the dashboard's **product catalogue**: the 310gsm smooth matte fine art paper in each size
   (5×7, 8×12, 11×17, 18×24) and the framed version in black, white and natural, plus any attribute the frame
   needs (usually a colour). Put them in `PRODIGI_SKUS` (the example in `.env.example` shows the shape). Values
   starting with `TODO` count as missing, so an order with that size or frame fails with a clear reason instead of
   printing the wrong product. /admin shows how many are still missing.
3. Set on **Preview** (staging) first:
   `PRINTER_PROVIDER=prodigi`, `PRODIGI_ENV=sandbox`, `PRODIGI_API_KEY=<sandbox key>`, `PRODIGI_SKUS=…`,
   `PRODIGI_WEBHOOK_TOKEN=<long random string>`. Optional: `PRODIGI_SHIPPING_METHOD` (`Standard` by default).
4. The callback URL is set on each order for you: `https://<site>/api/webhook/prodigi?token=<PRODIGI_WEBHOOK_TOKEN>`.
   Nothing to paste into Prodigi. If the dashboard also has an account-wide callback setting, use the same URL.
   Prodigi has to reach the site and the original files, so test on the staging address, not localhost.
5. Place a test order on staging. Check in the Prodigi sandbox dashboard: right product, whole artwork shown, no
   crop, the white border looks right, address correct. Move it along in the sandbox (or wait) and watch the admin
   order page change. Check the buyer's shipped email.
6. Then **Production**: `PRODIGI_ENV=live` and the **live** key, same SKUs and a new token. Add billing in the Prodigi
   dashboard, or orders wait for payment (that raises an urgent alert).

Not sent to Prodigi: certificates of authenticity and artists' parcel notes (the email work order carried them).
`PRODIGI_PACKING_SLIP=on` sends our packing slip URL; check in sandbox that Prodigi accepts it before turning it on.

### Resend (email)

1. Resend → **Domains → Add domain** `theartfinity.com`.
2. Add the DNS records it shows (SPF/DKIM `TXT` records and an `MX` for bounces) at your registrar. Wait for
   **Verified** (minutes to a few hours).
3. **API Keys → Create** (sending access) → `RESEND_API_KEY`.
4. The site sends from `notifications@`, `no-reply@`, `orders@` and `contact@theartfinity.com`: all covered once the
   domain is verified. Make sure `contact@` and your reply-to inbox actually receive mail.

### Cloudinary (images)

1. Cloudinary → **Dashboard**: copy Cloud name, API key, API secret into the three `CLOUDINARY_*` variables.
2. Nothing else to configure: public previews are normal uploads, and the full-resolution originals are stored as
   private ("authenticated") assets that only the print lab's signed links can open.

---

## 8. Health check and uptime monitor

`https://theartfinity.com/api/health` answers `200` with `{"status":"ok","db":"ok",…}` when the site and database
are up, and `503` when the database isn't. It shows no secrets.

In UptimeRobot (free): **New monitor → HTTP(s)**, URL above, every 5 minutes, alert by email/SMS. Use keyword
monitoring for `"status":"ok"` if you want to catch a degraded database too.

---

## 9. Owner settings to decide after the first deploy

- **/admin/settings → Refunds after a payout**: when a sale the artist was already paid for is refunded for a buyer
  return or chargeback, either Artfinity absorbs it (default) or it comes off the artist's next payout as a
  "Refund adjustment". Damaged prints are always absorbed. The artist terms already allow both.
- `TEST_START_DATE` (env var) for the 90-day test.
- /admin/settings/notifications: which alerts email you.

---

## 10. Staging site (Preview + Neon branch)

Every push to a non-production branch (like `redesign/artist-first`) gets its own Preview URL. To make a stable
staging site:

1. Vercel → **Settings → Domains → Add** `staging.theartfinity.com`, and set its **Git Branch** to
   `redesign/artist-first`. (Or use the automatic `…-git-redesign-artist-first-….vercel.app` address.)
2. In **Environment Variables**, give **Preview** its own values:
   - `DATABASE_URL` / `DIRECT_URL`: the Neon **staging** branch strings
   - `NEXT_PUBLIC_APP_URL`: `https://staging.theartfinity.com`
   - Stripe **test** keys and the three **test-mode** webhook secrets (endpoints pointing at the staging address)
   - a different `JWT_SECRET`
   - optional `ALLOW_TEST_CHECKOUT=1` to record test orders without Stripe
3. Keep staging private: **Settings → Deployment Protection → Vercel Authentication** (only your Vercel team can
   open it). Stripe can't log in, so for webhooks add a **Protection Bypass for Automation** secret and append
   `?x-vercel-protection-bypass=<secret>` to the staging webhook URLs in Stripe.
4. Crons don't run on Preview. Use /admin/jobs → Run now.
5. To refresh staging with a copy of live data: Neon → Branches → `staging` → **Reset from parent**. (Live data
   includes real emails: don't share staging.)

---

## 11. Sentry (error alerts)

1. Sentry → **Create project → Next.js**, name `artfinity`. Copy the **DSN**.
2. In Vercel set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` to it (Production; Preview too if you want staging
   errors, they're tagged by environment). Redeploy.
3. Sentry → **Alerts → Create alert**: "a new issue is created" → email you. That's the "tell me when it breaks".
4. Optional, readable stack traces: create an auth token (Settings → Auth Tokens, scope `project:releases`) and set
   `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` (your org slug) and `SENTRY_PROJECT` (`artfinity`). Without the token the build
   skips source map upload and still works.
5. In Sentry's project settings → Security & Privacy, keep **Data Scrubber** on and turn on **Prevent Storing of IP
   Addresses**.

What's set up in the code: browser, server and middleware errors; failed background jobs; Stripe and shipping
webhook errors (those also raise an admin alert). Personal data is stripped before anything is sent: no emails,
addresses, cookies, request bodies or IPs. Only 5% of requests are traced (2% in the browser) to stay in the free
tier. Without a DSN, nothing is sent and the build config isn't wrapped at all.

No Sentry? Set `ALERT_WEBHOOK_URL` to a Slack or Discord incoming webhook and failed jobs and webhooks post there.

---

## 12. Backups and restoring

**Main backup: Neon point-in-time restore.** Neon can rewind a branch to any moment inside its restore window.

To restore after a mistake (say, at 2:10pm someone deleted data):

1. Neon → **Restore** (or Branches → `main` → Restore). Pick a time just before the mistake, e.g. 2:05pm.
2. Choose **restore to a new branch** first (name it `restore-1405`). Open it in the SQL Editor and check the data
   is what you expect.
3. Then either restore `main` itself to that time (Neon keeps a backup branch of the state it replaced), or copy the
   missing rows over from the new branch.
4. If you restored `main` itself nothing else changes: the connection strings stay the same.

**Second copy you keep yourself: `pnpm db:backup`.** On a computer with the PostgreSQL client tools (version 16+)
and the repo:

```bash
DIRECT_URL="<Neon direct connection string>" pnpm db:backup
```

It writes `backups/artfinity-<date-time>.dump` (compressed, pg_dump custom format) and keeps the newest 14.
To also upload each dump to S3, Cloudflare R2 or Backblaze B2, set `BACKUP_S3_BUCKET`,
`BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` and, for R2/B2, `BACKUP_S3_ENDPOINT` and
`BACKUP_S3_REGION` (`auto` for R2). Run it weekly (or daily once busy), for example from your computer's scheduler.
Dumps contain customer emails and addresses: keep them somewhere private.

Restoring a dump (into a fresh, empty database, e.g. a new Neon branch made "schema only" or a new project):

```bash
pg_restore --no-owner --no-privileges --clean --if-exists -d "<direct URL of the empty database>" backups/artfinity-2026-11-05T14-03-00Z.dump
```

Check it, then point `DATABASE_URL` / `DIRECT_URL` in Vercel at it and redeploy.

---

## 13. After each production deploy: smoke checklist

Takes 10 minutes. Do it after the first deploy and after big changes.

- [ ] `https://theartfinity.com/api/health` shows `"status":"ok"` and `"db":"ok"`.
- [ ] Home page, an artist page (`/@handle`) and a painting page load with images.
- [ ] Log in, open Studio, upload a test piece: the preview image appears (Cloudinary works).
- [ ] /admin dashboard: the **Integrations** panel shows green for Stripe, email, crons and the print lab.
- [ ] Buy a print with a real card (refund it after in Stripe): the thank-you page shows, the receipt email arrives,
      the order is in /admin/orders, and the work order reached the lab.
- [ ] Stripe → Webhooks: the three endpoints show recent `200` responses.
- [ ] /admin/jobs → **Run now** on "admin-digest": it finishes OK.
- [ ] Sign out and request a sign-in link or password reset: the email arrives.
- [ ] Sentry (if set): visit `/api/health`; no new errors. The uptime monitor is green.
- [ ] Record that refund in /admin/orders (Mark refunded, reason "Other") and undo it, to see the money rules work.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Build fails at `prisma migrate deploy` | `DIRECT_URL` missing or wrong, or the Neon branch is asleep (retry). |
| "Nobody can log in" after a change | `JWT_SECRET` changed. Put the old one back. |
| Orders paid in Stripe but not in /admin | Wrong `STRIPE_WEBHOOK_SECRET`, or the endpoint URL is wrong. Check the endpoint's attempts in Stripe. |
| No emails | Resend domain not verified, or `RESEND_API_KEY` missing. |
| Uploads fail | `CLOUDINARY_*` missing. |
| Jobs never run | `CRON_SECRET` missing, or the deploy was rejected for the cron schedule on Hobby (section 6). |
| An admin setting won't save on Vercel ("couldn't save the settings file") | That setting lives in a file; set its env var instead (`TEST_START_DATE`, `COLLECTOR_REWARDS…`). |
