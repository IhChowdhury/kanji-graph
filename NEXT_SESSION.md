# Next Session

_Tactical pickup notes — what to do first, and why, based on the actual state of the working tree._

## Version control: done, no longer the top priority

The project is now under git and pushed to `github.com/IhChowdhury/kanji-graph` (this was the previous top item here - it's resolved). Only after Pages is switched to "GitHub Actions" as its source in repo settings does `.github/workflows/deploy.yml` mean anything in practice; whether it has actually run and succeeded was **not** re-verified this session (see Architecture's Build & deploy section).

## Verification debt (still the real top priority)

This session's sandbox still had no working browser automation (`chromium-cli`/Playwright unavailable) - same limitation as before. A substantial UX rework landed this session, verified only via `tsc -b`, `npx vitest run` (77 tests), `npx oxlint`, and `npm run build` - **never by actually clicking through the running app**:

- Learning Focus Mode vs Full Graph Mode (`useGraphModeStore`, `learningFocus.ts`, `GraphCanvas.tsx`'s dual pipeline)
- Kanji List View ↔ Graph View navigation (`useViewModeStore`, `KanjiListView.tsx`, `GraphViewNav.tsx`)
- Selection-centering behavior: pan-only `setCenter` to the newly-focused node (current zoom preserved), skipped entirely on expand/collapse
- The selection/visibility-sync effect that clears focus when the selected node drops out of the currently rendered set
- JLPT-filter consistency in the detail panel (parent/child chips + breadcrumb now respect `enabledLevels`)

Two real runtime bugs were only found in earlier sessions because the user ran the app and reported the exact symptom (a Zustand selector returning a fresh `[]` causing an infinite render loop; a missing `ctx.beginPath()` connecting separate strokes) - there is no reason to assume this session's changes are exempt from the same risk class. **If browser tooling becomes available, do a real click-through pass before trusting anything below that hasn't been explicitly reported as broken.**

## Specific things worth a hands-on check

- **Mode switcher** (`GraphModeSwitcher.tsx`, in the header) - toggling between Learning Focus and Full Graph should restyle the graph immediately without losing the current selection or throwing.
- **Learning Focus Mode's neighborhood** - select a kanji with both parents and children (e.g. 休, which has two parents: 人 and 木) and confirm exactly parents + children (+ grandchildren) render, nothing else, and nothing is dimmed.
- **Back to Kanji List** - select a kanji, navigate a couple of levels deep via parent/child chips, then click back; confirm search text, JLPT filter checkboxes, mastery/study-mode state are all untouched, and no network requests fire (Network tab, filtered to `data/`).
- **Breadcrumb** (`GraphViewNav.tsx`) - click a middle breadcrumb kanji and confirm it re-centers and updates the detail panel; click "Kanji List" and confirm it returns cleanly.
- **Centering animation feel** - click around several kanji in both modes and see whether 400ms feels right, and whether centering while already-centered (re-clicking the same node) looks like a jarring no-op reset rather than nothing happening.
- **JLPT filter + detail panel** - with only N5 enabled, select an N5 kanji that has a real N3/N2 parent or child and confirm the "Additional relationships exist in hidden JLPT levels." note appears instead of exposing the hidden kanji.
- **Writing Practice thresholds** (`WritingPracticePanel.tsx`: `CORRECT_ANGLE_THRESHOLD_DEGREES = 70`, `MAX_POINT_DISTANCE = CANVAS_SIZE * 0.3`) - unchanged from before, still not tuned against real drawing input.
- **Graph layout at the current dataset size** - unchanged from before; matters more now that N2/N3 (real several-hundred-to-thousand-kanji buckets) exist if a user enables them in either mode.

## Known-tunable constants, if something feels off

| Constant | File | Current value |
|---|---|---|
| Selection-centering duration | `useKanjiSelectionStore.ts` | `DEFAULT_FOCUS_DURATION_MS` / `EXPAND_FOCUS_DURATION_MS` = 400ms (300–500ms band) |
| Default graph mode | `useGraphModeStore.ts` | `'focus'` (Learning Focus) |
| Default view mode | `useViewModeStore.ts` | `'list'` (Kanji List) |
| Stroke direction tolerance | `strokeGeometry.ts` usage in `WritingPracticePanel.tsx` | 70° |
| Stroke position tolerance | `WritingPracticePanel.tsx` | 30% of canvas size |
| Graph layout spacing | `graphLayout.ts` | `NODE_SEP`/`RANK_SEP`/`COMPONENT_GAP` constants near the top |
| Daily study list size | `dailyKanji.ts` | `DAILY_KANJI_COUNT = 8` |
| Practice history retention | `usePracticeHistoryStore.ts` | `MAX_HISTORY_PER_KANJI = 20` |

## Don't forget

- `scripts/downloads/` (raw KANJIDIC2/KanjiVG source XML) is gitignored and must be manually placed before running `npm run import:kanji` — it won't exist on a fresh clone.
- Regenerating data (`npm run import:kanji`) rewrites every file under `public/data/` **and** `public/stroke-order/` — always spot-check a few known kanji (e.g. 休, 人, 木) after any regeneration.
