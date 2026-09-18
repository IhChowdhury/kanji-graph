import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MasteryState {
  masteredIds: Record<string, boolean>
  toggleMastered: (character: string) => void
  setMastered: (character: string, mastered: boolean) => void
}

export const useMasteryStore = create<MasteryState>()(
  persist(
    (set) => ({
      masteredIds: {},
      toggleMastered: (character) =>
        set((state) => ({
          masteredIds: {
            ...state.masteredIds,
            [character]: !state.masteredIds[character],
          },
        })),
      setMastered: (character, mastered) =>
        set((state) => ({
          masteredIds: { ...state.masteredIds, [character]: mastered },
        })),
    }),
    { name: 'kanjigraph-mastery' },
  ),
)
