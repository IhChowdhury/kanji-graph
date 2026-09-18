import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewMode = 'list' | 'graph'

interface ViewModeState {
  viewMode: ViewMode
  setViewMode: (viewMode: ViewMode) => void
}

// Kanji List is the default landing view (see KanjiListView) - selecting a
// kanji from the list or search switches to 'graph'; "Back to Kanji List"
// switches back. Persisted so a refresh restores whichever view the user
// was on.
export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      viewMode: 'list',
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    { name: 'kanjigraph-view-mode' },
  ),
)
