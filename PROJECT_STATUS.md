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
| Writing Practice Mode | Done | Strict sequential validation: direction **and** position must both match the *current* expected stroke; wrong stroke → red rejection + redraw; correct → green + auto-advance; final 0–100 score from accumulated direction accuracy |
| Practice history | Done | Persisted per character (`kanjigraph-practice-history`), last 20 attempts kept |
| Data import pipeline | Done | `scripts/import-kanji-data.mjs`: KANJIDIC2 + KanjiVG → `kanji.json` + `edges.json` + stroke SVGs |
| GitHub Pages deploy | Configured, unused | `.github/workflows/deploy.yml` exists; **repo is not yet under git**, so it has never actually run |
| Automated tests | Not started | No test runner configured, no test files |

## Dataset snapshot

- 135 kanji total, 107 component-relationship edges
- By JLPT level: N5 = 103, N4 = 8, N3 = 13, N2 = 11, **N1 = 0**
- The non-N5 entries aren't a separate import — they're real components that N5 kanji depend on (e.g. 何's component 可 is N3) and were pulled in automatically so every edge has both endpoints present
- 56 of the 135 kanji have no components of their own (graph roots); source data lives in `scripts/downloads/` (gitignored, must be downloaded manually — see Architecture)

## Known limitations (by design, not oversights)

- **JLPT levels are an approximation.** KANJIDIC2 only has the legacy 1–4 scale; the importer maps old 4→N5, 3→N4, 2→N3, 1→N2. Old level 1 spanned what's now split across N2/N1, so **no kanji can ever be tagged N1** from this data source alone.
- **Mnemonics are template-generated, not authored.** `MnemonicPanel` builds a sentence purely from component meanings + the kanji's own meaning (e.g. "A person and a tree come together to mean rest"). Reads naturally for common noun+noun→verb kanji, can sound stiff for others.
- **The Learning Path breadcrumb is a single line**, following only each kanji's first-listed component — deliberately narrower than the graph's ancestor highlighting (which shows every real parent).
- **Writing Practice's correctness thresholds are heuristic constants**, not tuned against real user data: 70° direction tolerance, position tolerance of 30% of the canvas size (`CORRECT_ANGLE_THRESHOLD_DEGREES`, `MAX_POINT_DISTANCE` in `strokeGeometry.ts`/`WritingPracticePanel.tsx`).
- **No error boundary anywhere in the tree.** An uncaught render error currently takes down the whole app to a blank page (this bit us once already — see Next Session).
