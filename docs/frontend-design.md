# Frontend Design Rules

Frontend design decisions agreed on before any UI implementation started. This
document is the reference for future frontend work — new screens/components
should follow these rules unless there's a good reason documented here to
deviate.

## Purpose & Scope

- Home screen: character search is the dominant element. Notices/events are
  secondary, shown below the search on the same screen.
- All other lookup features (Union, Guild, Battle Practice, Ranking, Notice)
  live on their own pages, reached from the home screen's navigation — not
  crammed into the home screen itself.
- Public web service for MapleStory players in general — not just the
  developer. Must work naturally across desktop and mobile browsers
  (responsive, not a separate mobile build).
- The Nexon API key lives in the backend `.env` only. The browser never sees
  it directly for v1.

### v1 category scope

Included in v1 (all backed by the shared server-side API key, safe to expose
publicly since they only return data about a *queried* target):

- Character, Union, Guild, Battle Practice, Ranking, Notice

**Excluded from v1's shared-key model**: Probability (`/ouid`, `/history/*`)
and Scheduler (`character-state`). These Nexon endpoints only return data for
the account that owns the API key used to call them — they can't answer
"look up character X" the way the rest of the API can, so they don't fit a
public multi-user search tool with one shared backend key.

**Probability — shipped (2026-09-21)**: a user supplies *their own* Nexon
API key and the frontend calls Nexon's API directly from the browser,
bypassing our backend entirely, so the key never reaches our server. See
`planning/features/probability.md` for the full design (CORS grounding,
pagination behavior, storage decision, UI shape).

Scheduler (`character-state`) is still excluded — not requested, revisit if
there's demand for it too.

## Visual Tone

Hybrid tone, blending two references the user liked:

- **Notion** (https://notion.com) — clean layout, generous whitespace,
  restrained UI chrome.
- **Inven** (https://www.inven.co.kr) — game-content density and visual
  energy where the content calls for it (equipment, stats, rankings).

Concretely:

- Base layout and typography lean toward the clean/spacious Notion side.
- MapleStory item-rarity colors are used **only** as semantic grade
  indicators (item rarity, equipment quality), not as general UI color:
  - 레전드리 (Legendary) — green
  - 유니크 (Unique) — yellow/gold
  - 에픽 (Epic) — purple
  - 레어 (Rare) — blue
- Real in-game icons/images returned by the Nexon API (equipment icons,
  character images, etc.) are used directly as visual accents — not
  recreated or abstracted away.

## Color

- Brand/accent color: **orange**. Chosen as a starting point; open to
  revisiting once real screens are built and the color can be judged in
  context. Deliberately distinct from all four rarity colors above so grade
  indicators never get confused with brand UI.
- **Light mode only** for v1. Dark mode is deferred until there's a concrete
  need — not designed against up front.

## Typography

- **Pretendard** for Korean/Latin text.
- Licensed under **SIL Open Font License 1.1** (verified directly from the
  font's repository). Under OFL, the font may be used, embedded, modified,
  and redistributed freely, including commercially — the one restriction is
  that the font itself can't be sold on its own separate from a document/
  application using it. No attribution requirement blocks bundling it in the
  app.

## Component & Icon Libraries

- **shadcn/ui** (+ Tailwind CSS v4, per the project's existing frontend
  rules) for UI components.
- **lucide-react** for general UI icons (nav, buttons, status indicators).
  Game-specific icons (items, skills, characters) come from the Nexon API's
  own image URLs, not from an icon library.

## Layout

- Text-centric screens (character basic info, simple detail panels): centered
  content column at a comfortable reading width — not full-bleed.
- Data-centric screens (equipment lists, stat tables, rankings): wide
  layout that uses the available viewport width.
- On mobile, wide tabular data (equipment, stats) is **restructured into
  cards** rather than made horizontally scrollable — a scrolling table is
  not considered acceptable UX here given how many stat/equipment columns
  these screens tend to have.

## Navigation

- **Mobile**: hamburger menu / drawer.
- **Desktop**: persistent, always-expanded left sidebar.
- Rationale: the category list is expected to grow substantially over time
  (more Nexon categories may be added later), so a drawer/sidebar scales
  better than a horizontal tab bar or scrolling tab strip.

## Internationalization

- **Korean only** for v1. No i18n infrastructure (no message catalogs, no
  locale switcher). Revisit only if there's real demand for another
  language.

## Loading / Error / Empty States

- **Loading**: skeleton loaders, not spinners — avoids layout shift on
  data-heavy screens (equipment, stats) once content arrives.
- **Errors**:
  - Recoverable, expected errors (e.g. character not found) — inline message
    near the point of failure (e.g. under the search box). Do not take over
    the whole screen for these.
  - Serious/unrecoverable failures (e.g. backend unreachable) — full-page
    error treatment.

## Accessibility

- Baseline: rely on shadcn/ui's Radix-based primitives for keyboard
  navigation and ARIA behavior. No separate, formally tracked WCAG AA
  target for v1 — Radix's defaults are considered adequate for this stage,
  and introducing a formal accessibility audit process now would be
  disproportionate to the project's size. Revisit if the audience or
  requirements change.

## Future Work

- **Character info card background**: the character detail page's summary
  card (nickname/level/exp bar/world/job/guild) currently uses a plain white
  background. The intent is to eventually offer a small set of background
  image references (e.g. in-game scenery, class-themed art) and let the
  card randomly or deliberately pick one, similar to how the in-game
  character info window shows the character standing in a scene. Not
  designed or implemented yet — needs its own reference-image pass before
  building, same as the rest of this document.
- **Character detail page — stat panel review**: the "스탯" tab (combat
  power, HP/MP/STR/DEX/INT/LUK, and the generic label/value grid for the
  rest of `final_stat`) hasn't had a design feedback pass yet — only the
  info card above it has. Revisit its layout/grouping/formatting once that
  review happens, the same way the info card went through several rounds
  (image size, alignment, exp bar, Korean-unit combat power formatting).
