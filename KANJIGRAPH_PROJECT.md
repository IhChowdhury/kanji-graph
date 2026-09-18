# KanjiGraph — Performance Preparation & Full Dataset Import

_Two phases: (1) runtime dataset loading, JLPT-level splitting, and edge-index fix, done ahead of the full import; (2) the full import itself (all JLPT levels + the complete Jōyō set), using the Phase 1 infrastructure. This is an addendum to `ARCHITECTURE.md`/`PROJECT_STATUS.md`, focused on what changed and why._

## Phase 1: Performance preparation

## Why

At 135 kanji / 107 edges, bundling the whole dataset as a static TypeScript import cost nothing. At the planned scale (2136 kanji / 5000+ edges across all five JLPT levels), that same pattern would have meant: the entire dataset parsed synchronously before first paint, every root kanji across every level mounted as a graph node on load, and React Flow rendering every node regardless of viewport. This phase replaces the static-import architecture with runtime, per-level loading before that import happens — see the prior conversation's bottleneck analysis for the full reasoning.

## Runtime data-loading architecture

```
public/data/
  manifest.json         - per-level availability + counts
  N5/kanji.json          N5/edges.json
  N4/kanji.json          N4/edges.json
  N3/kanji.json          N3/edges.json
  N2/kanji.json          N2/edges.json
  N1/ ...                (not written - see "Unavailable levels" below)
```

`public/` files are served as-is by Vite in dev and copied verbatim into `dist/` on build, so they're available at runtime via plain `fetch()` in every deployment target (local dev, production build, GitHub Pages project site) without being part of the JS bundle.

Three layers, each with one job:

1. **`src/data/datasetLoader.ts`** — typed fetch/cache service. `loadManifest()` and `loadLevelDataset(level)` build URLs via `` `${import.meta.env.BASE_URL}data/...` `` (never a hardcoded `/data/...` root path), so the same code works locally (`BASE_URL === '/'`) and on GitHub Pages project sites (`BASE_URL === '/<repo>/'`, set in `vite.config.ts` from `GITHUB_REPOSITORY`). Successful fetches are memoized in module-level promises for the page's lifetime (never re-fetched); a failed fetch clears its memo so a later call retries instead of replaying a cached rejection.
2. **`src/data/kanjiCatalog.ts`** — pure data-transformation functions only (`buildKanjiCatalog`, `buildChildIndex`, `getRootKanjiIds`, `toKanjiInfo`). No static import, no runtime state. This is also where the O(k²) fix lives (see below).
3. **`src/store/useKanjiDatasetStore.ts`** (Zustand) — the stateful piece. Tracks manifest + per-level load status, merges every level loaded so far into `catalog` / `childIndex` / `allKanji` / `rootKanjiIds` / `mergedEdges`, and exposes `getKanjiInfo` / `getChildKanji` / `hasChildKanji` (same names/shapes as the old static exports, now backed by whatever is currently loaded instead of a fixed module-level constant).

## Level-loading and caching behavior

- On startup, `GraphCanvas` calls `useKanjiDatasetStore.initialize()`, which loads `manifest.json` and then **only the default level (N5)** — no other level is fetched until the user asks for it.
- `useJlptFilterStore`'s initial `enabledLevels` now has only N5 `true` (previously all five were `true` by default, which no longer matches "initial graph displays only the default level").
- Enabling a level's checkbox (`toggleLevel`) calls `useKanjiDatasetStore.ensureLevelLoaded(level)`, then re-seeds the graph store's roots once it resolves. `ensureLevelLoaded` is idempotent — a level already `loading`/`loaded`/`empty` is never re-fetched, satisfying "cache successfully loaded level data" / "do not fetch the same level repeatedly."
- Per-level status is one of `idle | loading | loaded | empty | error`, surfaced in two places: `GraphCanvas`'s `DatasetStatusOverlay` (loading/empty/error banner over the graph, with a Retry button on error) and small inline status text next to each checkbox in `JlptFilterPanel` (`(loading…)`, `(error)`, `(no data)` for a manifest-unavailable level).
- Mastery/study-mode/practice-history stores (`useMasteryStore`, `useStudyModeStore`, `usePracticeHistoryStore`) were not touched — their `localStorage` persistence is unaffected by any of this.

