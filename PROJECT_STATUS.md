# Project Status

_Generated from the current codebase. Last verified against the working tree at the time of writing — 2,387 unique kanji / 3,032 edges generated on disk across all JLPT + Jōyō buckets (see Dataset snapshot below), 518 modules in the production build._

## What KanjiGraph is

A React + TypeScript + React Flow app that visualizes kanji as a graph of component relationships (e.g. 人 + 木 → 休) instead of a flat list, with an integrated learning workflow: search, JLPT filtering, mastery tracking, spaced daily study, stroke-order animation, and a strict handwriting-practice mode. The default experience is a Kanji List → select a kanji → Graph View flow, with a Learning Focus Mode that shows just one kanji family at a time (an opt-in Full Graph Mode remains available for open-ended exploration).

## Stack

- Vite 8, React 19, TypeScript 6 (strict-ish `tsconfig`, `verbatimModuleSyntax`)
- React Flow 11 (`reactflow` package) for the graph canvas
- Zustand 5 for state, with `persist` (localStorage) on the stores that need to survive a reload
- Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js` — v4's CSS-based config)
- Dagre for automatic graph layout

## Feature status

| Feature | Status | Notes |
|---|---|---|
| Graph visualization | Done | React Flow + custom `KanjiNode`; zoom/pan/MiniMap/Controls |
| Automatic layout | Done | Dagre per connected component, then grid-packed (see Architecture) |
| Learning Focus Mode | Done | Default mode; shows only the selected kanji + parents + children (+ grandchildren, depth 2 max) - unrelated nodes are removed entirely, never dimmed. Persisted (`kanjigraph-graph-mode`) |
| Full Graph Mode | Done | The original expand/collapse exploration graph, unchanged; opt-in via the header's mode switcher |
| Lazy graph expansion (Full Graph Mode) | Done | Only root kanji (no components) render initially; ▶/▼ expand/collapse per node; expanding never moves the viewport |
| Component-relationship edges | Done | Derived from each kanji's `components` field at import time into `edges.json` |
| Ancestor-path highlighting | Done | Full Graph Mode fades unrelated nodes/edges to 20% opacity; Learning Focus Mode removes them outright. Both highlight the full real ancestor DAG (all parents, not just one) |
| Selection ↔ viewport centering | Done | A plain selection change (graph node, search, parent/child chip, breadcrumb) pans (never `fitView`) the selected node to center, current zoom preserved, animated 300–500ms; the user's own zoom/pan is never overridden otherwise. If the selected kanji's node ever isn't currently rendered (JLPT-filtered out, or collapsed away), the selection clears rather than desyncing from the graph |
| Kanji List ↔ Graph View navigation | Done | Kanji List (a JLPT-filtered browsable grid) is the default landing view; selecting a kanji (list, search) switches to Graph View; "← Back to Kanji List" + a breadcrumb trail (`Kanji List > 木 > 休`) sit above the graph. View mode persisted (`kanjigraph-view-mode`); switching views never reloads data or loses search text/filters/progress/study state |
| Search (character or meaning) | Done | Searches the full catalog, auto-reveals hidden ancestors before focusing, switches to Graph View |
| JLPT level filter | Done | Checkboxes drive graph visibility, Study Mode's candidate pool, Kanji List View, and the detail panel's parent/child/breadcrumb visibility (consistent everywhere - see `isKanjiVisible`) |
| Mastery tracking | Done | Persisted (`kanjigraph-mastery`), ✅ badge on nodes, progress bars per level |
| Study Mode | Done | Deterministic daily list (seeded by date), JLPT-filtered, excludes already-mastered kanji, persisted completion (`kanjigraph-study-mode`) |
| Kanji detail panel | Done | Meaning/readings, stroke count badge, Learning Family (JLPT-visible parents/children only, clickable, with a note when relationships are hidden by the filter), Mnemonic (template-generated), Learning Path breadcrumb |
| Stroke order data | Done | Self-hosted per-kanji SVGs in `public/stroke-order/`, generated from KanjiVG at import time (not fetched from an external CDN at runtime) |
| Stroke order animation | Done | Play/Pause/Reset, 0.5x/1x/2x speed, dasharray/dashoffset draw-on |
| Writing Practice Mode | Done | Strict sequential validation gate (direction, position, length ratio, and bounding-box overlap must all match the *current* expected stroke); wrong/distorted stroke → red rejection + redraw; correct → green + auto-advance + per-stroke "Stroke Accuracy: XX%"; final 0–100 score is a weighted rubric (Stroke Count 10% / Stroke Order 30% / Direction 20% / Position 20% / Shape 20%, see `ARCHITECTURE.md`) so a clearly distorted kanji can't score above 80 |
| Practice history | Done | Persisted per character (`kanjigraph-practice-history`), last 20 attempts kept |
| Data import pipeline | Done | `scripts/import-kanji-data.mjs`: KANJIDIC2 + KanjiVG → `public/data/**` + stroke SVGs |
| GitHub Pages deploy | Configured | `.github/workflows/deploy.yml` exists; the repo is now under git and pushed to `github.com/IhChowdhury/kanji-graph` (previously it was not); whether the workflow has actually run/succeeded against real Pages settings hasn't been re-verified |
| Automated tests | Done (initial coverage) | Vitest configured; 77 tests across 11 files - dataset loader/store, kanji catalog, importer data-quality logic, Writing Practice scoring/geometry, graph selection/expand-collapse stores, Learning Focus neighborhood computation, JLPT-visibility helper, learning-path chain. Still untested: `graphLayout.ts`, `dailyKanji.ts` |

## Dataset snapshot

_Updated after the full-dataset import (see `KANJIGRAPH_PROJECT.md`) — the importer now generates every JLPT level plus the full Jōyō set, split across `public/data/<bucket>/`, not a single flat file._

- 2,387 unique kanji generated on disk across all buckets, 3,032 total edges. Per bucket: N5 = 103 kanji/83 edges, N4 = 181/218, N3 = 739/938, N2 = 1207/1587, **N1 = 0** (unavailable, not fabricated), `joyo` = 2,136/2,693 (the full Jōyō set; not yet loaded by the running app — see below)
- The app's runtime default is unchanged: only the N5 bucket loads at startup (103 kanji, 42 of them roots); other levels load lazily when their filter is enabled, and `joyo` isn't wired into the UI yet at all — it's generated and ready on disk for a future "browse the full Jōyō set" feature
- Stroke counts now come from KanjiVG's actual stroke-path count (primary source), not KANJIDIC2's `stroke_count` field (fallback, unused in practice — 2,387/2,387 resolved from KanjiVG); source data lives in `scripts/downloads/` (gitignored, must be downloaded manually — see Architecture)
- `public/data/quality-report.json` (regenerated on every import run) has the full breakdown: Jōyō/JLPT overlap, dropped unclassified components, missing meanings/readings, duplicate-kanji validation results

## Known limitations (by design, not oversights)

- **JLPT levels are an approximation.** KANJIDIC2 only has the legacy 1–4 scale; the importer maps old 4→N5, 3→N4, 2→N3, 1→N2. Old level 1 spanned what's now split across N2/N1, so **no kanji can ever be tagged N1** from this data source alone.
- **Mnemonics are template-generated, not authored.** `MnemonicPanel` builds a sentence purely from component meanings + the kanji's own meaning (e.g. "A person and a tree come together to mean rest"). Reads naturally for common noun+noun→verb kanji, can sound stiff for others.
- **The Learning Path breadcrumb is a single line**, following only each kanji's first-listed component — deliberately narrower than the graph's ancestor highlighting (which shows every real parent). It also stops at the first JLPT-filtered-out ancestor, so it never shows a kanji currently hidden by the filter.
- **Writing Practice's correctness thresholds are heuristic constants**, not tuned against real user data: 70° direction tolerance, 30%-of-canvas position tolerance, 35% length-ratio tolerance, 15% bounding-box-overlap tolerance (the `GATE` constant in `WritingPracticePanel.tsx`, consumed by `scoring.ts`).
- **No error boundary anywhere in the tree.** An uncaught render error currently takes down the whole app to a blank page (this bit us once already — see Next Session).
- **No browser click-through this session either.** The Learning Focus/Full Graph toggle, Kanji List ↔ Graph View navigation, breadcrumb, and the new selection-centering behavior were verified via `tsc -b`, the full Vitest suite, and `npm run build` only — no browser automation tooling was available. See Next Session.
