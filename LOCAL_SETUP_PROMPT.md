Set up and run the Artfinity website on this computer so I can click around it at http://localhost:3000. I'm not a developer, so install whatever is missing for me, explain anything you need me to click in one short line, and keep going until the site is open in my browser.

The code is on GitHub: https://github.com/thomasdemuth/artfinity247, branch `redesign/artist-first` (not `main`). It is a Next.js 14 app with a Postgres database.

1. Check what's installed: `node -v`, `git --version`. I need Node 20 or newer.
   - Missing or older Node: install the current LTS. On a Mac, use Homebrew if it's there (`brew install node`); otherwise download the macOS installer from https://nodejs.org and walk me through clicking through it. On Windows, use `winget install OpenJS.NodeJS.LTS`, or the installer from nodejs.org.
   - Missing git: on a Mac, run `xcode-select --install` (I'll click Install), or `brew install git`. On Windows, `winget install Git.Git`. If git is a hassle, download https://github.com/thomasdemuth/artfinity247/archive/refs/heads/redesign/artist-first.zip and unzip it instead.
   - After installing, open a fresh terminal so the new commands are found.

2. Get the code into a folder in my home directory:
   `git clone -b redesign/artist-first https://github.com/thomasdemuth/artfinity247.git` then `cd artfinity247`.

3. Install the project's packages with pnpm, without installing pnpm globally:
   `npx -y pnpm@10.13.1 install`
   If pnpm prints "Ignored build scripts" for any `@embedded-postgres/...` package, run `npx -y pnpm@10.13.1 rebuild` (or `npx -y pnpm@10.13.1 approve-builds` and approve them), because the built-in database needs that step.

4. Start everything with one command:
   `npx -y pnpm@10.13.1 local`
   On the first run this starts a built-in Postgres (no Docker needed), creates the database, loads demo data (5 artists, 25 artworks, 100 orders), then starts the site. It takes a minute or two. When it says it's starting at http://localhost:3000, open that page in my browser for me if you can.

5. If step 4 fails because the built-in database won't start, use a regular Postgres instead:
   - Mac: `brew install postgresql@16 && brew services start postgresql@16`. Windows: `winget install PostgreSQL.PostgreSQL.16`.
   - Create a user and a database both named `artfinity` with password `artfinity`, e.g. `psql postgres -c "CREATE USER artfinity WITH PASSWORD 'artfinity' CREATEDB;"` and `psql postgres -c "CREATE DATABASE artfinity OWNER artfinity;"`.
   - Copy `.env.example` to `.env` and make sure `DATABASE_URL="postgresql://artfinity:artfinity@localhost:5432/artfinity"`.
   - Then run `npx -y pnpm@10.13.1 setup:local` followed by `npx -y pnpm@10.13.1 dev`.

6. Once the site loads, tell me:
   - The logins (password `artfinity123` for both): `maya@artfinity.local` is an artist, `admin@artfinity.local` is the admin.
   - Pages to try first: the homepage; `/art/blue-ridge-late-may` (the page a buyer sees after scanning a QR code; try it at phone size); `/@mayaokafor` and `/@mayaokafor/links`; and, logged in as Maya, `/studio`, `/studio/qr` and `/studio/share`.
   - How to stop it (Ctrl+C in the terminal) and how to start it again next time (`npx -y pnpm@10.13.1 local` in the same folder).
   `LOCAL_DEV.md` in the project has the full list of pages.

Don't change the project's code, and don't commit or push anything. If something fails and you can't fix it, show me the exact error message.
