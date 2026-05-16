# LegoFuture — Design System

A LEGO-inspired visual language for forecasting sealed LEGO investments.
This document is the source of truth for color, type, geometry, components, and tone.

> **Trademark note.** LegoFuture is _inspired by_ LEGO's visual identity but is not affiliated with, endorsed by, or sponsored by the LEGO Group. We do not use the LEGO wordmark, the LEGO logo, the minifigure silhouette, or literal stud-grid renderings. We borrow the _spirit_: chunky type, primary colors, hard-edge shadows, and a click-into-place tactility.

---

## 1. Brand voice & principles

LegoFuture sounds like a confident builder who happens to also be a sharp investor.

- **Joyful, not frivolous.** Forecasting is serious; the presentation isn't grim.
- **Builder-minded.** Tangible verbs: _build a position_, _stack the set_, _snap on a scenario_.
- **Clarity over cleverness.** Plain numbers. No jargon without a definition one click away.
- **Confident defaults.** The site picks a reasonable filter, sort, and scenario so a first-time visitor sees a recommendation in under five seconds.
- **Microcopy is short and punchy.** Two- to six-word headlines. Five- to twelve-word descriptions.

---

## 2. Color

### 2.1 Primary palette

| Token | Hex | Usage |
|---|---|---|
| `--color-brick-red` | `#D01012` | Primary CTAs, "Strong Buy" recommendation, alerts |
| `--color-sunshine-yellow` | `#FFCF00` | Hero background block, "Hold/Watch" recommendation, highlight |
| `--color-bright-blue` | `#006DB7` | Secondary CTAs, links, focus rings, "Buy" recommendation |
| `--color-pure-green` | `#00852B` | Success states, "Retired & Climbing", positive ROI |
| `--color-jet-black` | `#1B1B1B` | Body text, borders, hard shadows |
| `--color-pure-white` | `#FFFFFF` | Card surfaces |

### 2.2 Neutrals

| Token | Hex | Usage |
|---|---|---|
| `--color-paper` | `#FAF7F0` | Page background (warm off-white) |
| `--color-slate-50` | `#F4F4F2` | Subtle surface |
| `--color-slate-100` | `#E5E4E0` | Hairline divider, disabled fill |
| `--color-slate-300` | `#B7B6B0` | Disabled text, secondary borders |
| `--color-slate-500` | `#6E6D68` | Caption, meta |
| `--color-slate-700` | `#3A3A37` | Secondary body |
| `--color-slate-900` | `#1B1B1B` | Same as Jet Black; primary text |

### 2.3 Semantic tokens

| Token | Hex | Usage |
|---|---|---|
| `--color-success` | `#00852B` | Profitable, on-track |
| `--color-warning` | `#FFCF00` | Watch, mid-confidence |
| `--color-danger` | `#D01012` | Loss, "Avoid", expired data |
| `--color-info` | `#006DB7` | Neutral informational |

### 2.4 Recommendation color mapping

| Recommendation | Color |
|---|---|
| Strong Buy | Brick Red |
| Buy | Bright Blue |
| Hold / Watch | Sunshine Yellow |
| Sell | Slate-700 |
| Avoid | Jet Black with red top band |

### 2.5 Rules

- **Color is never the only signal.** Always pair color with an icon, label, or shape.
- **Maximum two primary brand colors per surface.** Yellow + Red OR Blue + Green; never all four.
- **Backgrounds default to `--color-paper`.** Use white only for cards and modals.
- **Never tint primary colors.** They are display-saturation by design. If you need a softer feel, use neutrals.

---

## 3. Typography

### 3.1 Fonts

