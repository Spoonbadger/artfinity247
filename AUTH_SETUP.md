# Social sign-in setup (Google, Apple, Facebook, Instagram)

Artfinity can show **Continue with Google / Apple / Facebook / Instagram** on the log-in page and on step 1 of sign-up.
Each button appears **only when that provider's env vars are set**. Leave a provider's vars out and its button never shows, so nothing half-configured reaches production.

The code lives in `lib/oauth/*`. The routes are `GET /api/auth/oauth/<provider>` (start) and `/api/auth/oauth/<provider>/callback` (GET, plus POST for Apple).

## Redirect URIs to register

Register these **exactly**, character for character, in each provider console. They're built from `NEXT_PUBLIC_APP_URL`.

| Provider  | Production                                                    | Local                                                     |
|-----------|---------------------------------------------------------------|-----------------------------------------------------------|
| Google    | `https://theartfinity.com/api/auth/oauth/google/callback`     | `http://localhost:3000/api/auth/oauth/google/callback`    |
| Apple     | `https://theartfinity.com/api/auth/oauth/apple/callback`      | not supported (Apple needs HTTPS on a real domain; use a tunnel such as ngrok or a staging site) |
| Facebook  | `https://theartfinity.com/api/auth/oauth/facebook/callback`   | `http://localhost:3000/api/auth/oauth/facebook/callback` (Facebook allows localhost while the app is in Development mode) |
| Instagram | `https://theartfinity.com/api/auth/oauth/instagram/callback`  | not supported (Instagram needs HTTPS; use a tunnel)        |

If you also run `www.theartfinity.com` or a staging domain, register those URIs too. Set `NEXT_PUBLIC_APP_URL` on each deploy to the domain it serves.

## Env vars

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=          # the Services ID, e.g. com.theartfinity.web (NOT the App ID)
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=        # contents of the .p8 file; real newlines or \n escapes both work
FACEBOOK_CLIENT_ID=       # Meta App ID
FACEBOOK_CLIENT_SECRET=   # Meta App secret
INSTAGRAM_CLIENT_ID=      # Instagram app ID (shown under Instagram > API setup with Instagram login)
INSTAGRAM_CLIENT_SECRET=  # Instagram app secret (a different value from the Facebook App secret)
# META_GRAPH_VERSION=v23.0   # optional; bump when Meta retires the version
```

`JWT_SECRET` must be set, as it already is. It signs the session and the short-lived OAuth cookies.

---

## Google

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create or pick a project, for example "Artfinity".
2. **APIs & Services → OAuth consent screen** (now called **Google Auth Platform → Branding / Audience / Data access**):
   - User type: **External**.
   - App name "Artfinity", support email, logo (optional, but a logo triggers brand verification), app home page `https://theartfinity.com`, privacy policy `https://theartfinity.com/privacy-policy`, terms `https://theartfinity.com/terms-and-conditions`.
   - Authorized domains: `theartfinity.com`.
   - Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. These are non-sensitive, so no security review is needed.
   - Audience: **Publish app** (move it from Testing to In production). While it's in Testing, only the test users you list can sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, name "Artfinity web".
   - Authorized JavaScript origins: `https://theartfinity.com`, `http://localhost:3000`.
   - Authorized redirect URIs: the two Google URIs from the table above.
4. Copy the **Client ID** into `GOOGLE_CLIENT_ID` and the **Client secret** into `GOOGLE_CLIENT_SECRET`.

Flow: authorization code + PKCE + nonce. The ID token is verified against Google's JWKS, and its issuer, audience, expiry and nonce are checked. An existing page is linked only when `email_verified` is true.

## Apple (Sign in with Apple)

You need a paid **Apple Developer Program** membership ($99/yr). Apple won't redirect to `localhost` or plain `http`.

