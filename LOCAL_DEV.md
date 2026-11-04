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

- `/` homepage, claim your @name
- `/register` four-step sign-up
- `/art/blue-ridge-late-may?at=River%20Arts%20Market&off=10` the page a buyer sees after scanning a code (try it on your phone's screen size)
- `/studio` the artist dashboard, `/studio/qr` QR codes, `/studio/art/new` upload
- `/@mayaokafor` an artist page

## Without keys
- Checkout runs in test mode and creates real orders in your local database.
- Emails print to the terminal (look for `[email:dev]`, including password reset links).
- Uploads are saved to `public/uploads`.

No Docker? Install PostgreSQL 16 yourself, create a user and database both named `artfinity` with password `artfinity`, then run `pnpm setup:local`.
