# Roadmap

_Generated from gaps and TODO-shaped comments actually observed in the current code — not a wishlist invented from scratch._

## Near-term (would directly extend what already exists)

- **Expand the dataset beyond N5.** The importer already supports `--levels=N4,N3,...` — running it for N4/N3/N2/N1 (with a real N1-capable JLPT source, since KANJIDIC2's legacy scale can't produce N1 — see Architecture) is the natural next step now that the whole pipeline (layout, lazy-expansion, stroke SVGs) is proven at 135 kanji.
- **Error boundary around the graph/detail panel.** One bad selector already took the entire app to a white screen once (see Next Session). A boundary around `HomePage`'s main content would contain future failures to a single panel instead of the whole tree.
- **Tune Writing Practice's acceptance thresholds against real usage.** `CORRECT_ANGLE_THRESHOLD_DEGREES` (70°) and `MAX_POINT_DISTANCE` (30% of canvas) in `WritingPracticePanel.tsx` were chosen by reasoning, not measured against real handwritten attempts — likely to need adjustment once real users (especially touch/stylus) try it.
- **Code-split the bundle.** `npm run build` already warns about a 500KB+ single chunk. React Flow, Dagre, and the practice/stroke-animation code are all reasonable dynamic-import boundaries.

## Medium-term

- **Automated tests.** There is currently no test runner in the project at all. The highest-value first targets, given what's broken so far in practice, are the pure logic modules that don't need a DOM: `graphLayout.ts`, `graphPath.ts`, `strokeGeometry.ts`, `dailyKanji.ts`.
- **A real N1-capable JLPT source.** Replace or supplement the KANJIDIC2 legacy-scale approximation with an actual maintained N5–N1 list so JLPT levels stop being best-effort.
- **Curated (not just templated) mnemonics**, at least for common/root kanji, as an opt-in override on top of the existing template generator.
- **Component-of-component depth.** `computeLearningPath`/`revealKanji` currently only look one level up (a kanji's direct components); once N4–N1 data introduces deeper chains, worth confirming multi-level ancestor chains still read correctly end-to-end.

## Longer-term / not started

- **Version control.** The project has no `.git` at all yet — see Next Session, this blocks almost everything else below.
- **Actually exercise the GitHub Pages deploy workflow** (`.github/workflows/deploy.yml` exists but has never run against a real repo/Pages settings).
- Compound-word support (multi-kanji vocabulary, not just single-kanji component graphs).
- User accounts / cloud sync for mastery + practice history (currently 100% local, per-browser localStorage — clearing site data loses all progress).
- Mobile/touch layout pass — Writing Practice already uses pointer events (mouse+touch+pen unified), but the overall responsive layout hasn't been specifically audited for small screens.
