import { useEffect } from 'react'

import GraphCanvas from '../components/layout/GraphCanvas'
import GraphViewNav from '../components/layout/GraphViewNav'
import Header from '../components/layout/Header'
import Sidebar from '../components/layout/Sidebar'
import KanjiListView from '../components/list/KanjiListView'
import KanjiDetailPanel from '../components/panels/KanjiDetailPanel'
import { DEFAULT_JLPT_LEVEL, useKanjiDatasetStore } from '../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../store/useKanjiGraphStore'
import { useViewModeStore } from '../store/useViewModeStore'

function HomePage() {
  const viewMode = useViewModeStore((state) => state.viewMode)

  const initializeDataset = useKanjiDatasetStore((state) => state.initialize)
  const defaultLevelStatus = useKanjiDatasetStore(
    (state) => state.levelStates[DEFAULT_JLPT_LEVEL].status,
  )
  const seedRootsIfNeeded = useKanjiGraphStore((state) => state.seedRootsIfNeeded)

  // Lives here (rather than inside GraphCanvas) because Kanji List is the
  // default landing view - GraphCanvas may never mount on a first visit, so
  // nothing else is guaranteed to trigger the initial data load. Both calls
  // are idempotent (see useKanjiDatasetStore/useKanjiGraphStore), so
  // switching views never re-fetches or re-seeds.
  useEffect(() => {
    void initializeDataset()
  }, [initializeDataset])

  useEffect(() => {
    if (defaultLevelStatus === 'loaded' || defaultLevelStatus === 'empty') {
      seedRootsIfNeeded()
    }
  }, [defaultLevelStatus, seedRootsIfNeeded])

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {viewMode === 'list' ? (
          <KanjiListView />
        ) : (
          <>
            <div className="flex flex-1 flex-col overflow-hidden">
              <GraphViewNav />
              <GraphCanvas />
            </div>
            <KanjiDetailPanel />
          </>
        )}
      </div>
    </div>
  )
}

export default HomePage