- **Display & headings:** `Plus Jakarta Sans`, weight 800. Loaded from Google Fonts. Falls back to `system-ui, sans-serif`. (Plus Jakarta Sans is the closest publicly-licensed analog to LEGO's proprietary Cera Pro.)
- **Body:** `Inter`, weights 400 and 500. Loaded from Google Fonts. Falls back to `system-ui, sans-serif`.
- **Mono (for numbers in tables/charts):** `JetBrains Mono`, weight 500. Falls back to `ui-monospace, monospace`.

### 3.2 Type scale

| Token | Size / Line-height | Weight | Use |
|---|---|---|---|
| `display-1` | 64 / 68 | 800 | Hero headline only |
| `display-2` | 48 / 52 | 800 | Page H1 |
| `h1` | 36 / 40 | 800 | Section opener |
| `h2` | 28 / 32 | 700 | Card / panel title |
| `h3` | 22 / 28 | 700 | Sub-section |
| `body-lg` | 18 / 28 | 400 | Lede paragraphs |
| `body` | 16 / 24 | 400 | Default body |
| `body-sm` | 14 / 20 | 500 | Meta, captions |
| `mono-num` | 16 / 20 | 500 | Numeric cells |
| `eyebrow` | 12 / 16 | 700, uppercase, +1px tracking | Section eyebrow |

### 3.3 Rules

- **Display & H1 are always sentence case** ("Forecast every sealed brick"). No ALL CAPS except `eyebrow`.
- **Headlines never exceed 8 words.**
- **Numbers in cards/tables use `mono-num`** so columns align.

---

## 4. Geometry, spacing & elevation

### 4.1 Grid & spacing

- Base unit: **8 px**. All spacing is a multiple of 4 px (half-step allowed).
- Standard scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`.
- Max content width: `1240px`. Outer gutters: 32 px desktop / 16 px mobile.

### 4.2 Radius

| Token | Value | Use |
|---|---|---|
| `--radius-chip` | 4 px | Chips, small tags |
| `--radius-card` | 8 px | Cards, panels, inputs |
| `--radius-hero` | 16 px | Hero blocks, large surfaces |
| `--radius-pill` | 999 px | Pill buttons |

### 4.3 Borders

- All interactive surfaces (button, card, input, chip) have a **2 px solid `--color-jet-black` border**. This gives the "ABS plastic" feel and doubles as an a11y outline.
- Decorative surfaces (hero, section bands) have **no border**.

### 4.4 Elevation — the "click shadow"

- **No soft blur shadows.** Use a hard offset shadow that mimics a brick casting a sharp shadow on a sunny tabletop.

| Token | Shadow |
|---|---|
| `--shadow-click-sm` | `4px 4px 0 0 var(--color-jet-black)` |
| `--shadow-click` | `6px 6px 0 0 var(--color-jet-black)` |
| `--shadow-click-lg` | `8px 8px 0 0 var(--color-jet-black)` |

- On `:active`, the element **translates by the shadow offset and the shadow collapses** — the click-into-place effect.

### 4.5 Stud-inspired motifs

- A `StudStrip` component renders **4 small filled circles, 8 px diameter, 8 px gap**, placed at the top edge of a card or the leading edge of a CTA. It evokes a brick stud row without being a literal stud render.
- Never use a full stud grid as a texture.

---

## 5. Components

### 5.1 BrickButton

- Variants: `primary` (Brick Red), `secondary` (Bright Blue), `accent` (Sunshine Yellow with black text), `ghost` (transparent fill, 2 px border).
- Sizes: `sm` (h 36 / px 16 / type body-sm), `md` (h 44 / px 20 / type body), `lg` (h 56 / px 28 / type body-lg).
- Always: 2 px black border, `--radius-card`, `--shadow-click`, sentence-case label, optional leading icon (`lucide-react`, 1.75 stroke).
- Hover: lift 1 px (translate -1 px / shadow grows to `--shadow-click-lg`).
- Active: press down (translate +6 px both axes / shadow collapses to 0).
- Focus: 3 px outline in `--color-bright-blue` at 2 px offset.

### 5.2 BrickCard

- White surface, 2 px black border, `--radius-card`, `--shadow-click`.
- Optional `accentTop` prop — adds a solid color band 8 px tall at the top, keyed to the card's domain meaning (recommendation color, theme color, etc.).
- Optional `studStrip` prop — renders a `StudStrip` along the top in the accent color.
- Internal padding: 24 px default, 16 px compact.

### 5.3 ChipBadge

- Filled background in palette color, 2 px black border, `--radius-chip`, type `body-sm` uppercase tracking +0.5.
- Used for: recommendation, scenario, retired/current, theme.
- Active state: thicker 3 px border in `--color-jet-black`.

### 5.4 StudStrip

- Decorative-only. Four 8 px circles, 8 px gap, in the passed color.
- Default placement: top-left of card, 12 px from top and left edge.

### 5.5 BrickHero

- Full-bleed colored block (default Sunshine Yellow), max-height 560 px desktop / 420 px mobile.
- Left-aligned display-1 headline in `--color-jet-black`.
- Body-lg description.
- One primary BrickButton + optional ghost BrickButton.
- Right side: large abstract brick illustration (SVG, 3 stacked solid rectangles in primary palette, slight rotation, hard black border + click shadow).

### 5.6 SectionDivider

- A 16 px tall horizontal band in a primary color, full-bleed.
- Used between major sections of long pages (methodology) like the courses of a brick wall.

### 5.7 Inputs

- Same 2 px border + `--radius-card`, no shadow at rest.
- Focus: 3 px Bright Blue outline.
- Error: border becomes Brick Red, helper text in Brick Red.

---

## 6. Iconography

- Library: `lucide-react` (already installed).
- Stroke: 1.75 px (slightly chunky to match the typography).
- Default size: 20 px inline / 24 px in CTAs / 16 px in chips.
- Color matches surrounding text by default.

---

## 7. Motion

- Hover transitions: 120 ms ease-out.
- Press/active: 60 ms ease-in (snap).
- Page transitions: none. The site feels static and present, like physical bricks on a shelf.
- No parallax. No scroll-jacking. No autoplaying carousels.
- Reduce-motion: respect `prefers-reduced-motion`; disable hover lift and press translate.

---

## 8. Imagery & illustration

- **Allowed:** abstract brick-shaped illustrations (solid color rectangles with hard borders), real product photos of sealed boxes (sourced from PriceCharting / Rebrickable per their licensing), studio shots on `--color-paper` backgrounds, charts.
- **Forbidden:** the LEGO logo, the LEGO wordmark in LEGO's stylized form, minifigure silhouettes, literal stud-grid textures, official LEGO marketing imagery without explicit license.
- **Background patterns:** allowed — small (24 px) dot pattern in `--color-slate-100` over `--color-paper`, ≤ 15 % opacity.

---

## 9. Charts

- Theme `recharts` to match palette.
- Axes: `--color-slate-700`, 1 px.
- Gridlines: `--color-slate-100`, dashed.
- Series colors in order: Bright Blue, Brick Red, Pure Green, Sunshine Yellow, Slate-700.
- No area fills with soft gradients. Use solid 25 %-opacity fills when needed.
- Tooltip: white BrickCard with 2 px border, body-sm copy.

---

## 10. Accessibility

- WCAG **AA** minimum; AAA where reasonable.
- Body text contrast ≥ 4.5:1; large text ≥ 3:1.
- Focus is always visible (3 px Bright Blue outline, 2 px offset).
- All color signals (recommendation, scenario, status) are accompanied by a label or icon.
- Don't rely on color to convey state in charts; use line style or label markers as well.
- Keyboard: every interactive surface is reachable and operable with Tab/Enter/Space.
- All images have alt text. Decorative SVGs use `aria-hidden="true"`.

---

## 11. Voice & microcopy patterns

| Context | Bad | Good |
|---|---|---|
| Hero | "Welcome to LegoFuture, your premier destination for sealed LEGO investment analytics" | "Forecast every sealed brick." |
| CTA | "Click here to view forecasts" | "See the forecast" |
| Empty state | "No data available at this time" | "Nothing to stack yet — come back after the next sync." |
| Error | "An error occurred" | "That brick slipped. Try again in a moment." |
| Recommendation | "We suggest you may want to consider buying" | "Strong Buy" |

---

## 12. Don't list (trademark & taste)

- ❌ No LEGO logo or wordmark.
- ❌ No minifigure silhouettes or named characters.
- ❌ No literal stud grid as background texture.
- ❌ No imitation of the LEGO product packaging layout.
- ❌ No "LEGO®" in body copy — use "LEGO set" descriptively only.
- ❌ No drop shadows with soft blur.
- ❌ No more than two primary brand colors on a single surface.
- ❌ No display type set in ALL CAPS (eyebrow excepted).
- ❌ No page transitions, parallax, or autoplay video.

---

## 13. File map

| Concern | File |
|---|---|
| Color/type/radius/shadow tokens | `src/app/globals.css` (`@theme` block) |
| Font loading | `src/app/layout.tsx` |
| `BrickButton` | `src/components/ui/BrickButton.tsx` |
| `BrickCard` | `src/components/ui/BrickCard.tsx` |
| `BrickHero` | `src/components/ui/BrickHero.tsx` |
| `ChipBadge` | `src/components/ui/ChipBadge.tsx` |
| `StudStrip` | `src/components/ui/StudStrip.tsx` |
| `SectionDivider` | `src/components/ui/SectionDivider.tsx` |
| Legacy `Button.tsx` / `Card.tsx` | Re-export wrappers around the new primitives — keep API stable. |

---

## 14. Versioning

- This document is `v1.0`. Bump the version when palette, type scale, or primitive APIs change.
- Component changes that are purely additive (new variant, new size) are minor bumps.
- Removing a token or changing a hex value is a major bump and requires a screenshot review of all pages.
