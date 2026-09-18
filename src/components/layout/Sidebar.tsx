import JlptFilterPanel from '../filters/JlptFilterPanel'
import MasteryProgress from '../progress/MasteryProgress'
import KanjiSearch from '../search/KanjiSearch'
import StudyModePanel from '../study/StudyModePanel'

function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Kanji List
      </h2>
      <KanjiSearch />
      <JlptFilterPanel />
      <MasteryProgress />
      <StudyModePanel />
    </aside>
  )
}

export default Sidebar