1. Go to [developer.apple.com → Certificates, IDs & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. **Identifiers → + → App IDs → App**. Use the description "Artfinity" and the bundle ID `com.theartfinity.app`, tick **Sign in with Apple**, then Continue and Register. Apple needs this as the "primary App ID" even with no iOS app.
3. **Identifiers → + → Services IDs**. Use the description "Artfinity web" and the identifier `com.theartfinity.web`. **This identifier is `APPLE_CLIENT_ID`.** Register it, open it, tick **Sign in with Apple → Configure**:
   - Primary App ID: the one from step 2.
   - Domains and subdomains: `theartfinity.com`. Add your staging domain too if you have one.
   - Return URLs: `https://theartfinity.com/api/auth/oauth/apple/callback`.
   - Save, then Continue and Save again.
4. **Keys → +**. Name it "Artfinity Sign in with Apple", tick **Sign in with Apple → Configure**, pick the primary App ID, then Continue and Register. **Download the .p8 file**: it can be downloaded only once.
   - The **Key ID** shown goes in `APPLE_KEY_ID`.
   - The .p8 file's contents go in `APPLE_PRIVATE_KEY`.
5. Your **Team ID** is at the top right of the developer site (Membership details). Put it in `APPLE_TEAM_ID`.
6. **Private relay emails.** People can choose "Hide my email", and then we get an address like `abc123@privaterelay.appleid.com`. Mail to it reaches them only if our sending domain is registered with Apple:
   - Go to **Certificates, IDs & Profiles → Services → Sign in with Apple for Email Communication → Configure**.
   - Add the domain `theartfinity.com` and the sending addresses (`notifications@theartfinity.com`, `no-reply@theartfinity.com`). Make sure SPF (and DKIM through Resend) pass for them.

Notes:
- The client secret is a short-lived ES256 JWT made from the key on each sign-in, so there's nothing to rotate every 6 months.
- Apple sends the person's name **only on their first sign-in**. We keep it in the pending sign-up cookie straight away, but if someone abandons sign-up and comes back, Apple won't send it again and they type it. Apple's email is always treated as verified.
- Apple POSTs back to the callback (`response_mode=form_post`), so its state cookie is `SameSite=None; Secure`.

## Facebook

1. Go to [developers.facebook.com → My Apps → Create app](https://developers.facebook.com/apps/). Choose the use case **Authenticate and request data from users with Facebook Login** and the app type **Consumer** (or "None" on older screens). Name it "Artfinity".
2. **Use cases → Facebook Login → Customize → Settings**:
   - Valid OAuth Redirect URIs: the Facebook URIs from the table above.
   - Client OAuth login **on**, Web OAuth login **on**, Enforce HTTPS **on**, Use Strict Mode for redirect URIs **on**.
   - Under Permissions, add **email** (public_profile is there by default).
3. **App settings → Basic**: fill in the Privacy Policy URL, Terms of Service URL, App icon, Category and **User data deletion** (a URL or instructions, such as the contact page). Copy the **App ID** into `FACEBOOK_CLIENT_ID` and the **App secret** into `FACEBOOK_CLIENT_SECRET`.
4. **Business verification / App Review.** `email` and `public_profile` have Standard Access, so no App Review is needed for them. Switch the app from **Development** to **Live** (top toggle). Until then, only people with a role on the app can sign in.

Facebook doesn't say whether the email it returns is verified, so Artfinity treats it as **unverified**. It prefills sign-up but **never** links to an existing page. Someone whose email already has a page sees "Log in with your password, then connect Facebook from Studio → My page."

## Instagram

Meta retired the Instagram Basic Display API on **December 4, 2024**. Instagram sign-in now uses **"Instagram API with Instagram Login"**. Its limits:

- **Only Instagram professional accounts** (Business or Creator) can sign in. Personal accounts get an error from Instagram. Switching is free in the Instagram app: Settings → Account type and tools → Switch to professional account. Many artists already use Creator accounts, but not all.
- **No email is returned.** Sign-up asks for one.
- We get the account id, **@username**, display name and profile picture. The username prefills their Instagram link on `/@handle/links`.
- **App Review is required** for `instagram_business_basic` before anyone outside the app's own testers can sign in. Expect a screencast and a written use-case description, and allow days to weeks.

If that's too limiting, leave `INSTAGRAM_CLIENT_ID` unset and the button stays hidden. Artists can still add their Instagram link in Studio.

Setup:
1. In the same Meta app (or a new **Business** type app), go to **Add use case → Manage messaging & content on Instagram** (labelled "Instagram API" in some consoles), then **API setup with Instagram login**.
2. Under **3. Set up Instagram business login → Business login settings**, enter the OAuth redirect URIs (the Instagram URIs from the table above; HTTPS only).
3. On that page, copy the **Instagram app ID** into `INSTAGRAM_CLIENT_ID` and the **Instagram app secret** into `INSTAGRAM_CLIENT_SECRET`. These are **not** the Facebook App ID and secret.
4. Permissions: only **instagram_business_basic**.
5. To test before review, go to **App roles → Roles → Add people → Instagram Tester**, add your professional account, then accept the invite in Instagram (Settings → Apps and websites → Tester invites).
6. **App Review → Requests**: request Advanced Access for `instagram_business_basic`. Explain that it's used "to let artists sign in to Artfinity with their Instagram professional account and show their Instagram handle on their artist page", and attach a screencast of the sign-in. Business verification may be required. Then set the app to **Live**.

---

## How accounts are matched

1. If the provider account is already connected, we log in.
2. If the provider **verifies** the email (Google with `email_verified`, or Apple) and it matches an existing page, we connect the provider to that page and log in.
3. If the email is unverified (Facebook) or missing (Instagram) and it matches a page, we refuse. The person logs in another way and connects the provider from Studio.
4. Otherwise it's a new person. They go to sign-up with their name, email and photo prefilled from a signed, 30-minute cookie (never from URL parameters). They still pick a handle and city and do the first upload. The account is created with no password plus the connected provider.

Closed accounts can't sign in, with the same message as password login. Sessions use the same `auth-token` JWT (30 days) and the same referral device signal as password login.

**Known risk: account pre-hijacking.** Artfinity doesn't verify emails at sign-up yet. Someone could create a page, or change a page's email in Account details, using an address they don't own. When the real owner later uses "Continue with Google", rule 2 connects them to that page. Adding email verification, and applying rule 2 only to pages with a verified email, closes this.

In Studio → My page → **Sign-in methods**, artists can connect and disconnect providers and set a password. The last sign-in method can't be removed. Forgot-password on an account with no password emails "You sign in with Google" instead of a reset link.

## Testing locally without provider keys

```
ALLOW_MOCK_OAUTH=1 npm run dev
```

This adds a **Continue with Mock (dev)** button. Its consent page lets you pretend to be any account: with or without an email, verified or not, with an Instagram username. It runs the same state, PKCE, nonce and ID-token checks as Google, using a throwaway key. It's **off whenever `NODE_ENV=production`**, whatever else is set (`lib/oauth/mockGuard.ts`).

Unit checks: `npm run test:oauth` covers ID-token verification (signature, issuer, audience, expiry, nonce, algorithm), the Apple client secret, and the production guard.
