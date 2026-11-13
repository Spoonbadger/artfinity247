# Instagram auto-posting setup

For Craig. This connects Artfinity's own Instagram so approved posts from **/admin/social** publish by themselves. Until it's done, /admin/social works in **manual mode**: approve a post, download the video, copy the caption, post it from the Instagram app and press **Mark as posted**. Nothing breaks without these keys.

You'll make: an Instagram professional account linked to a Facebook Page, a Meta developer app, and one long-lived access token. About an hour, plus Meta's app review.

## 1. Instagram professional account and Facebook Page

1. In the Instagram app, open the Artfinity account: **Settings → Account type and tools → Switch to professional account → Business**.
2. Create a Facebook Page for Artfinity if there isn't one (facebook.com/pages/create).
3. Link them: on the Page, **Settings → Linked accounts → Instagram → Connect account**, and log in to the Artfinity Instagram.
4. Make sure your own Facebook user is an admin of the Page (you'll make the token as this user).

## 2. Meta developer app

1. Go to developers.facebook.com → **My Apps → Create app**. Use case: **Other**, type **Business**. Name it "Artfinity Social".
2. Add the products **Facebook Login for Business** and **Instagram** (the "Instagram API with Facebook Login" option).
3. In **App settings → Basic**, note the **App ID** and **App secret**. If Artfinity already has a Meta app for "Sign in with Facebook" (FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET), you can add the products to that app instead and skip META_APP_ID / META_APP_SECRET below.
4. Permissions the app asks for:
   - `instagram_basic`: read the account id and username
   - `instagram_content_publish`: create and publish Reels and photos
   - `pages_read_engagement`: find the Page linked to the account
   - `pages_show_list` and `business_management` are usually requested with them by the token tool; that's fine.

## 3. App review notes

While the app is in **Development** mode, it already works for people with a role on the app (you, as admin). Posting to our **own** account only needs that, so you can start right away.

For a permanent setup, switch the app to **Live** and request **Advanced access** for `instagram_content_publish`, `instagram_basic` and `pages_read_engagement` in **App Review → Permissions and features**. What to send Meta:

- **What it does:** "Artfinity is a print marketplace for artists across the US. Our staff approve short videos of artists' paintings in our admin, and the app publishes them as Reels on our own Instagram account. Artists opt in and are credited."
- **Screencast:** /admin/social → Preview and approve a draft → the post scheduled → it appearing on Instagram.
- **Test account:** an admin login for the reviewer (create one in /admin/team), plus the steps above.
- Business verification of the company may be required (Business Settings → Security Center).

<a id="token"></a>

## 4. The token

You need a **long-lived token** for the Instagram account. The best one is a **Page access token made from a long-lived user token**: it doesn't expire.

1. Open **Graph API Explorer** (developers.facebook.com/tools/explorer), pick the app, then **User Token** with the permissions above. Press **Generate Access Token** and approve for the Artfinity Page and Instagram account. This is a short-lived (1 hour) user token.
2. Swap it for a long-lived (60-day) user token. In a terminal:
   ```
   curl "https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN"
   ```
3. Get the Page token and the Instagram account id with the long-lived user token:
   ```
   curl "https://graph.facebook.com/v23.0/me/accounts?fields=name,access_token,instagram_business_account&access_token=LONG_USER_TOKEN"
   ```
   In the Artfinity Page's row, `access_token` is the **Page token** (never expires) and `instagram_business_account.id` is the **INSTAGRAM_BUSINESS_ACCOUNT_ID**.
4. Check it in Meta's **Access Token Debugger**: "Expires: Never" for the Page token.

**Refreshing:** a 60-day user token runs out. If you use one instead of the Page token, also set the app id and secret (below): the daily social job reads the expiry and refreshes the token itself when 10 days are left, and keeps the new one in the database. Without the app id and secret it can't refresh, so set `INSTAGRAM_TOKEN_EXPIRES_AT` and you'll get an admin alert (and email) 7 days before it expires. Either way, if a token stops working (password change, removed from the Page), posting stops, the post shows **Failed** with a "Make a new token" link and an urgent alert goes out. Make a new token with the steps above, replace the env var and redeploy; nothing else to change.

## 5. Where to put the keys

In Vercel → the project → **Settings → Environment Variables** (Production), then redeploy. Locally, in `.env.local`.

| Variable | What | Needed |
| --- | --- | --- |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | The Instagram account id from step 4.3 | Yes |
| `INSTAGRAM_ACCESS_TOKEN` | The Page token (or a long-lived user token) | Yes |
| `META_GRAPH_VERSION` | Graph API version, e.g. `v23.0` (already used by social sign-in) | Optional |
| `META_APP_ID`, `META_APP_SECRET` | The app's id and secret: lets the job read the token's expiry and refresh a user token. Falls back to `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Optional, recommended |
| `INSTAGRAM_TOKEN_EXPIRES_AT` | `YYYY-MM-DD` the token expires, if the job can't read it (no app secret) | Optional |
| `CRON_SECRET` | Already set for the other jobs; the social job needs it too | Yes |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Already set for uploads; rendered videos go there so Instagram can download them | Yes in production |

<a id="storage"></a>

## 6. Storage

Instagram downloads each video from a public URL. In production the admin's browser uploads the rendered video straight to Cloudinary (signed by our server, into the `social/` folder), which skips Vercel's 4.5 MB request limit. A browser that can only make WebM is fine there: Cloudinary hands Instagram an MP4. In local dev, videos are saved under `public/uploads/social/`, which Meta can't reach, so test real publishing on a deployed site.

<a id="browser"></a>

## 7. How posting works

- **Auto-queue** (Settings): when a piece is approved, the job adds a draft for it, with the caption template filled in and the artist's Instagram @handle credited (from their links page or verification request).
- **Approve** renders the video in the admin's browser (same engine as the artists' Share kit), uploads it and gives it the next free slot (at most N a day, at your chosen New York times).
- **The job** `social-publish` runs once a day at 17:05 UTC, 12:05pm New York (vercel.json, `CRON_SECRET`), so a post scheduled later in the day goes out the next day's run. Vercel Pro allows hourly: set `"5 * * * *"`. It creates a Reels container with the video URL and caption, waits for Instagram to process it, then publishes. A video still processing is finished on the next run. You can also press **Run now** on /admin/jobs, or **Publish now** on a post.
- **Failures** (expired token, Instagram's posting limit, a video it rejects) mark the post **Failed** with the reason and a fix link, raise an admin alert and go in the activity log. Retry from the post.
- **Browser**: approve from Chrome, Edge or Safari. They record MP4 in the page; Firefox can only make WebM.

<a id="consent"></a>

## 8. Artist consent

Artists choose in Studio → Share kit → Videos: **"Let Artfinity feature my work on its social accounts"** (on by default). Turning it off drops their drafts from the queue right away, keeps them out of auto-queue and Promote, and the job skips anything already approved. Posts already on Instagram stay up; take one down from the Instagram app if an artist asks.

## Music

Videos are silent by default; add licensed sounds from Instagram's own library when posting by hand. The optional tracks in the artists' Share kit are generated in the browser, so they're royalty-free. Never upload copyrighted music with a post.
