import { create } from 'zustand'

import { useKanjiGraphStore } from './useKanjiGraphStore'
import { DEFAULT_JLPT_LEVEL, useKanjiDatasetStore } from './useKanjiDatasetStore'
import { JLPT_LEVELS, type JlptLevel } from '../types/kanji'

export { JLPT_LEVELS }

interface JlptFilterState {
  enabledLevels: Record<JlptLevel, boolean>
  toggleLevel: (level: JlptLevel) => void
}

export const useJlptFilterStore = create<JlptFilterState>((set, get) => ({
  // Only the default level is active on startup - see KANJIGRAPH_PROJECT.md
  // ("Level-loading and caching behavior"). Other levels are enabled (and
  // their data loaded) only when the user turns them on.
  enabledLevels: {
    N5: DEFAULT_JLPT_LEVEL === 'N5',
    N4: false,
    N3: false,
    N2: false,
    N1: false,
  },
  toggleLevel: (level) => {
    const isEnabling = !get().enabledLevels[level]

    set((state) => ({
      enabledLevels: {
        ...state.enabledLevels,
        [level]: !state.enabledLevels[level],
      },
    }))

    if (isEnabling) {
      void useKanjiDatasetStore
        .getState()
        .ensureLevelLoaded(level)
        .then(() => useKanjiGraphStore.getState().seedRootsIfNeeded())
    }
  },
}))
