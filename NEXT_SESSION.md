# Next Session

_Tactical pickup notes — what to do first, and why, based on the actual state of the working tree._

## Do this first: get the project under version control

There is **no `.git` directory in this project at all.** Every change across every session so far exists only on disk, with no history, no rollback, no diff, nothing pushed anywhere. This is the single highest-risk item — before anything else:

```
git init
git add <deliberately, not -A — check .env/credentials aren't present first>
git commit -m "Initial commit"
```

Only after this is in place does the GitHub Pages workflow (`.github/workflows/deploy.yml`) mean anything — it currently exists but has never run, and can't until there's a remote to push to and Pages is switched to "GitHub Actions" as its source in repo settings (see `ARCHITECTURE.md` / the deploy turn's notes).

## Verification debt

This session's sandbox never had working browser automation (`chromium-cli`/Playwright unavailable), so a lot of features across many turns were verified only via `tsc -b && vite build` (type-checks + bundles) and static code reading — **not** by actually clicking through the running app. Two real runtime bugs were only found because the user ran it themselves and reported the exact symptom:

1. A Zustand selector returning a fresh `[]` literal on every call → infinite render loop → white page (fixed: stable `EMPTY_HISTORY` reference).
2. A missing `ctx.beginPath()`/`moveTo()` on stroke start → canvas drew connecting lines between separate strokes (fixed).
3. Direction-only stroke matching accepted out-of-order strokes → added position (start/end proximity) checks (fixed, but see below).

**Take-away for next session:** if browser tooling becomes available, do a real click-through pass over the whole app before trusting anything that hasn't been explicitly reported as broken — there may be more of these latent, since most of the last ~10 features were never actually run.

## Specific things worth a hands-on check

- **Writing Practice thresholds** (`WritingPracticePanel.tsx`: `CORRECT_ANGLE_THRESHOLD_DEGREES = 70`, `MAX_POINT_DISTANCE = CANVAS_SIZE * 0.3`). These were reasoned about, not tuned against real drawing input. Try a few multi-stroke kanji (休, 何) with genuinely wrong strokes and genuinely-a-bit-sloppy-but-correct strokes and see if the accept/reject boundary feels right.
- **Stroke Animation / Stroke Order panel** — confirm the play/pause/speed controls feel smooth, especially the mid-stroke speed-change rebasing logic in `StrokeAnimation.tsx`.
- **Graph layout at the current dataset size** (135 kanji, 56 roots) — confirm the Dagre-per-component + grid-packing in `graphLayout.ts` still reads cleanly; this was specifically re-worked after an earlier "looks like a grid" complaint, and will matter more once the dataset grows (see `ROADMAP.md`).

## Known-tunable constants, if something feels off

| Constant | File | Current value |
|---|---|---|
| Stroke direction tolerance | `strokeGeometry.ts` usage in `WritingPracticePanel.tsx` | 70° |
| Stroke position tolerance | `WritingPracticePanel.tsx` | 30% of canvas size |
| Graph layout spacing | `graphLayout.ts` | `NODE_SEP`/`RANK_SEP`/`COMPONENT_GAP` constants near the top |
| Daily study list size | `dailyKanji.ts` | `DAILY_KANJI_COUNT = 8` |
| Practice history retention | `usePracticeHistoryStore.ts` | `MAX_HISTORY_PER_KANJI = 20` |

## Don't forget

- `scripts/downloads/` (raw KANJIDIC2/KanjiVG source XML) is gitignored and must be manually placed before running `npm run import:kanji` — it won't exist on a fresh clone.
- Regenerating data (`npm run import:kanji`) rewrites `src/data/kanji.json`, `src/data/edges.json`, **and** every file in `public/stroke-order/` — always spot-check a few known kanji (e.g. 休, 人, 木) after any regeneration, the same way it was checked the first time.
