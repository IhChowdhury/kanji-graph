import GraphCanvas from '../components/layout/GraphCanvas'
import Header from '../components/layout/Header'
import Sidebar from '../components/layout/Sidebar'
import KanjiDetailPanel from '../components/panels/KanjiDetailPanel'

function HomePage() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <GraphCanvas />
        <KanjiDetailPanel />
      </div>
    </div>
  )
}

export default HomePage
