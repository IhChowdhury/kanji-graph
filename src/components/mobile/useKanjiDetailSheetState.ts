import { useEffect, useRef, useState } from 'react'

import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import type { SheetSnap } from './BottomSheet'

// Shared by LearnScreen, GraphScreen and ProgressScreen: all three open the
// same detail bottom sheet off the same global selection. The sheet opens
// only in response to a *fresh* selection made while the screen is mounted
// (a card tap, node tap, breadcrumb/chip navigation - anything that bumps
// focusToken) - not merely because a kanji happens to already be selected.
// That's what lets "Explore Graph" (and returning to Graph after picking a
// kanji from its empty state) land on an unobstructed graph centered on the
// existing selection, instead of immediately re-covering it with the sheet.
export function useKanjiDetailSheetState() {
  const kanji = useKanjiSelectionStore((state) => state.selectedKanji)
  const focusToken = useKanjiSelectionStore((state) => state.focusToken)
  const close = useKanjiSelectionStore((state) => state.clearFocus)
  const [snap, setSnap] = useState<SheetSnap>('half')
  const [isOpen, setIsOpen] = useState(false)
  const lastSeenTokenRef = useRef(focusToken)

  useEffect(() => {
    if (focusToken !== lastSeenTokenRef.current) {
      lastSeenTokenRef.current = focusToken
      setSnap('half')
      setIsOpen(true)
    }
  }, [focusToken])

  return {
    kanji,
    open: isOpen && Boolean(kanji),
    snap,
    setSnap,
    // Hides the sheet without deselecting - used by "Explore Graph" when
    // it's tapped from within the Graph tab's own sheet, so it reveals the
    // (already centered) graph behind it instead of leaving the selection
    // and the screen unchanged.
    dismiss: () => setIsOpen(false),
    // Drag-down-past-peek / backdrop tap: hides the sheet AND deselects.
    close: () => {
      setIsOpen(false)
      close()
    },
  }
}
