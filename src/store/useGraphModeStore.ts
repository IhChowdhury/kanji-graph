import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type GraphMode = 'focus' | 'full'

interface GraphModeState {
  mode: GraphMode
  setMode: (mode: GraphMode) => void
}

// Learning Focus is the default: new/returning learners should land on a
// single kanji family, not the full multi-hundred-node graph. Persisted so
// the choice survives a reload (see Header's mode switcher).
export const useGraphModeStore = create<GraphModeState>()(
  persist(
    (set) => ({
      mode: 'focus',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'kanjigraph-graph-mode' },
  ),
)
