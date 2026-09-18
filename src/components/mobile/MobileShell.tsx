import BottomNav from './BottomNav'
import GraphScreen from './GraphScreen'
import LearnScreen from './LearnScreen'
import PracticeScreen from './PracticeScreen'
import ProgressScreen from './ProgressScreen'
import { useMobileTabStore } from '../../store/useMobileTabStore'

// One primary experience visible at a time, switched via BottomNav - never
// sidebar + graph + details simultaneously. Each screen owns its own compact
// top bar (search/filter, breadcrumb, etc.), so there's no extra shell-level
// header competing for the limited vertical space.
function MobileShell() {
  const activeTab = useMobileTabStore((state) => state.activeTab)

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <main className="flex-1 overflow-hidden">
        {activeTab === 'learn' && <LearnScreen />}
        {activeTab === 'graph' && <GraphScreen />}
        {activeTab === 'practice' && <PracticeScreen />}
        {activeTab === 'progress' && <ProgressScreen />}
      </main>
      <BottomNav />
    </div>
  )
}

export default MobileShell
