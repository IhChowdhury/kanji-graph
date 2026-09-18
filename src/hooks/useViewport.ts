import { useSyncExternalStore } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

interface ViewportState {
  breakpoint: Breakpoint
  isFoldableSegmented: boolean
  isCoarsePointer: boolean
}

const TABLET_QUERY = '(min-width: 768px)'
const DESKTOP_QUERY = '(min-width: 1024px)'
// Dual-screen/foldable devices in their expanded state report 2+ viewport
// segments via this CSS media feature - real tablets and phones never match
// it, so it's a safe (if currently rare) signal to distinguish "foldable,
// unfolded" from an ordinary tablet-width viewport. See plan Limitations:
// most browsers don't support this outside dual-screen emulators, so
// unsupported foldables simply fall back to the Tablet/Mobile breakpoint.
const FOLDABLE_QUERY =
  '(horizontal-viewport-segments: 2), (vertical-viewport-segments: 2)'
const COARSE_POINTER_QUERY = '(pointer: coarse)'

// useSyncExternalStore requires getSnapshot to return a referentially
// stable value when nothing has changed - a fresh object literal every call
// makes React think the snapshot changes on every render, which triggers an
// infinite render loop ("Maximum update depth exceeded"). Caching the last
// snapshot and only replacing it when a field actually changed keeps the
// reference stable across calls that see the same matchMedia results.
let cachedSnapshot: ViewportState | null = null

function getSnapshot(): ViewportState {
  const isTabletUp = window.matchMedia(TABLET_QUERY).matches
  const isDesktopUp = window.matchMedia(DESKTOP_QUERY).matches
  const next: ViewportState = {
    breakpoint: isDesktopUp ? 'desktop' : isTabletUp ? 'tablet' : 'mobile',
    isFoldableSegmented: window.matchMedia(FOLDABLE_QUERY).matches,
    isCoarsePointer: window.matchMedia(COARSE_POINTER_QUERY).matches,
  }

  if (
    cachedSnapshot &&
    cachedSnapshot.breakpoint === next.breakpoint &&
    cachedSnapshot.isFoldableSegmented === next.isFoldableSegmented &&
    cachedSnapshot.isCoarsePointer === next.isCoarsePointer
  ) {
    return cachedSnapshot
  }

  cachedSnapshot = next
  return next
}

const SERVER_SNAPSHOT: ViewportState = {
  breakpoint: 'desktop',
  isFoldableSegmented: false,
  isCoarsePointer: false,
}

function subscribe(callback: () => void) {
  const queries = [TABLET_QUERY, DESKTOP_QUERY, FOLDABLE_QUERY, COARSE_POINTER_QUERY].map(
    (query) => window.matchMedia(query),
  )
  queries.forEach((mql) => mql.addEventListener('change', callback))
  return () => {
    queries.forEach((mql) => mql.removeEventListener('change', callback))
  }
}

/**
 * Single source of truth for which shell (Mobile/Tablet/Foldable/Desktop)
 * HomePage renders. Backed by matchMedia rather than resize listeners so it
 * only re-renders on an actual breakpoint crossing, not every pixel of a
 * drag-resize.
 */
export function useViewport(): ViewportState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT)
}
