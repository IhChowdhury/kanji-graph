import { create } from 'zustand'

import type { KanjiInfo } from '../types/kanji'

// Plain node click / search / reveal / breadcrumb nav: fit just the focused
// node, at the existing tuned duration - unchanged from before expand had
// its own richer viewport behavior (see GraphCanvas.tsx's fit effect).
const DEFAULT_FOCUS_DURATION_MS = 800
// Expand: shorter, snappier animation per spec (300-500ms).
const EXPAND_FOCUS_DURATION_MS = 400

const NO_EXTRA_NODE_IDS: string[] = []

interface KanjiSelectionState {
  selectedKanji: KanjiInfo | null
  focusNodeId: string | null
  focusToken: number
  // Additional node ids (besides focusNodeId) that should be brought into
  // view together - the newly-revealed branch on an expand-triggered
  // focus, empty for every other kind of focus.
  focusExtraNodeIds: string[]
  focusDurationMs: number
  // Distinguishes an expand-triggered focus from every other kind, driving
  // GraphCanvas's choice of fit strategy (branch-fit + preserve-zoom vs.
  // the plain single-node fit). Deliberately its own flag rather than
  // inferred from `focusExtraNodeIds.length > 0` - an expand can legally
  // add zero *new* nodes (e.g. its only child is already visible via
  // another expanded branch), and that's still an expand for viewport
  // purposes, not a plain focus.
  isExpandFocus: boolean
  focusKanji: (kanji: KanjiInfo) => void
  focusKanjiForExpand: (kanji: KanjiInfo, extraNodeIds: string[]) => void
}

export const useKanjiSelectionStore = create<KanjiSelectionState>((set) => ({
  selectedKanji: null,
  focusNodeId: null,
  focusToken: 0,
  focusExtraNodeIds: NO_EXTRA_NODE_IDS,
  focusDurationMs: DEFAULT_FOCUS_DURATION_MS,
  isExpandFocus: false,

  focusKanji: (kanji) =>
    set((state) => ({
      selectedKanji: kanji,
      focusNodeId: kanji.character,
      focusToken: state.focusToken + 1,
      focusExtraNodeIds: NO_EXTRA_NODE_IDS,
      focusDurationMs: DEFAULT_FOCUS_DURATION_MS,
      isExpandFocus: false,
    })),

  // Selects the just-expanded node (opens its detail panel + highlights its
  // learning path, both already driven by selectedKanji/focusNodeId) and
  // records the newly-revealed branch so GraphCanvas's fit effect can bring
  // the whole branch into view instead of just the expanded node itself.
  focusKanjiForExpand: (kanji, extraNodeIds) =>
    set((state) => ({
      selectedKanji: kanji,
      focusNodeId: kanji.character,
      focusToken: state.focusToken + 1,
      focusExtraNodeIds: extraNodeIds,
      focusDurationMs: EXPAND_FOCUS_DURATION_MS,
      isExpandFocus: true,
    })),
}))
