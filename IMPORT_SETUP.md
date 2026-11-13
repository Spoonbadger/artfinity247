# Import from Google Drive / Dropbox: setup

Artists can pull paintings straight from **Google Drive** or **Dropbox** on **Upload art** (`/studio/art/new`). Picked files land in the same one-by-one upload queue as files from their computer.

Each button shows **only when its keys are set**. No keys = no button, so nothing half-configured reaches production. About 20 minutes for both.

You'll end up with four values for Vercel (Production + Preview):

```
NEXT_PUBLIC_GOOGLE_API_KEY=      # Google API key (step 4)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=    # OAuth client ID, ends in .apps.googleusercontent.com (step 3)
NEXT_PUBLIC_GOOGLE_APP_ID=       # Google Cloud project NUMBER, digits only (step 1)
NEXT_PUBLIC_DROPBOX_APP_KEY=     # Dropbox app key (Dropbox, step 2)
```

These are public by design (they ship to the browser). They're safe because each is locked to our domains below. **No secrets are needed.** Redeploy after adding them (`NEXT_PUBLIC_*` values are baked in at build time).

---

## Google Drive

Use the **same Google Cloud project as "Continue with Google"** if there is one (AUTH_SETUP.md). Otherwise make one at <https://console.cloud.google.com> named "Artfinity".

1. **Project number.** Dashboard → Project info → copy **Project number** (digits, not the project ID) → `NEXT_PUBLIC_GOOGLE_APP_ID`.
2. **Turn on two APIs.** APIs & Services → Library → enable **Google Picker API** and **Google Drive API**.
3. **OAuth client.**
   - APIs & Services → **OAuth consent screen** (Google Auth Platform → Branding). If sign-in is already set up, it's done. Otherwise: app name "Artfinity", support email, home page `https://theartfinity.com`, privacy `https://theartfinity.com/privacy-policy`, authorized domain `theartfinity.com`, audience **External**, then **Publish app** (out of "Testing").
   - Data access / Scopes: add `https://www.googleapis.com/auth/drive.file`. It's a **non-sensitive** scope (we only see files the artist picks), so no Google review is needed.
   - Credentials → **Create credentials → OAuth client ID → Web application** (or edit the existing sign-in client).
   - **Authorized JavaScript origins**: `https://theartfinity.com`, `https://www.theartfinity.com`, `http://localhost:3000` (plus any staging domain).
   - Copy the **Client ID** → `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. (The client secret isn't used for this.)
4. **API key.** Credentials → **Create credentials → API key**, then edit it:
   - Application restrictions: **Websites** → `https://theartfinity.com/*`, `https://www.theartfinity.com/*`, `http://localhost:3000/*`.
   - API restrictions: **Restrict key** → tick **Google Picker API** only.
   - Copy it → `NEXT_PUBLIC_GOOGLE_API_KEY`.

## Dropbox

1. <https://www.dropbox.com/developers/apps> → **Create app** → **Scoped access** → **App folder** (the Chooser doesn't use it, but it's the smallest access) → name "Artfinity".
2. Settings tab → copy **App key** → `NEXT_PUBLIC_DROPBOX_APP_KEY`. (The secret isn't used.)
3. Settings tab → **Chooser / Saver / Embedder domains** → add `theartfinity.com`, `www.theartfinity.com`, `localhost`.
4. No permissions or review needed: the Chooser works for any Dropbox user once the domains are set.

---

## Check it works

1. Log in as an artist with at least one piece, open **Upload art**. You should see **Google Drive** and **Dropbox** under the drop zone.
2. **Drive:** sign in when Google asks, pick two images (or a folder), and they appear in the queue as "Importing 1 of 2…", then a toast "2 pieces added".
3. **Dropbox:** same, from the Chooser.

| Problem | Fix |
|---|---|
| Google popup: "origin_mismatch" / "idpiframe_initialization_failed" | The site's exact origin is missing from **Authorized JavaScript origins** (step 3). |
| Picker shows "The API developer key is invalid" | API key restrictions: add the domain (with `/*`) and allow Google Picker API (step 4). |
| Picker opens but picked files fail ("access ran out" or "couldn't find that file") | `NEXT_PUBLIC_GOOGLE_APP_ID` must be the project **number** from the same project as the client ID. |
| Dropbox Chooser says "invalid app key" or the domain isn't allowed | Add the domain under Chooser domains (Dropbox step 3). |
| "Your browser blocked the … window" | The artist's pop-up blocker. The message has a **Try again** button; allowing pop-ups for the site fixes it for good. |

## Good to know

- Files are downloaded by our server (`POST /api/uploads/import`) and go through the same pipeline as a normal upload: private original, 1600px preview, print-size check, duplicate check, moderation when published. It only ever fetches from `www.googleapis.com` and Dropbox's download hosts.
- Same limits as a normal upload: JPG, PNG, WEBP, TIFF or HEIC, up to 25 MB, 50 at a time. HEIC only works when Cloudinary is on; otherwise the artist is asked to export a JPG.
- Dropbox links expire after about 4 hours, so the queue imports right away. If one expires, the artist gets a **Pick it again** button.
- The Google access token stays in the artist's browser tab memory for that visit only. It's never saved.
- **Local testing without accounts:** set `ALLOW_MOCK_IMPORT=1` in `.env.local` and a **Sample files (dev)** button imports generated paintings. Add `?mockImport=problems` to the page URL to also get an expired link, a GIF, a too-small file and a duplicate. Ignored in production builds.
