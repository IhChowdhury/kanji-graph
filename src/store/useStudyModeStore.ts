import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface StudyModeState {
  isActive: boolean
  completedByDate: Record<string, string[]>
  toggleActive: () => void
  isComplete: (date: string, character: string) => boolean
  toggleComplete: (date: string, character: string) => void
}

export const useStudyModeStore = create<StudyModeState>()(
  persist(
    (set, get) => ({
      isActive: false,
      completedByDate: {},

      toggleActive: () => set((state) => ({ isActive: !state.isActive })),

      isComplete: (date, character) =>
        (get().completedByDate[date] ?? []).includes(character),

      toggleComplete: (date, character) =>
        set((state) => {
          const current = state.completedByDate[date] ?? []
          const next = current.includes(character)
            ? current.filter((c) => c !== character)
            : [...current, character]
          return { completedByDate: { ...state.completedByDate, [date]: next } }
        }),
    }),
    { name: 'kanjigraph-study-mode' },
  ),
)
