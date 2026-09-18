import { create } from 'zustand'

import type { KanjiInfo } from '../types/kanji'

interface KanjiSelectionState {
  selectedKanji: KanjiInfo | null
  focusNodeId: string | null
  focusToken: number
  focusKanji: (kanji: KanjiInfo) => void
}

export const useKanjiSelectionStore = create<KanjiSelectionState>((set) => ({
  selectedKanji: null,
  focusNodeId: null,
  focusToken: 0,
  focusKanji: (kanji) =>
    set((state) => ({
      selectedKanji: kanji,
      focusNodeId: kanji.character,
      focusToken: state.focusToken + 1,
    })),
}))
