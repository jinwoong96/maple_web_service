# Item Level Reference Crawler

Small backend-owned reference table (`item_level_reference`) mapping
`item_name -> base_equipment_level`, plus the script that fills it. Built
specifically to unblock 스타포스 cost estimation in the Probability domain's
"모아보기" tab (see `planning/features/probability.md`) — Nexon's
`history/starforce` endpoint doesn't return an item's required level, and
there's no other Nexon endpoint that gives "level by item name" directly.

## Why crawling, not a static item database

A full MapleStory item database (every item, every level) is out of scope —
this only needs levels for items that *actually show up* in someone's
starforce history, and an item's required level is fixed game data (it
never changes), so it only has to be observed once, on any one character
wearing it, ever. Crawling public character equipment lookups (the same
`item-equipment` endpoint Character already uses) is the cheapest way to
harvest that, using the same shared server-side Nexon key as every other
domain — no personal key involved, this isn't account-specific data.

## Data flow

1. `backend/scripts/crawl_item_levels.py` (a manual, one-off script — not a
   scheduled job, not a public API endpoint):
   - Pulls character names from `GET /ranking/overall` across a
     configurable spread of pages (default: pages
     `1,20,50,100,200,400,800,1500,3000,5000`, 20 characters/page) — an
     arbitrary spread from the top of the leaderboard to deep into it, to
     get item-level diversity across the whole progression range rather
     than only endgame gear.
   - For each character: resolves `ocid`, fetches `item-equipment`, reads
     `item_base_option.base_equipment_level` off every piece in the
     current set **and** all 3 presets (presets often carry different
     items, so this multiplies distinct-item coverage per API call for
     free) — confirmed live (2026-09-21) that `base_equipment_level` is
     reliably populated on real equipped-item data.
   - Upserts `item_name -> base_equipment_level` (+ `item_icon` and the
     character it was last seen on, for debugging) into Postgres.
   - Sequential, not parallel (shares the app's one Nexon key), commits
     once per ranking page, prints running progress.
2. `GET /api/v1/item-levels?names=A&names=B` (`app/api/v1/item_levels.py`):
   read-only batch lookup against that table, used by the frontend.

## Frontend usage

`frontend/src/lib/item-level-lookup.ts`'s `lookupItemLevels(itemNames)`
calls the above endpoint through the normal `apiClient` (our own backend —
**not** the Probability domain's direct-to-Nexon client, since this is
shared reference data, not personal account data). `use-probability-
aggregate.ts` calls it once per aggregate run with the distinct
`target_item` names seen in `history/starforce`, then feeds each entry's
level into `probability-cost-reference.ts`'s `getStarforceCost()`. An item
missing from the table just means "not priced yet" — the attempt is still
counted, and the missing item names are surfaced in the UI
(`starforceItemsMissingLevel`) rather than silently dropped.

## Operating it

```
cd backend
uv run alembic upgrade head          # once, to create item_level_reference
uv run python -m scripts.crawl_item_levels
uv run python -m scripts.crawl_item_levels --pages 1,50,200,1000 --per-page 10
```

Re-running is always safe (upsert on `item_name`, primary key) and cheap to
extend later — widen `--pages`/`--per-page` any time coverage looks thin
(check `starforceItemsMissingLevel` in the 모아보기 tab for concrete gaps
to go fill).

## Known debt

- **No scheduling** (by design, "smallest structure that works" — see
  `planning/INDEX.md`'s general principle): coverage only grows when
  someone remembers to re-run the script. Fine for now since required
  levels don't change; revisit only if this turns out to need to react to
  new item releases quickly.
- **Coverage is still thin** — a default-options run (2026-09-21) processed
  199 characters (1 failed with `OPENAPI00004`, skipped) across the 10
  default pages but only turned up **434 distinct items** (levels 0~250):
  item diversity saturates much faster than character count once you're
  sampling from the ranking leaderboard, since strong endgame gear is
  reused across many top characters. Fine as a starting point, but any
  starforce entry on an item outside that 434 will show up as
  `starforceItemsMissingLevel` until the crawl is widened (more pages,
  higher `--per-page`, or pages sampled from a wider spread of the
  leaderboard rather than just deeper into the same "type" of character).
- **No rate-limit backoff**: a `NexonApiError` (including 429) on any one
  character/page is caught and skipped (logged, not retried) rather than
  retried with backoff — acceptable for a manual script the developer
  re-runs by hand, not for anything automated.
