import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PracticeAttempt {
  score: number
  timestamp: string
  userStrokeCount: number
  referenceStrokeCount: number
}

const MAX_HISTORY_PER_KANJI = 20

interface PracticeHistoryState {
  history: Record<string, PracticeAttempt[]>
  recordAttempt: (character: string, attempt: PracticeAttempt) => void
}

export const usePracticeHistoryStore = create<PracticeHistoryState>()(
  persist(
    (set) => ({
      history: {},
      recordAttempt: (character, attempt) =>
        set((state) => {
          const existing = state.history[character] ?? []
          const updated = [attempt, ...existing].slice(0, MAX_HISTORY_PER_KANJI)
          return { history: { ...state.history, [character]: updated } }
        }),
    }),
    { name: 'kanjigraph-practice-history' },
  ),
)