## Unavailable levels ("only migrate verified data")

The existing dataset (135 kanji, generated with the importer's default `--levels=N5`, which pulls in N4/N3/N2 as real dependency components) was **regenerated in place** into the new split layout using the same source files and the same deterministic algorithm — not re-imported or expanded. Counts match exactly what was previously documented: N5=103, N4=8, N3=13, N2=11, N1=0.

N1 has zero verified kanji (KANJIDIC2's legacy 4-level JLPT scale cannot produce N1 at all — see `ARCHITECTURE.md`/`ROADMAP.md`). Rather than writing an empty `N1/` directory that looks like "no kanji happen to be at this level," `manifest.json` explicitly records it:

```json
"N1": { "available": false, "kanjiCount": 0, "edgeCount": 0, "reason": "No verified kanji currently classified at this level." }
```

`datasetLoader.loadLevelDataset('N1')` reads this and resolves to `{ kanji: [], edges: [] }` **without ever issuing a fetch** for files that don't exist.

## Cross-level edge policy

An edge is grouped into a level file by its **target's** level (i.e. the compound kanji being built), since that's how each kanji entry already owns its own `components` list. The source component can legitimately belong to a different level — e.g. 丁 (N2) has component 一 (N5), so edge `一->丁` lives in `N2/edges.json`.

At merge time (`useKanjiDatasetStore`'s `deriveCatalog`), **an edge is kept only if both its source and target are present in the currently-merged (loaded) catalog.** The app has no placeholder/stub-node concept today, so this is the only safe option — an edge pointing at an unloaded node would reference something that doesn't exist. Concretely: with only N5 loaded, `一->丁` is silently dropped (丁 isn't loaded); enabling N2 loads 丁 and the edge reappears on the next merge. This is exercised directly in `useKanjiDatasetStore.test.ts` ("merges multiple levels without duplicate node ids or duplicate edge ids" and "drops a cross-level edge when only one endpoint is loaded").

The same policy is applied at the UI edges of the old static catalog that used to assume everything was always loaded:
- `MnemonicPanel` skips (rather than crashes on) a component whose level isn't loaded.
- `LearningFamily`'s parent-navigation click is a no-op for an unloaded parent (the chip still renders — it's a real relationship — it just isn't yet clickable).
- `computeLearningPath` (`graphPath.ts`) now takes the catalog as an explicit parameter and stops the chain early if the next parent isn't loaded, instead of throwing.
- `useKanjiDatasetStore.getKanjiInfo` returns `KanjiInfo | undefined` instead of throwing on an unknown character — "unknown" is now a legitimate transient state, not necessarily a bug.

## React Flow optimization

`onlyRenderVisibleElements` is set on the `<ReactFlow>` element in `GraphCanvas.tsx` so nodes/edges outside the viewport aren't mounted. Verified still working after this change (typecheck + build + manual reasoning through each code path; no browser-automation tooling was available in this session, so this is not a substitute for a manual click-through — see Remaining risks):
- Zoom/pan/MiniMap/Controls — unaffected, these are React Flow's own viewport chrome, independent of which nodes are mounted.
- Node selection, expand/collapse, search-and-focus, path highlighting — all operate on `useKanjiGraphStore`'s `nodes`/`edges` state and `useKanjiSelectionStore`'s `focusNodeId`, none of which changed; `onlyRenderVisibleElements` only affects which of those get a DOM node, not the underlying state or event handlers.
- Detail panel, Study Mode, Writing Practice, stroke-order enforcement — none of these read from React Flow's internal rendering; they consume `useKanjiSelectionStore`/`useMasteryStore`/`useStudyModeStore`/`usePracticeHistoryStore` and the stroke SVGs, none of which this phase touched.

## Edge-index construction fix

`kanjiCatalog.ts`'s old `childIdsByComponent` build used `[...(arr ?? []), edge.target]` inside a loop — reallocating and copying the whole array-so-far on every edge for a given source (O(k²) for a source with k children). `buildChildIndex` now builds with a `Map` and `.push()`s (O(1) amortized per edge), only converting to the same `Record<string, string[]>` shape at the end — the exported type and the behavior for every existing caller are unchanged. Covered by `kanjiCatalog.test.ts` (including a 200-child high-fan-out case).

## Files changed

**New:**
- `src/data/datasetLoader.ts`, `src/data/datasetLoader.test.ts`
- `src/data/kanjiCatalog.test.ts`
- `src/store/useKanjiDatasetStore.ts`, `src/store/useKanjiDatasetStore.test.ts`
- `vitest.config.ts` (kept separate from `vite.config.ts` — see comment in the file; merging them pulls in a second, incompatible copy of Vite's plugin types via vitest's own nested `vite` dependency)
- `public/data/manifest.json`, `public/data/{N5,N4,N3,N2}/{kanji,edges}.json`
- `KANJIGRAPH_PROJECT.md` (this file)

**Rewritten:**
- `src/data/kanjiCatalog.ts` — pure builder functions, no static import
- `src/store/useKanjiGraphStore.ts` — starts empty, `seedRootsIfNeeded()` replaces synchronous `createInitialNodes()`
- `scripts/import-kanji-data.mjs` — writes the split/manifest layout instead of flat `src/data/*.json`; default `--out` is now `public/data`

**Edited:**
- `src/store/useJlptFilterStore.ts` — N5-only default, triggers level load on enable
- `src/components/layout/GraphCanvas.tsx` — bootstrap effect, `DatasetStatusOverlay`, `onlyRenderVisibleElements`
- `src/components/filters/JlptFilterPanel.tsx` — per-level status text
- `src/components/graph/KanjiNode.tsx`, `graphPath.ts`
- `src/components/panels/LearningFamily.tsx`, `LearningPath.tsx`, `MnemonicPanel.tsx`
- `src/components/progress/MasteryProgress.tsx`, `src/components/search/KanjiSearch.tsx`, `src/components/study/useDailyKanji.ts`
- `src/types/kanji.ts` — `JLPT_LEVELS`, `KanjiEdgeEntry`, `DatasetManifest`, `LevelManifestEntry`, `LevelDataset`
- `package.json` — added `test` script, `vitest` devDependency

**Deleted:**
- `src/data/kanji.json`, `src/data/edges.json` (superseded by `public/data/`)

## Validation results

- `npx tsc -b` — clean.
- `npx oxlint` — same 4 pre-existing warnings as before this change (all in files untouched by this phase: `useStrokeOrderSvg.ts`, `StrokeAnimation.tsx`, `WritingPracticePanel.tsx`); no new warnings.
- `npx vitest run` — 21/21 passing across 3 files (URL construction incl. GitHub Pages base path, single-level load, caching/no-refetch, failed-request handling with cache eviction/retry, multi-level merge without duplicate node/edge ids, cross-level-drop-when-one-side-missing, edge-index correctness).
- `npm run build` — succeeds. Before: 501.15 kB JS / 154.84 kB gzip (509→508 modules), with Vite's >500KB chunk-size warning. After: 482.26 kB JS / 150.52 kB gzip, **no chunk-size warning**. The reduction is modest at 135 kanji; the point of this phase is that the dataset no longer scales the JS bundle at all going forward — it's now fetched JSON in `dist/data/`, confirmed present after build.
- Manual runtime check: ran `vite dev`, confirmed `GET /data/manifest.json` and `GET /data/N5/kanji.json` return the expected JSON over HTTP (i.e., the fetch-based loading path actually works, not just typechecks).
- Not done in this session: an actual browser click-through (no browser-automation tooling available) — see Remaining risks.

## Remaining risks / not yet done (explicitly out of scope this phase)

- No browser click-through was performed; the "still works" claims above are from reading the code paths, not observing the app. Recommend a manual pass focused on: expand/collapse across a freshly-enabled level, search-then-focus on a kanji whose parent is in a not-yet-loaded level, and the JLPT filter checkboxes' new status text.
- Web Workers, Dagre connected-component caching, incremental collapse reference-counting: not implemented (explicitly deferred).
- The GitHub Pages deploy workflow has still never actually run (pre-existing, unrelated to this phase).
- `gcm-diagnose.log` in the repo root and this shell's `HTTP_PROXY_BB`/`HTTPS_PROXY_BB` env vars both contain plaintext credentials — noticed during this session, unrelated to this task, not modified; worth cleaning up separately.

## Phase 1 readiness verdict (superseded by Phase 2 below)

Phase 1 concluded the project was ready for the complete dataset import. Phase 2 (below) is that import, actually done.

## Phase 2: Full dataset import

### Sources

- **KANJIDIC2** — primary source: `meaning`, `onyomi`, `kunyomi`, legacy JLPT tag (`<misc><jlpt>`), and Jōyō school grade (`<misc><grade>`).
- **KanjiVG** — stroke count (counted from actual `<path>` stroke elements, not KANJIDIC2's `stroke_count` field, which is used only as a fallback if a target kanji has no KanjiVG entry at all), stroke order / SVG stroke data (`public/stroke-order/*.svg`, unchanged mechanism from Phase 1), and component decomposition (`components`/edges, unchanged mechanism from Phase 1).

### Jōyō derivation

The 2,136-kanji Jōyō set is derived from KANJIDIC2's `<misc><grade>`: grades 1–6 are the Kyōiku (elementary-school) kanji, grade 8 is the remaining Jōyō kanji taught in secondary school. Grades 9–10 are Jinmeiyō (name-only) kanji and are excluded. This is verified against the real file: `grade <= 8` yields exactly 2,136 kanji, the well-known official Jōyō count. Jōyō and JLPT classification overlap heavily but are not identical: of the 2,387 kanji in this dataset, 1,979 are both, 157 are Jōyō-only (no legacy-JLPT tag), and 251 are JLPT-only (not Jōyō — e.g. some N2/old-level-1 vocabulary uses non-Jōyō kanji). Neither is inferred from the other.

### Directory structure generated

```
public/data/
  manifest.json          - N5/N4/N3/N2/N1 availability + counts, plus a sibling `joyo` entry
  quality-report.json    - see "Data quality report" below
  N5/kanji.json  N5/edges.json    (103 kanji, 83 edges)
  N4/kanji.json  N4/edges.json    (181 kanji, 218 edges)
  N3/kanji.json  N3/edges.json    (739 kanji, 938 edges)
  N2/kanji.json  N2/edges.json    (1,207 kanji, 1,587 edges)
  N1/                              (not written - unavailable, see below)
  joyo/kanji.json  joyo/edges.json (2,136 kanji, 2,693 edges)
public/stroke-order/*.svg  - 2,387/2,387 kanji resolved (one SVG per unique kanji across all buckets)
```

2,387 unique kanji total across all buckets (a kanji can appear in more than one bucket, e.g. 一 is both N5 and joyo — buckets are independent, not a partition).

**N1 stays unavailable, not fabricated.** KANJIDIC2's legacy 4-level JLPT scale cannot distinguish old level 1's N2-vs-N1 split (documented since Phase 1); this import doesn't invent a source for it. `manifest.json`'s `levels.N1` reports `available: false` with a `reason`, same policy as Phase 1's partial dataset.

**`joyo/` is generated but not yet loaded by the running app.** `useKanjiDatasetStore` only ever requests N5–N1 (`DatasetManifest.levels`); `joyo` is a new sibling field on the manifest (`DatasetManifest.joyo?: LevelManifestEntry`) that the app doesn't read yet. It's prepared on disk for a future "browse the complete Jōyō set" feature — wiring it into the UI (a new filter/mode) was out of scope here (data generation only, no new product features).

### Fields preserved

Every entry keeps: `kanji`, `meaning`, `onyomi[]`, `kunyomi[]`, `jlpt` (optional — see below), `strokes` (KanjiVG-derived), `components[]` (parent relationships — what the kanji is built from), plus a new `grade` (optional, Jōyō school grade, informational). Child relationships are preserved via `edges.json` / the runtime child-index (`useKanjiDatasetStore`'s `childIndex`, built by `buildChildIndex`), derived from `components` rather than duplicated as a second per-entry array — one source of truth, no risk of the two drifting out of sync.

`KanjiJsonEntry.jlpt` is now **optional** in `src/types/kanji.ts` (previously required): a Jōyō-only kanji genuinely has no legacy-JLPT tag, and leaving it required would have forced either fabricating a value or lying with a cast. This doesn't affect the running app — `useKanjiDatasetStore` only ever loads N5–N1 bucket files, where `jlpt` is always present by construction (see the invariant comment in `kanjiCatalog.ts`'s `toKanjiInfo`).

### Duplicate validation

`validateNoDuplicateKanji(entries, contextLabel)` in `scripts/import-kanji-data.mjs` scans for repeated `kanji` characters and **throws** if any are found (a real bug, not a data quirk to warn-and-continue on). Run twice: once across the full resolved entry set, and once per output bucket (defense-in-depth — a duplicate-free superset can't produce a duplicate-containing subset, but the check is cheap and makes the guarantee explicit rather than assumed). Result: zero duplicates found, globally and in every bucket (confirmed in `quality-report.json`'s `duplicateValidation`). Covered by `scripts/import-kanji-data.test.mjs`.

### Data quality report

`public/data/quality-report.json`, regenerated on every import run, records:
- Source parse totals (13,108 KANJIDIC2 characters, 6,702 KanjiVG characters).
- Per-bucket kanji/edge counts and per-bucket duplicate-check results.
- Jōyō/JLPT classification overlap (`joyoOnly`/`jlptOnly`/`both`, counted across the *entire* KANJIDIC2 file, not just this run's target set — context for how much they diverge).
- Stroke-count sourcing: how many resolved from KanjiVG vs. fell back to KANJIDIC2 vs. are missing entirely (this run: 2,387/2,387 from KanjiVG, 0 fallbacks, 0 missing).
- Dropped components: real KanjiVG decomposition components that have no JLPT tag and aren't Jōyō (315 this run — genuine Kangxi radical primitives like 宀, 艸, 彳, plus rare CDP/extension-B components) — excluded rather than defaulted, consistent with Phase 1's "don't fabricate classification" policy.
- Data completeness gaps: kanji with an empty meaning (1 this run — 真, a genuine KANJIDIC2 data quirk, not a parsing bug) and kanji with no onyomi/kunyomi at all (0 this run).
- Global and per-bucket duplicate-validation results.

### Rebuildable import script

`npm run import:kanji` (unchanged command) now performs the full import by default — `scripts/import-kanji-data.mjs`'s default `--levels` changed from `['N5']` to all five JLPT levels, and `joyo` generation is on by default (`--no-joyo` to skip it). Runs in ~9 seconds against the already-downloaded `scripts/downloads/*.xml.gz`. The script's pure helper functions (`isJoyo`, `countStrokePaths`, `validateNoDuplicateKanji`, `summarizeClassification`) are now `export`ed and `main()` is guarded behind an entry-point check (`isMainModule`), so the script can be imported by tests without triggering a full download/parse/write run as a side effect.

### Files changed (Phase 2)

**Rewritten:** `scripts/import-kanji-data.mjs` — grade parsing, Jōyō derivation, KanjiVG-sourced stroke counts (single-pass regex extraction instead of repeated `indexOf` — see perf note below), joyo bucket generation, duplicate validation, quality-report generation, exported pure helpers + `main()` guard.

**New:** `scripts/import-kanji-data.test.mjs` (7 tests).

**Edited:** `src/types/kanji.ts` (`KanjiJsonEntry.jlpt` now optional, added `KanjiJsonEntry.grade?`, added `DatasetManifest.joyo?`), `src/data/kanjiCatalog.ts` (invariant comment on `toKanjiInfo`), `PROJECT_STATUS.md` and `ROADMAP.md` (dataset snapshot numbers, marked the "expand beyond N5" and "no test runner" roadmap items done).

**Regenerated:** `public/data/**` (now 2,387 unique kanji across N5/N4/N3/N2/joyo instead of 135 across N5/N4/N3/N2), `public/stroke-order/*.svg` (2,387 files instead of 135).

### Performance note

The old `extractStrokeGroupMarkup` re-scanned the full KanjiVG XML text with `indexOf` once per kanji — fine for 135 kanji, but would not have scaled to 2,387 (repeated linear scans over a ~40MB string). Replaced with a single `matchAll` pass over the raw XML that builds a `character -> stroke markup` map once, reused for both the KanjiVG-derived stroke count and the stroke-order SVG files. Full import (parse + build + write 2,387 kanji, 3,032 edges, 2,387 SVGs) runs in ~9 seconds.

### Validation results (Phase 2)

- `npx tsc -b` — clean.
- `npx oxlint` — same 4 pre-existing warnings as Phase 1, no new ones.
- `npx vitest run` — 28/28 passing across 4 files (Phase 1's 21 plus 7 new: Jōyō grade classification, stroke-path counting against a real KanjiVG fragment, duplicate detection - pass and throw cases, Jōyō/JLPT classification summary).
- `npm run build` — succeeds, **482.26 kB JS / 150.52 kB gzip — identical to Phase 1's post-change size**, despite the dataset growing from 135 to 2,387 kanji (3,032 edges). This is the concrete confirmation that Phase 1's runtime-loading architecture holds: the JS bundle does not scale with dataset size at all.
- Manual runtime check: `vite dev`, confirmed `GET /data/manifest.json`, `GET /data/N2/kanji.json` (1,207 kanji), and `GET /data/joyo/kanji.json` (2,136 kanji) all return correct JSON over HTTP.
- Confirmed the app's default (unauthenticated, first-load) behavior is unchanged: N5 is still 103 kanji, so startup cost is identical to Phase 1 regardless of the much larger full dataset now on disk.

### Remaining risks / not done (Phase 2)

- `joyo/` is generated but has no UI entry point yet (no filter checkbox, no way to browse it) — a deliberate scope boundary (data generation only, requested here; wiring it up is a product feature, not requested).
- No browser click-through was performed this phase either (same tooling limitation as Phase 1) — recommend testing N2/N3 (the largest now-real buckets) expand/collapse and search performance by hand.
- Dagre relayout and collapse-BFS still scale with the whole visible graph (unchanged from Phase 1, still explicitly deferred) — now more likely to matter in practice since N2 alone is 1,207 kanji if a user enables it.
- The 315 dropped/unclassified components and the 1 kanji with no English meaning (真) are documented in `quality-report.json` but not otherwise acted on — they're genuine source-data characteristics, not bugs.

### Is the project ready for further work on the full dataset?

Yes for what was asked (generate the complete dataset with quality reporting and a rebuildable pipeline). The natural next step, if wanted, is deciding whether/how to expose `joyo` in the UI (a product decision, not implied by this task) and revisiting the Dagre/collapse performance items now that N2/N3 give real several-hundred-to-thousand-kanji buckets to test against, rather than the ~100-kanji buckets Phase 1 was validated with.

## Addendum: dataset initialization moved out of `GraphCanvas`

A later session added a Kanji List View as the app's default landing screen (see `ARCHITECTURE.md`'s "Kanji List View / Graph View navigation"), which meant `GraphCanvas` - previously the sole place that called `useKanjiDatasetStore.initialize()` and `useKanjiGraphStore.seedRootsIfNeeded()` - might never mount at all on a first visit. Both calls moved up to `HomePage`, which is always mounted regardless of which view is active. Both remain idempotent (unchanged from Phase 1's description above), so this is purely a wiring fix, not a behavior or performance change - level-loading/caching semantics, the manifest/level status machine, and the cross-level edge policy are all exactly as documented above.
