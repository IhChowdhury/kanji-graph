# Roadmap

_Generated from gaps and TODO-shaped comments actually observed in the current code — not a wishlist invented from scratch._

## Near-term (would directly extend what already exists)

- ~~Expand the dataset beyond N5.~~ **Done** — the importer now generates the full N5–N1 sweep plus the complete 2,136-kanji Jōyō set by default (`npm run import:kanji`), split under `public/data/<bucket>/`; see `KANJIGRAPH_PROJECT.md`. N1 is still empty (KANJIDIC2's legacy scale genuinely can't produce it — see next item), and the `joyo` bucket is generated but not yet wired into the running app's filters/UI.
- ~~Fix viewport-locking and selection/expand UX; add a Learning Focus Mode.~~ **Done** — Learning Focus Mode (default) shows just the selected kanji's family; Full Graph Mode retains the original exploration graph; selection now centers the viewport (pan-only, zoom preserved) without ever calling `fitView`; expand/collapse never touch the viewport at all. See `ARCHITECTURE.md`.
- ~~Add a way back from the graph to a kanji list.~~ **Done** — Kanji List View (default landing view) ↔ Graph View navigation, with a "Back to Kanji List" control and a breadcrumb trail, persisted view-mode preference. See `ARCHITECTURE.md`.
- ~~Fix the detail panel exposing JLPT-filtered-out relationships.~~ **Done** — parent/child chips and both breadcrumb implementations now share one `isKanjiVisible` check with the graph itself; a note surfaces when relationships are hidden rather than silently dropping them.
- **A real hands-on click-through of the above.** All four items just above were verified only via typecheck/tests/build - no browser automation tooling has been available across multiple sessions now. This is the single highest-value near-term item; see Next Session for the specific things worth checking by hand.
- **Error boundary around the graph/detail panel.** One bad selector already took the entire app to a white screen once (see Next Session). A boundary around `HomePage`'s main content would contain future failures to a single panel instead of the whole tree.
- **Tune Writing Practice's acceptance thresholds against real usage.** The `GATE` constant in `WritingPracticePanel.tsx` (70° angle, 30%-of-canvas position, 35% length ratio, 15% bounding-box overlap — the last two added alongside the new weighted scoring rubric, see `ARCHITECTURE.md`) was chosen by reasoning, not measured against real handwritten attempts — likely to need adjustment once real users (especially touch/stylus) try it.
- **Code-split the bundle.** `npm run build` already warns about a ~490KB single chunk. React Flow, Dagre, and the practice/stroke-animation code are all reasonable dynamic-import boundaries.

## Medium-term

- **Automated tests.** ~~There is currently no test runner in the project at all.~~ Vitest is now set up: 77 tests across 11 files, covering the dataset loader/store, the importer's data-quality logic, Writing Practice's scoring/geometry, the graph selection/expand-collapse stores, Learning Focus Mode's neighborhood computation (`learningFocus.test.ts`), the JLPT-visibility helper (`kanjiVisibility.test.ts`), and the learning-path chain (`graphPath.test.ts`). Still untested: `graphLayout.ts`, `dailyKanji.ts`.
- **A real N1-capable JLPT source.** Replace or supplement the KANJIDIC2 legacy-scale approximation with an actual maintained N5–N1 list so JLPT levels stop being best-effort.
- **Curated (not just templated) mnemonics**, at least for common/root kanji, as an opt-in override on top of the existing template generator.
- **Component-of-component depth.** `computeLearningPath`/`revealKanji` currently only look one level up (a kanji's direct components); Learning Focus Mode is explicitly capped at grandchildren (depth 2) by design, but the breadcrumb chain and `revealKanji`'s ancestor walk are still one-level-at-a-time - once N4–N1 data introduces deeper chains, worth confirming multi-level ancestor chains still read correctly end-to-end.
- **Decide whether Learning Focus Mode should eventually become the *only* graph experience** (retiring Full Graph Mode) now that it's had a release cycle - revisit once the hands-on click-through above has happened and there's real usage signal.

## Longer-term / not started

- ~~Version control.~~ **Done** — the project is now under git, pushed to `github.com/IhChowdhury/kanji-graph`.
- **Actually exercise the GitHub Pages deploy workflow** (`.github/workflows/deploy.yml` exists; now that the repo is under git and pushed, this is achievable, but hasn't been re-verified this session).
- Compound-word support (multi-kanji vocabulary, not just single-kanji component graphs).
- User accounts / cloud sync for mastery + practice history (currently 100% local, per-browser localStorage — clearing site data loses all progress).
- Mobile/touch layout pass — Writing Practice already uses pointer events (mouse+touch+pen unified), but the overall responsive layout (including the newer Kanji List grid and mode switcher) hasn't been specifically audited for small screens.
- Wire the `joyo` bucket into the UI (a new filter/mode to browse the complete Jōyō set) - generated and ready on disk, not yet a product decision anyone's made.
