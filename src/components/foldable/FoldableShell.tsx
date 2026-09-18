import GraphCanvas from '../layout/GraphCanvas'
import Header from '../layout/Header'
import KanjiDetailPanel from '../panels/KanjiDetailPanel'

// Foldable, expanded state: Graph | Details+Practice, deliberately without
// the list column Tablet gets (a foldable's open width is split across two
// physical panels, so each side gets less room than an equivalent-width
// tablet). Folding the device drops below the segment-detection threshold
// and useViewport falls straight through to MobileShell - no separate code
// path to keep in sync.
function FoldableShell() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <main className="relative flex flex-1 border-r border-slate-800">
          <GraphCanvas />
        </main>
        <div className="w-[38%] min-w-[280px] max-w-[420px] shrink-0">
          <KanjiDetailPanel />
        </div>
      </div>
    </div>
  )
}

export default FoldableShell
