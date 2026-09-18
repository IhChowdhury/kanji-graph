import { useEffect } from 'react'

import DesktopShell from '../components/layout/DesktopShell'
import FoldableShell from '../components/foldable/FoldableShell'
import MobileShell from '../components/mobile/MobileShell'
import TabletShell from '../components/tablet/TabletShell'
import { useViewport } from '../hooks/useViewport'
import { DEFAULT_JLPT_LEVEL, useKanjiDatasetStore } from '../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../store/useKanjiGraphStore'

function HomePage() {
  const { breakpoint, isFoldableSegmented } = useViewport()

  const initializeDataset = useKanjiDatasetStore((state) => state.initialize)
  const defaultLevelStatus = useKanjiDatasetStore(
    (state) => state.levelStates[DEFAULT_JLPT_LEVEL].status,
  )
  const seedRootsIfNeeded = useKanjiGraphStore((state) => state.seedRootsIfNeeded)

  // Lives here (rather than inside any one shell) because which shell mounts
  // first depends on viewport - e.g. MobileShell's default Learn screen
  // never mounts GraphCanvas at all - so nothing else is guaranteed to
  // trigger the initial data load. Both calls are idempotent (see
  // useKanjiDatasetStore/useKanjiGraphStore), so switching shells on
  // resize/fold never re-fetches or re-seeds.
  useEffect(() => {
    void initializeDataset()
  }, [initializeDataset])

  useEffect(() => {
    if (defaultLevelStatus === 'loaded' || defaultLevelStatus === 'empty') {
      seedRootsIfNeeded()
    }
  }, [defaultLevelStatus, seedRootsIfNeeded])

  if (isFoldableSegmented) return <FoldableShell />
  if (breakpoint === 'mobile') return <MobileShell />
  if (breakpoint === 'tablet') return <TabletShell />
  return <DesktopShell />
}

export default HomePage
