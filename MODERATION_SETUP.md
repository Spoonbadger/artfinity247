# Automatic image check setup

Every new artwork, and every replaced image, can be pre-screened by an image moderation service before it goes live. The goal is fewer surprises for admins, not gatekeeping art: **artistic nudity is allowed with a sensitive label**, so the check suggests labels and only holds the clear cases for a person.

The code is in `lib/moderation/`. It's off until you set `IMAGE_MODERATION_PROVIDER`.

## What it does

The check runs in `POST /api/artworks/upload` (and `/api/artworks/update/[slug]` when the image changes), right after the image is stored. It sends the **1600px public preview**, never the private original, and `lib/moderation/policy.ts` decides:

| Result | What happens |
| --- | --- |
| **High** explicit sexual content, gore or a hate symbol, or obviously not artwork (a photo of a person, a meme, a screenshot) | The piece is `PENDING` with `flaggedReason` `auto_moderation:<reason>`. Admins get a "moderation" alert (normal severity). The artist sees: *"A person will take a quick look before this goes live — usually within a day."* Suggested labels are added too. |
| **Moderate** nudity or violence and the artist didn't pick the matching label | The label (`Nudity` or `Violence or gore`) is added and the piece goes live as usual, blurred until buyers tap. The artist's other labels stay. The upload result says: *"We marked this 'Nudity' so it's blurred until buyers tap — change it anytime."* |
| **Clean** | Nothing changes. |

Nudity alone never holds a piece. Only explicit sexual content does.

**It never blocks an artist.** If the provider is down, slow (`IMAGE_MODERATION_TIMEOUT_MS`, default 6000) or misconfigured, the upload carries on exactly as it would without the check. Admins get one `image_check_failed` alert per provider per day. It goes in the digest by default and resolves itself when a check works again.

**Where the result lives.** Each check is stored as an `AdminAction` row (`action = "artwork.auto_check"`, admin `system`) keyed to the artwork, with the scores, the reasons and which labels were added. There's no schema change. In **/admin/moderation**, each card shows the scores (coral = past a threshold) and the verdict. For a piece the check labeled:

- **Approve + keep labels** makes it live with the labels.
- **Approve** makes it live with only the labels the artist chose (the check was wrong).
- **Reject** works as before. Bulk approve keeps the labels.

The admin dashboard's integrations list shows the provider's status under **Image check**.

**Tuning.** All thresholds are in `THRESHOLDS` in `lib/moderation/policy.ts`. Raise a number to flag less, lower it to flag more. Scores are 0–1.

## Choosing a provider

| Provider | Good at | Gaps | Rough cost |
| --- | --- | --- | --- |
| **Sightengine** (recommended) | Separates erotica (artistic nudes) from explicit sexual content, tells illustrated gore from real gore, finds hate symbols (nazi, supremacist, terrorist, confederate) and overlaid text, and does photo vs. illustration | Priced per *model*: each model is one "operation" | Free: 2,000 operations a month (500 a day). Paid plans from about $29/month for 10k operations. The default 6 models cost 6 operations per image, so roughly $0.015 per upload. Trim to `nudity-2.1,gore-2.0,offensive-2.0` (3 operations, about $0.009) |
| **AWS Rekognition** | Cheapest at volume. Detailed labels (explicit vs. non-explicit nudity, blood & gore, hate symbols). Flags illustrated/animated content | Needs an AWS account and an IAM user. No photo-of-a-person or text score | About $1 per 1,000 images (DetectModerationLabels, first 1M a month). New accounts get 5,000 a month free for 12 months |
| **Google Cloud Vision** | Easy to set up (an API key) | SafeSearch's "adult" can't tell a painted nude from porn: on images Google labels as art, adult and violence count as labels and never hold the piece. No hate-symbol category | First 1,000 images a month free, then about $3 per 1,000 (SafeSearch + labels, two features at $1.50 each) |

Prices are approximate as of late 2026. Check each provider's pricing page.

**Recommendation:** use Sightengine with `SIGHTENGINE_MODELS=nudity-2.1,gore-2.0,offensive-2.0` to start. It's the only one that understands art well enough to label nudes rather than hold them. At a few thousand uploads a month, that's the free tier or the ~$29 plan. If volume grows past ~10k uploads a month, AWS is the cheapest.

## Env vars

```bash
IMAGE_MODERATION_PROVIDER=sightengine   # sightengine | google | aws | mock (dev only) | none (default)
IMAGE_MODERATION_TIMEOUT_MS=6000        # optional, 500–30000

# Sightengine (dashboard → API keys)
SIGHTENGINE_USER=
SIGHTENGINE_SECRET=
SIGHTENGINE_MODELS=nudity-2.1,gore-2.0,offensive-2.0,violence,text,type   # optional (this is the default); add ",faces" for the photo-of-a-person score

# Google Cloud Vision (Cloud console → APIs & Services → Credentials; enable the Cloud Vision API; restrict the key to it)
GOOGLE_VISION_API_KEY=

# AWS Rekognition (IAM user with only rekognition:DetectModerationLabels)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
```

Every provider is called with plain `fetch`: no SDKs. AWS requests are signed with Signature V4 in `lib/moderation/providers.ts`.

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
| `timeout` | the provider never answers: the upload goes through after the timeout, plus an alert |
| `error` | the provider fails: the upload goes through, plus an alert |
| anything else | clean |

Unit checks (normalizers against sample responses for each provider, the AWS signer against AWS's test vector, the policy branches and the mock guard):

```bash
node --test lib/moderation/moderation.test.mjs
```

## Checking existing artworks

```bash
node --env-file=.env scripts/moderate-backfill.mjs --limit 50        # dry run: prints what would happen
node --env-file=.env scripts/moderate-backfill.mjs --limit 50 --apply
```

The backfill never takes a live piece down. With `--apply`, it adds suggested labels, and it flags held pieces (`auto_moderation:<reason>`) so they show in **/admin/moderation → To review** while staying live. It also stores the scores. Pieces that already have a result are skipped unless you pass `--all`. Every image is a paid call, so start with `--limit`.
