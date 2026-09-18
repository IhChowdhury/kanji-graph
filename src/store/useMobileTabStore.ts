import { create } from 'zustand'

export type MobileTab = 'learn' | 'graph' | 'practice' | 'progress'

interface MobileTabState {
  activeTab: MobileTab
  setActiveTab: (tab: MobileTab) => void
  // Set when the user taps "Select Kanji" from the Graph tab's empty state:
  // Learn should redirect straight back to Graph the moment a kanji is
  // picked, instead of opening its own details sheet in place. Cleared as
  // soon as the user navigates anywhere other than Learn without picking one
  // (so a stray "Learn" tap doesn't leave it armed forever), and consumed
  // (also clearing it) the moment it triggers a redirect.
  isAwaitingGraphSelection: boolean
  requestKanjiForGraph: () => void
  cancelGraphSelection: () => void
}

// Deliberately not persisted - a fresh visit should always land on Learn
// (the default landing screen), matching the "most learners choose a kanji
// first" rationale.
export const useMobileTabStore = create<MobileTabState>((set) => ({
  activeTab: 'learn',
  isAwaitingGraphSelection: false,

  setActiveTab: (tab) =>
    set((state) => ({
      activeTab: tab,
      isAwaitingGraphSelection: tab === 'learn' ? state.isAwaitingGraphSelection : false,
    })),

  requestKanjiForGraph: () => set({ activeTab: 'learn', isAwaitingGraphSelection: true }),

  cancelGraphSelection: () => set({ isAwaitingGraphSelection: false }),
}))
