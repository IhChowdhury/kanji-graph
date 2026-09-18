# Roadmap

_Generated from gaps and TODO-shaped comments actually observed in the current code — not a wishlist invented from scratch._

## Near-term (would directly extend what already exists)

- ~~Expand the dataset beyond N5.~~ **Done** — the importer now generates the full N5–N1 sweep plus the complete 2,136-kanji Jōyō set by default (`npm run import:kanji`), split under `public/data/<bucket>/`; see `KANJIGRAPH_PROJECT.md`. N1 is still empty (KANJIDIC2's legacy scale genuinely can't produce it — see next item), and the `joyo` bucket is generated but not yet wired into the running app's filters/UI.
- **Error boundary around the graph/detail panel.** One bad selector already took the entire app to a white screen once (see Next Session). A boundary around `HomePage`'s main content would contain future failures to a single panel instead of the whole tree.
- **Tune Writing Practice's acceptance thresholds against real usage.** The `GATE` constant in `WritingPracticePanel.tsx` (70° angle, 30%-of-canvas position, 35% length ratio, 15% bounding-box overlap — the last two added alongside the new weighted scoring rubric, see `ARCHITECTURE.md`) was chosen by reasoning, not measured against real handwritten attempts — likely to need adjustment once real users (especially touch/stylus) try it.
- **Code-split the bundle.** `npm run build` already warns about a 500KB+ single chunk. React Flow, Dagre, and the practice/stroke-animation code are all reasonable dynamic-import boundaries.

## Medium-term

- **Automated tests.** ~~There is currently no test runner in the project at all.~~ Vitest is now set up, covering the dataset loader/store, the importer's data-quality logic, and Writing Practice's scoring/geometry (`scoring.test.ts`, `strokeGeometry.test.ts`). Still untested: `graphLayout.ts`, `graphPath.ts`, `dailyKanji.ts`.
- **A real N1-capable JLPT source.** Replace or supplement the KANJIDIC2 legacy-scale approximation with an actual maintained N5–N1 list so JLPT levels stop being best-effort.
- **Curated (not just templated) mnemonics**, at least for common/root kanji, as an opt-in override on top of the existing template generator.
- **Component-of-component depth.** `computeLearningPath`/`revealKanji` currently only look one level up (a kanji's direct components); once N4–N1 data introduces deeper chains, worth confirming multi-level ancestor chains still read correctly end-to-end.

## Longer-term / not started

- **Version control.** The project has no `.git` at all yet — see Next Session, this blocks almost everything else below.
- **Actually exercise the GitHub Pages deploy workflow** (`.github/workflows/deploy.yml` exists but has never run against a real repo/Pages settings).
- Compound-word support (multi-kanji vocabulary, not just single-kanji component graphs).
- User accounts / cloud sync for mastery + practice history (currently 100% local, per-browser localStorage — clearing site data loses all progress).
- Mobile/touch layout pass — Writing Practice already uses pointer events (mouse+touch+pen unified), but the overall responsive layout hasn't been specifically audited for small screens.
