import { useMobileTabStore, type MobileTab } from '../../store/useMobileTabStore'

const TABS: { tab: MobileTab; icon: string; label: string }[] = [
  { tab: 'learn', icon: '📚', label: 'Learn' },
  { tab: 'graph', icon: '🌳', label: 'Graph' },
  { tab: 'practice', icon: '✍', label: 'Practice' },
  { tab: 'progress', icon: '📈', label: 'Progress' },
]

// Bottom tab bar - the mobile shell's single navigation surface. Icons stay
// on their own row in portrait; the (max-height: 500px) landscape query in
// index.css collapses the row height while keeping every target >=44px.
function BottomNav() {
  const activeTab = useMobileTabStore((state) => state.activeTab)
  const setActiveTab = useMobileTabStore((state) => state.setActiveTab)

  return (
    <nav
      aria-label="Primary"
      className="mobile-bottom-nav flex shrink-0 items-stretch border-t border-slate-800 bg-slate-950/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(({ tab, icon, label }) => {
        const isActive = activeTab === tab
        return (
          <button
            key={tab}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => setActiveTab(tab)}
            className={`mobile-bottom-nav__item flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              isActive ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            <span aria-hidden className="text-xl leading-none">
              {icon}
            </span>
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNav
