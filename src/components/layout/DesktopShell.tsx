import GraphCanvas from './GraphCanvas'
import GraphViewNav from './GraphViewNav'
import Header from './Header'
import Sidebar from './Sidebar'
import KanjiListView from '../list/KanjiListView'
import KanjiDetailPanel from '../panels/KanjiDetailPanel'
import { useViewModeStore } from '../../store/useViewModeStore'

// Today's desktop layout (Header + Sidebar + List<->Graph+Detail toggle),
// extracted unchanged out of HomePage so HomePage can dispatch between this
// and the Mobile/Tablet/Foldable shells based on viewport.
function DesktopShell() {
  const viewMode = useViewModeStore((state) => state.viewMode)

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {viewMode === 'list' ? (
          <main className="flex flex-1 overflow-hidden">
            <KanjiListView />
          </main>
        ) : (
          <>
            <main className="flex flex-1 flex-col overflow-hidden">
              <GraphViewNav />
              <GraphCanvas />
            </main>
            <div className="w-80 shrink-0">
              <KanjiDetailPanel />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default DesktopShell
