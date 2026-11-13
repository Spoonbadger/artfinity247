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
- Voice: a friendly NYC gallery owner texting an artist. Warm, direct, a little dry.
- Artfinity is open to artists and buyers anywhere in the US. Don't write copy that says or implies NYC only.
  Name NYC only where it's a fact: prints are made in NYC, painting scans happen in NYC, partner venues are in NYC for now.
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

## 9. Visual style

The help center and the terms page are the reference: a calm page with one painted header, gray-edged boxes,
a readable column (about 68 characters) and clear steps between title, section and body. Match them.

### Colours: Garnet Rose (Nov 2026)

- Garnet `--af-scan` #8b2a4b: the primary button, the logo paint, links and the focus ring. The class and token names
  (`btn-blue`, `text-scan`, `bg-scan-soft`) stayed from the old Scan Blue; they are garnet now.
- Ink `--af-ink` #2e1219 (black cherry) for text and the header button; quiet ink `--af-ink-2` #694c54 for secondary text.
- Page `--af-paper` #fdfaf7 (ivory), sections `--af-wall` #f6ede9 (blush plaster). Boxes stay white.
- Petal `--af-petal` #f0c3cc for text selection and soft paint. Garnet soft `--af-scan-soft` #f6e1e6 behind garnet text.
- Unchanged: sticker yellow (badges, the brush under titles), money green, coral and the error red. Canvas, SVG, QR and
  email renderers can't read CSS variables, so they write garnet as `#8b2a4b`.

### Boxes: gray, not black

- Cards, panels and boxes use `.box` (white, `rounded-2xl`, 1px `border-edge`). `.af-card` and `.af-panel` are older
  names for the same thing. In Tailwind: `border border-edge`.
- Tokens: `--af-edge` #ecdcd8 (box edges), `--af-edge-strong` #957a80 (secondary buttons, segmented controls),
  `--af-field-edge` #8e737a (text inputs and selects).
- A box inside a box loses its border and gets a faint tint. This happens on its own for `.box` inside `.box`;
  elsewhere use `.box-inset`.
- Secondary buttons (`btn btn-ghost`) have a gray edge that turns ink on hover. Solid `btn` and `btn-blue` are unchanged.
- Strong edges stay where they mean "you can type here" or "this is chosen": text inputs and selects use the
  `--af-field-edge` gray (3:1 or more, garnet on focus; `.af-field` keeps its ink border), the selected chip, tab or option card, toggles, and previews of
  printed things (QR cards, link-page and video previews, the certificate).
- Notices use their tone's colour for the edge (`border-sticker`, `border-coral`), never ink.
- Borders are 1px for boxes and 1.5px for buttons and chips. No `border-2 border-ink` on a box.
- One exception, on purpose: **statement cards**. The sign-up, login and password cards (`AuthCard`) and other
  single hero cards on entry pages keep the bold look: 2px ink border with a hard 8–10px ink offset shadow. Use it
  for one focal card on a page, never for lists or dashboards. (Thomas, Nov 2026 review.)
- Brand paint stays where it carries the fun: the home page sticker badge, brush strokes and the dabs on artist
  cards; the yellow sticker "Print all" button and the brush under the earnings number in QR codes.

### Type scale

| Class | Use it for | Looks like |
|---|---|---|
| `.t-page` | The page title (one per page). `StudioPage` and the admin `PageHead` already use it | Display font, 34 to 48px |
| `.t-section` | A heading over a group of cards or a long-form section | Display font, 24px, 28px from 640px up |
| `.t-card` | A card, panel, dialog or table title ("Next up", "Payouts", "Summary") | Body font, bold, 17px |
| `.t-body` | Main text | 16px ink (long reading text: 17px, like the help articles) |
| `.t-muted` | Secondary text, the line under a title | 15px ink-2 |
| `.t-small` | Small print, help text, notes | 13.5px ink-2 |
| `.t-num` | The one hero number on a page (a balance, a total) | Display font, 40 to 56px |
| `.t-hero` | Public pages only: the hero title (home, sell, pricing, about, help, legal) | Display font, 44 to 64px |
| `.t-feature` | Public pages only: section headings on home, sell, pricing and about, so the painted voice stays big | Display font, 32 to 52px |

- The condensed display font is for page titles, section titles and the single hero number. Not for card titles,
  stat tiles, labels or buttons. Headings `h2` to `h6` use the body font unless they have `.t-section`, `.display`
  or `font-display`.
- Minimum sizes: body 15px, small print 13px. 11 and 12px are only for the uppercase `.eyebrow` label and tiny count
  badges.
- `.eyebrow` (12px uppercase) labels a group; it is not a heading for a card.

### Paint

- One painted accent per screen area. Paint marks brand moments, not every element.
- Keep: the logo, artwork, the dab in `EmptyState`, the brush under page titles on public pages, the splotch behind
  the current item in the help and policy side lists, medals and brush moments on artist pages, QR card designs.
- In the Studio and admin, the highlighter goes on the active nav item only, not under page titles too.
- No dab in front of every section heading. Inside the Studio and admin (`.af-app`) a `.paint-dab` placed
  directly inside an `h2`, `h3`, `h4` or `legend` is hidden.
- Nav dabs are gray; only the current page's dab is in colour. Studio folder icons sit on one muted tint; the folder
  you are in shows its colour.
- No coloured dots before stat labels. Coloured dots stay where they carry meaning: status, chart legends.
