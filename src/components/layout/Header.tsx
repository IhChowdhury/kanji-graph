import GraphModeSwitcher from './GraphModeSwitcher'

function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-4">
      <div className="flex items-center gap-2">
        <span className="text-xl font-semibold text-white">漢字</span>
        <span className="text-lg font-medium text-slate-200">KanjiGraph</span>
      </div>
      <GraphModeSwitcher />
    </header>
  )
}

export default Header
