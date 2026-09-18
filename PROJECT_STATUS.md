# Project Status

_Generated from the current codebase. Last verified against the working tree at the time of writing — total 135 kanji / 107 edges in `src/data/`, 508 modules in the production build._

## What KanjiGraph is

A React + TypeScript + React Flow app that visualizes kanji as a graph of component relationships (e.g. 人 + 木 → 休) instead of a flat list, with an integrated learning workflow: search, JLPT filtering, mastery tracking, spaced daily study, stroke-order animation, and a strict handwriting-practice mode.

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
| Lazy graph expansion | Done | Only root kanji (no components) render initially; ▶/▼ expand/collapse per node |
| Component-relationship edges | Done | Derived from `kanji.json`'s `components` field at import time into `edges.json` |
| Ancestor-path highlighting | Done | Selecting a kanji fades unrelated nodes/edges to 20% opacity, highlights the full real ancestor DAG (all parents, not just one) |
| Search (character or meaning) | Done | Searches the full catalog, auto-reveals hidden ancestors before focusing |
| JLPT level filter | Done | Checkboxes drive both graph visibility and Study Mode's candidate pool |
| Mastery tracking | Done | Persisted (`kanjigraph-mastery`), ✅ badge on nodes, progress bars per level |
| Study Mode | Done | Deterministic daily list (seeded by date), JLPT-filtered, excludes already-mastered kanji, persisted completion (`kanjigraph-study-mode`) |
| Kanji detail panel | Done | Meaning/readings, stroke count badge, Learning Family (parents/children, clickable), Mnemonic (template-generated), Learning Path breadcrumb |
| Stroke order data | Done | Self-hosted per-kanji SVGs in `public/stroke-order/`, generated from KanjiVG at import time (not fetched from an external CDN at runtime) |
| Stroke order animation | Done | Play/Pause/Reset, 0.5x/1x/2x speed, dasharray/dashoffset draw-on |
| Writing Practice Mode | Done | Strict sequential validation gate (direction, position, length ratio, and bounding-box overlap must all match the *current* expected stroke); wrong/distorted stroke → red rejection + redraw; correct → green + auto-advance + per-stroke "Stroke Accuracy: XX%"; final 0–100 score is a weighted rubric (Stroke Count 10% / Stroke Order 30% / Direction 20% / Position 20% / Shape 20%, see `ARCHITECTURE.md`) so a clearly distorted kanji can't score above 80 |
| Practice history | Done | Persisted per character (`kanjigraph-practice-history`), last 20 attempts kept |
| Data import pipeline | Done | `scripts/import-kanji-data.mjs`: KANJIDIC2 + KanjiVG → `kanji.json` + `edges.json` + stroke SVGs |
| GitHub Pages deploy | Configured, unused | `.github/workflows/deploy.yml` exists; **repo is not yet under git**, so it has never actually run |
| Automated tests | Not started | No test runner configured, no test files |

## Dataset snapshot

_Updated after the full-dataset import (see `KANJIGRAPH_PROJECT.md`) — the importer now generates every JLPT level plus the full Jōyō set, split across `public/data/<bucket>/`, not a single flat file._

- 2,387 unique kanji generated on disk across all buckets, 3,032 total edges. Per bucket: N5 = 103 kanji/83 edges, N4 = 181/218, N3 = 739/938, N2 = 1207/1587, **N1 = 0** (unavailable, not fabricated), `joyo` = 2,136/2,693 (the full Jōyō set; not yet loaded by the running app — see below)
- The app's runtime default is unchanged: only the N5 bucket loads at startup (103 kanji, 42 of them roots); other levels load lazily when their filter is enabled, and `joyo` isn't wired into the UI yet at all — it's generated and ready on disk for a future "browse the full Jōyō set" feature
- Stroke counts now come from KanjiVG's actual stroke-path count (primary source), not KANJIDIC2's `stroke_count` field (fallback, unused in practice — 2,387/2,387 resolved from KanjiVG); source data lives in `scripts/downloads/` (gitignored, must be downloaded manually — see Architecture)
- `public/data/quality-report.json` (regenerated on every import run) has the full breakdown: Jōyō/JLPT overlap, dropped unclassified components, missing meanings/readings, duplicate-kanji validation results

## Known limitations (by design, not oversights)

- **JLPT levels are an approximation.** KANJIDIC2 only has the legacy 1–4 scale; the importer maps old 4→N5, 3→N4, 2→N3, 1→N2. Old level 1 spanned what's now split across N2/N1, so **no kanji can ever be tagged N1** from this data source alone.
- **Mnemonics are template-generated, not authored.** `MnemonicPanel` builds a sentence purely from component meanings + the kanji's own meaning (e.g. "A person and a tree come together to mean rest"). Reads naturally for common noun+noun→verb kanji, can sound stiff for others.
- **The Learning Path breadcrumb is a single line**, following only each kanji's first-listed component — deliberately narrower than the graph's ancestor highlighting (which shows every real parent).
- **Writing Practice's correctness thresholds are heuristic constants**, not tuned against real user data: 70° direction tolerance, 30%-of-canvas position tolerance, 35% length-ratio tolerance, 15% bounding-box-overlap tolerance (the `GATE` constant in `WritingPracticePanel.tsx`, consumed by `scoring.ts`).
- **No error boundary anywhere in the tree.** An uncaught render error currently takes down the whole app to a blank page (this bit us once already — see Next Session).
