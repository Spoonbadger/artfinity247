# Run Artfinity on your computer

You need: **Node 20+**, **pnpm** (`npm i -g pnpm`), and **Docker Desktop** (for the database).

```bash
pnpm install
docker compose up -d
pnpm setup:local
pnpm dev
```

Open http://localhost:3000.

`setup:local` creates `.env` from `.env.example`, builds the database tables and loads demo data:
5 artists, 25 artworks and 40 orders. Run `pnpm db:seed` any time to reset the demo data.

## Logins (password `artfinity123`)

| Who | Email | Try |
|---|---|---|
| Artist | maya@artfinity.local | /studio, /studio/qr, /@mayaokafor |
| Admin | admin@artfinity.local | /admin/orders |

## Pages to try

**Buyers**
- `/` homepage (the hero plays the whole scan → buy → ship → paid story)
- `/art/east-river-late-may` the page a buyer lands on after scanning: room previews, sizes, frames, zoom, quantity. Try it at phone size.
- `/@mayaokafor` an artist page (medals, verified seal, socials, Collections tab) · `/@mayaokafor/links` link-in-bio page
- `/art`, `/artists`, `/scenes`, `/search`, `/pricing`, `/developers`

**Artists** (log in as maya)
- `/studio` dashboard · `/studio/art` my art · `/studio/art/new` upload
- `/studio/qr` QR Studio (logo in the code, PDF sheets) · `/studio/share` share kit (auto videos, images, captions)
- `/studio/links` link page editor · `/studio/customers` customers and thank-you notes · `/studio/emails` automated emails
- `/studio/collections`, `/studio/bulk` (order prints at cost), `/studio/rooms` (pick room previews)
- `/studio/design` page design · `/studio/verify` verification · `/studio/pro` Pro plan and referrals · `/studio/automations`
- `/studio/sales`, `/studio/events`, `/studio/page`, `/studio/developers` (embed snippets)

**Admin** (log in as admin): `/admin/orders`, `/admin/moderation`, `/admin/payouts`, `/admin/verification`

**Discount codes:** a QR code's discount only works with its signature, so typing `?off=30` does nothing. Make a real discounted code in QR Studio and open its link.

## Without keys
- Checkout runs in test mode and creates real orders in your local database.
- Emails print to the terminal (look for `[email:dev]`, including password reset links).
- Uploads are saved to `public/uploads`.
- Payouts are Stripe Connect only, simulated: Juno and Ines are seeded as connected; Maya isn't, so her latest month shows as held. "Connect with Stripe" on her Money page makes a test account, then /admin/payouts → Pay all pays it (no money moves).

No Docker? Install PostgreSQL 16 yourself, create a user and database both named `artfinity` with password `artfinity`, then run `pnpm setup:local`.
