import { create } from 'zustand'

import type { JlptLevel } from '../types/kanji'

export const JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

interface JlptFilterState {
  enabledLevels: Record<JlptLevel, boolean>
  toggleLevel: (level: JlptLevel) => void
}

export const useJlptFilterStore = create<JlptFilterState>((set) => ({
  enabledLevels: {
    N5: true,
    N4: true,
    N3: true,
    N2: true,
    N1: true,
  },
  toggleLevel: (level) =>
    set((state) => ({
      enabledLevels: {
        ...state.enabledLevels,
        [level]: !state.enabledLevels[level],
      },
    })),
}))
