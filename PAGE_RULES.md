# Page rules

Every page on Artfinity follows these. They exist because pages kept getting crowded, burying the one thing
that matters, and filling up with long, samey copy. When in doubt: less, and the important thing first.

## 1. Three seconds to know what to do

- Someone landing on the page should know what it is and what to do first within 3 seconds.
- The top of the page has: a title, at most one short line under it (12 words or fewer, or none), and **one** primary
  button (`btn-blue`).
- If a page has no obvious first action, the top shows the most important number or item instead
  (Money: balance and next payout date; Sales: the latest sale).

## 2. Most important first

- On a phone (390 × 844) the first screen shows the main thing: the art on a painting page, the balance on Money,
  the card preview on QR codes, the queue of things to do on Admin home. Settings, explanations and history go below.
- Order sections by how often people need them, not by how the data is stored.

## 3. One primary action per screen

- One `btn-blue` per view. Everything else is secondary (`btn` / `btn-ghost`) or a text link.
- Destructive actions (delete, close account) go at the bottom, never next to the main button.
- Don't show five buttons when one menu ("More") or one row of links will do.

## 4. Hide the advanced stuff

- Good defaults, so most people never touch settings.
- Rarely used options go behind a disclosure ("More options", `<details>`), collapsed by default.
- Never delete a feature to tidy a page. Move it lower, collapse it, or link to it.

## 5. Copy: short, plain, human

- Cut every block of text by about half, then cut again. Labels beat sentences. One idea per sentence, 15 words max.
- Say what the thing does in plain words. Numbers beat adjectives ("Paid by the 5th", not "fast payouts").
- Don't repeat the title in the subtitle, or the button in the sentence above it.
- Don't explain what's obvious from the UI ("Click the button below to…").
- No AI-sounding words or patterns:
  - words: seamless, effortless, elevate, empower, unlock (except the literal Infinity upsell), journey, curated,
    leverage, robust, delve, vibrant, tapestry, game-changer, "whether you're X or Y"
  - patterns: three-part lists for rhythm, "not just X, it's Y", rhetorical questions, exclamation marks, sign-off
    sentences that restate the section
- Voice: a friendly NYC gallery owner texting an artist. Warm, direct, a little dry. NYC only, never another city.
- Help text sits next to the thing it explains, one line, or behind a "How this works" link to the help center.

## 6. Consistent layout

- Studio pages use `StudioPage` (title, optional `sub`, `actions`). Public pages use the site header and footer.
- One spacing scale: 8 / 12 / 16 / 24 / 32 / 48 px. Cards in a row share a height and align tops; grids align to the
  same left edge as the page title.
- Pick one alignment per block: left-aligned text in the Studio and admin; centred only for single focused
  moments (empty states, success screens, the QR preview).
- Same component for the same job: `EmptyState` for nothing-yet, `Problem` for blockers (always with a fix), the
  `lib/feedback.ts` toasts for results.

## 7. Lists, grids and actions

- Every list, grid or table people browse can be sorted (and filtered where it helps). Remember the last choice.
  Admin tables sort by clicking column headers.
- Fewer buttons per item. The item itself is the main click (usually Edit); one or two quick actions with icons;
  everything else (delete, rare tools) lives inside the item's edit page.
- Every icon-only button has a tooltip and an aria-label. Icons and words together beat either alone.
- No double clicks: a button lands on the final screen. Never send people to a page or card whose only job is
  another "Continue" button. "Get Infinity" anywhere starts checkout; "Book a scan" opens the booking form.

## 8. Check it

- Look at it at 390 px and 1280 px. No sideways scrolling, nothing cut off, tap targets at least 40 px.
- Read every line of copy out loud. If it sounds like a brochure or a chatbot, rewrite it.
