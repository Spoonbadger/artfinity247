# Automatic image check setup

Every new artwork, and every replaced image, can be pre-screened by an image moderation service before it goes live. The goal is fewer surprises for admins, not gatekeeping art: **artistic nudity is allowed with a sensitive label**, so the check suggests labels and only holds the clear cases for a person.

The code is in `lib/moderation/`. It's off until you set `IMAGE_MODERATION_PROVIDER`.

The image check also feeds **auto-approval and auto-verification** (`lib/trust/`, owner switches in **/admin/settings/auto-approval**): clean uploads go live by themselves, anything questionable waits for a person with plain reasons. See [Auto-approval](#auto-approval-and-auto-verification) below.

## What it does

The check runs in `POST /api/artworks/upload` (and `/api/artworks/update/[slug]` when the image changes), right after the image is stored. It sends the **1600px public preview**, never the private original, and `lib/moderation/policy.ts` decides:

| Result | What happens |
| --- | --- |
| **High** explicit sexual content, gore or a hate symbol, or obviously not artwork (a photo of a person, a meme, a screenshot) | The piece is `PENDING` with `flaggedReason` `auto_moderation:<reason>`. Admins get a "moderation" alert (normal severity). The artist sees: *"A person will take a quick look before this goes live — usually within a day."* Suggested labels are added too. |
| **Moderate** nudity or violence and the artist didn't pick the matching label | The label (`Nudity` or `Violence or gore`) is added and the piece goes live as usual, blurred until buyers tap. The artist's other labels stay. The upload result says: *"We marked this 'Nudity' so it's blurred until buyers tap — change it anytime."* |
| **Clean** | Nothing changes. |

Nudity alone never holds a piece. Only explicit sexual content does.

**It never blocks an artist.** The upload is always saved. If the provider is down, slow (`IMAGE_MODERATION_TIMEOUT_MS`, default 6000) or misconfigured: with auto-approval **off**, the upload carries on exactly as it would without the check; with auto-approval **on**, the piece is saved and waits for a person (fail safe: a check that didn't run never approves). Admins get one `image_check_failed` alert per provider per day. It goes in the digest by default and resolves itself when a check works again.

**Where the result lives.** Each check is stored as an `AdminAction` row (`action = "artwork.auto_check"`, admin `system`) keyed to the artwork, with the scores, the reasons and which labels were added. There's no schema change. In **/admin/moderation**, each card shows the scores (coral = past a threshold) and the verdict. For a piece the check labeled:

- **Approve + keep labels** makes it live with the labels.
- **Approve** makes it live with only the labels the artist chose (the check was wrong).
- **Reject** works as before. Bulk approve keeps the labels.

The admin dashboard's integrations list shows the provider's status under **Image check**.

**Tuning.** All thresholds are in `THRESHOLDS` in `lib/moderation/policy.ts`. Raise a number to flag less, lower it to flag more. Scores are 0–1.

## Choosing a provider

| Provider | Good at | Gaps | Rough cost |
| --- | --- | --- | --- |
| **Local** (`local`, NSFWJS on our server) | Free, no account, no data leaves the server. Nudity and explicit content, and it reads paintings as "Drawing", so painted nudes are labeled, not held | **Nudity and explicit content only.** No gore, hate symbols, AI-generated, faces or web copies. About 1.5 s per image on the CPU | $0 |
| **Sightengine** (recommended) | Separates erotica (artistic nudes) from explicit sexual content, tells illustrated gore from real gore, finds hate symbols (nazi, supremacist, terrorist, confederate) and overlaid text, and does photo vs. illustration | Priced per *model*: each model is one "operation" | Free: 2,000 operations a month (500 a day). Paid plans from about $29/month for 10k operations. The default 6 models cost 6 operations per image, so roughly $0.015 per upload. Trim to `nudity-2.1,gore-2.0,offensive-2.0` (3 operations, about $0.009) |
| **AWS Rekognition** | Cheapest at volume. Detailed labels (explicit vs. non-explicit nudity, blood & gore, hate symbols). Flags illustrated/animated content | Needs an AWS account and an IAM user. No photo-of-a-person or text score | About $1 per 1,000 images (DetectModerationLabels, first 1M a month). New accounts get 5,000 a month free for 12 months |
| **Google Cloud Vision** | Easy to set up (an API key) | SafeSearch's "adult" can't tell a painted nude from porn: on images Google labels as art, adult and violence count as labels and never hold the piece. No hate-symbol category | First 1,000 images a month free, then about $3 per 1,000 (SafeSearch + labels, two features at $1.50 each) |

Prices are approximate as of late 2026. Check each provider's pricing page.

**Recommendation: local + the Sightengine free tier for new artists and verification.**

```bash
IMAGE_MODERATION_PROVIDER=local
IMAGE_MODERATION_EXTRA=sightengine
SIGHTENGINE_USER=...
SIGHTENGINE_SECRET=...
```

Every upload gets the free local check plus the duplicate and text checks. Only new artists' uploads (account under 7 days, or fewer than 3 approved pieces) also go to Sightengine for gore, hate symbols and AI-generated (`gore-2.0,offensive-2.0,genai`, 3 operations). Verification photos go to Sightengine for faces and AI-generated (`faces,genai`, 2 operations). Established artists never use Sightengine.

| Setup | What it costs |
| --- | --- |
| Local only | $0. Established artists auto-approve; new artists' first 3 pieces and all verification requests wait for a person |
| Local + Sightengine extra (recommended) | $0 up to 2,000 Sightengine operations a month: about 650 new-artist uploads, or fewer if verification photos use some. Then about $29/month for 10k |
| Sightengine for everything | `SIGHTENGINE_MODELS=nudity-2.1,gore-2.0,offensive-2.0,genai` is 4 operations per upload, so about 500 uploads a month free, then about $29/month |

The month's Sightengine operations are counted on **/admin/settings/auto-approval** against the 2,000 free. **Switch fully to Sightengine past the free tier** (`IMAGE_MODERATION_PROVIDER=sightengine`): once you pay, its art-aware nudity model is better than local, and every upload gets every check. If volume grows past ~10k uploads a month, AWS is the cheapest (no AI-generated check).

## Env vars

```bash
IMAGE_MODERATION_PROVIDER=local         # local | sightengine | google | aws | mock (dev only) | none (default)
IMAGE_MODERATION_EXTRA=sightengine      # optional: new artists' uploads and verification photos (sightengine, or mock in dev)
IMAGE_MODERATION_TIMEOUT_MS=6000        # optional, 500–30000

# Sightengine (dashboard → API keys)
SIGHTENGINE_USER=
SIGHTENGINE_SECRET=
SIGHTENGINE_MODELS=nudity-2.1,gore-2.0,offensive-2.0,genai   # recommended when Sightengine is the main provider
                                                             # (default: nudity-2.1,gore-2.0,offensive-2.0,violence,text,type,genai)
SIGHTENGINE_EXTRA_MODELS=gore-2.0,offensive-2.0,genai        # optional (this is the default) for the extra check
# Verification photos always send faces,genai (2 operations).

# Website check for auto-verification, dev only: lets the fetch reach a test site on localhost. Ignored in production.
# TRUST_FETCH_ALLOW_LOCAL=1

# Google Cloud Vision (Cloud console → APIs & Services → Credentials; enable the Cloud Vision API; restrict the key to it)
GOOGLE_VISION_API_KEY=

# AWS Rekognition (IAM user with only rekognition:DetectModerationLabels)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
```

Every remote provider is called with plain `fetch`: no SDKs. AWS requests are signed with Signature V4 in `lib/moderation/providers.ts`.

`genai` (Sightengine's AI-generated model, read as `type.ai_generated`) is marked "unverified against live docs" in the code: if Sightengine answers without that score, auto-approval treats the AI check as not run and holds the piece (fail safe), so check one real response after setting it up.

## The local provider (NSFWJS)

`IMAGE_MODERATION_PROVIDER=local` runs [NSFWJS](https://github.com/infinitered/nsfwjs) (MIT, MobileNetV2) with pure `@tensorflow/tfjs` on our own server. No native binary, so it runs on Vercel serverless. `lib/moderation/local.ts` loads it once per server instance; sharp decodes the image.

- **Model files** ship with the app in `data/models/nsfwjs/mobilenet_v2` (`model.json` 118 KB + one 2.6 MB weight file). No CDN at run time. `scripts/extract-nsfw-model.mjs` copies them out of the nsfwjs package; run it again after upgrading nsfwjs.
- **Server only.** TensorFlow and nsfwjs are `serverComponentsExternalPackages` in `next.config.mjs` and loaded with a dynamic import, so they never reach the browser bundle. The nsfwjs package's own base64 copies of the models (38 MB) are excluded from the server trace.
- **Speed** (dev box, pure JS CPU backend): about 1.5 s to load the model on a cold start, then 1.3 to 1.9 s per 1600px preview. Well inside the 6 s timeout. If it gets slow, `@tensorflow/tfjs-backend-wasm` is the next step (not installed).
- **Mapping.** NSFWJS returns five classes that add up to 1: Drawing, Neutral, Sexy, Porn, Hentai.

| Score | From | What it does |
| --- | --- | --- |
| Explicit (`sexual`) | Porn + Hentai | Held at 0.85 (`THRESHOLDS.review.sexual`) |
| Nudity | 1.5 x (Sexy + Porn + Hentai), max 1 | Labeled "Nudity" at 0.5 (a raw share of 0.33). `LOCAL_NUDITY_GAIN` in providers.ts |
| Gore, violence, hate | not checked | Hidden on the moderation card ("Not checked: gore, hate symbols, AI-made"), not shown as 0 |

Because the classes add up to 1, explicit can only reach 0.85 when Drawing + Neutral + Sexy is 0.15 or less. A painting reads as Drawing, so a painted nude is labeled, never held. Sexy never counts as explicit. **Measured** on 25 real paintings in `public/uploads/arts` (Monet, Klimt, Schiele, Vermeer, Van Gogh, Leonardo, Tanner) plus the seed art and room photos: none held, none labeled. The highest false score was Porn 0.21 on one photo (explicit 0.21, far under 0.85). The flip side: classical nudes (Leonardo's Vitruvian Man, Schiele's Death and the Maiden) come back mostly Neutral, so local doesn't add the "Nudity" label to them. It errs toward letting art through, never toward holding it; the artist's own label still applies, and Sightengine labels nudes much better. Raise `LOCAL_NUDITY_GAIN` to label more.

## Testing without a provider

`IMAGE_MODERATION_PROVIDER=mock` scores images from words in the **title**. The upload form fills the title from the file name, so naming the file is enough. The mock **never runs in production**: there it counts as `none`, and the integrations list shows red.

| File name contains | Result |
| --- | --- |
| `nude`, `nudity` | labeled Nudity, live |
| `violent`, `violence` | labeled Violence or gore, live |
| `nsfw`, `explicit`, `porn` | held: explicit sexual content |
| `gore`, `bloody` | held: graphic gore |
| `hate`, `nazi` | held: hate symbol |
| `selfie` / `meme` / `screenshot` | held: not artwork |
| `aiart` / `midjourney` | AI-generated 0.97 (held when auto-approval is on) |
| `stock` / `stolen` | found elsewhere online (only the mock fills this; held when auto-approval is on) |
| `timeout` | the provider never answers: after the timeout, an alert; with auto-approval on, the piece waits for a person |
| `error` | the provider fails: an alert; with auto-approval on, the piece waits for a person |
| anything else | clean |

`IMAGE_MODERATION_EXTRA=mock` works too (dev only), for trying the tiers with `IMAGE_MODERATION_PROVIDER=local`. For verification photos the mock finds one face unless the photo's URL has `noface` or `landscape`.

Unit checks (normalizers against sample responses for each provider, the AWS signer against AWS's test vector, the policy branches and the mock guard):

```bash
npm run test:trust     # also runs lib/trust/trust.test.mjs (auto-approval, auto-verify, SSRF guard)
```

## Checking existing artworks

```bash
node --env-file=.env scripts/moderate-backfill.mjs --limit 50        # dry run: prints what would happen
node --env-file=.env scripts/moderate-backfill.mjs --limit 50 --apply
```

The backfill never takes a live piece down. With `--apply`, it adds suggested labels, and it flags held pieces (`auto_moderation:<reason>`) so they show in **/admin/moderation → To review** while staying live. It also stores the scores. Pieces that already have a result are skipped unless you pass `--all`. Every image is a paid call, so start with `--limit`.

## Auto-approval and auto-verification

One trust engine (`lib/trust/`) with pure decision functions: signals in, `{ decision: "approve" | "hold", reasons }` out. Every decision is stored as an `AdminAction` row by `system`: `artwork.auto_decision` and `verification.auto_decision`. No schema change. The owner switches and numbers are on **/admin/settings/auto-approval** (owner only, audited as `setting.trust`).

### Artworks

A new upload goes live by itself when **all** of these pass:

| Check | Holds when | Default |
| --- | --- | --- |
| Image check | it didn't run (no provider, error, timeout), or it held the piece (explicit 0.85, gore 0.85, hate 0.8, photo of a person 0.9...) | `THRESHOLDS` in policy.ts |
| Duplicate | the dHash matches another artist's piece (6 of 64 bits or fewer) | `DUPLICATE_DISTANCE` |
| AI-generated | the score is 0.9 or more (only when a check covers it: Sightengine `genai`) | `AI_THRESHOLD` in lib/trust/artwork.ts |
| Copies online | any full match elsewhere (no provider yet; follow-up: Google Vision web detection as a second check) | |
| Text | a slur or strong profanity, a link, an email, a phone number, or a nonsense title | lib/trust/text.ts |
| Reports | the artist has an open report (DMCA, AI or content) on any piece | |
| Suspended | the artist is suspended | |
| Upload pace | a new artist already uploaded N pieces in the last 24 hours | N = 10 |
| Print size | the file is too small to print | the existing upload rule |

"New artist" = account younger than the account-age setting (7 days), or fewer than 3 approved pieces. Admins never are.

**Tiers.** An established artist needs only nudity covered, so the free local check is enough. A new artist also needs gore and hate symbols covered (Sightengine, as the main provider or the extra check, or AWS). When that can't run, the new artist falls back to today's rule: their first 3 pieces wait for a person (verified artists still go live).

**Fail safe.** Auto-approval defaults ON only when a provider is ready; otherwise the tab shows "Needs IMAGE_MODERATION_PROVIDER". With no provider, or the switch off, today's rule applies: verified artists, admins and artists with 3+ approved pieces go live; everyone else waits.

**Held pieces** are `PENDING` with a `flaggedReason` the queue reads: `possible_duplicate:<id>`, `auto_moderation:<reason>`, or `auto_hold:<reason>`. The artist sees only "A person will take a quick look before this goes live, usually within a day." The moderation card says "Auto-approved: clean image, no duplicate, …" or "Held: <reasons>".

**Spot checks.** 1 in 20 auto-approved pieces (setting; 0 = off) lands on **Moderation → Spot check**. They stay live; "Looks good" clears one, "Take down" rejects it.

**Reports.** A report on a live piece puts it back in **To review** with a flag (`Report: <reason>`). It stays live, as DMCA notices always have; taking it down is still a person's call in /admin/reports. Dismissing the report clears the flag.

### Verification

An artist is verified right away when **all** of these pass, and otherwise waits in /admin/verification with the reasons:

1. **They own the link.** Website: the page shows their code (`artfinity-verify-XXXXXXXX`, shown on /studio/verify) or a link to `theartfinity.com/@handle`. The fetch is SSRF-safe (`lib/trust/safeFetch.ts`): http/https only, every resolved address must be public (private, loopback, link-local, CGNAT and reserved ranges refused, IPv4 and IPv6), the connection is pinned to the checked address, 5 s, 1 MB, 3 redirects each re-checked, user agent `ArtfinityVerify/1.0`. Instagram: proven only when the artist signed in with or connected Instagram (the existing Instagram sign-in) and its @username matches. Without Instagram sign-in set up, Instagram-only requests wait: "Instagram can't be checked automatically yet". Public profile scraping isn't used; Instagram blocks it.
2. **The photo check** (Sightengine `faces,genai`): at least one face, not AI-made (0.9). Without a provider that sees faces, every request waits.
3. **Track record:** email confirmed, 1+ approved piece, account at least 7 days old (setting), no open reports, no duplicate flags (open, or rejected as a duplicate), not suspended.

**Auto-revoke.** When an admin upholds a DMCA notice (takedown in /admin/reports) or suspends an artist, the seal comes off, the artist gets the usual "verification was removed" email, admins get an alert, and it's recorded as `verification.auto_revoke`.

### Follow-ups

- Google Vision web detection as a second check for stock or stolen images (full matches elsewhere). The decision code already holds on `webFullMatches`; only the provider call is missing.
- `@tensorflow/tfjs-backend-wasm` if the local check gets slow.
