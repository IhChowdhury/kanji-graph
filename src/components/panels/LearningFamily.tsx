import { isKanjiVisible } from '../../data/kanjiVisibility'
import { useJlptFilterStore } from '../../store/useJlptFilterStore'
import { useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import type { KanjiInfo } from '../../types/kanji'

const HIDDEN_RELATIONSHIPS_NOTE = 'Additional relationships exist in hidden JLPT levels.'

function KanjiChip({
  character,
  onClick,
}: {
  character: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-xl text-white transition-colors hover:border-slate-500 hover:bg-slate-700"
    >
      {character}
    </button>
  )
}

function KanjiChipGroup({
  title,
  characters,
  emptyLabel,
  hiddenNote,
  onSelect,
}: {
  title: string
  characters: string[]
  emptyLabel: string
  hiddenNote?: string
  onSelect: (character: string) => void
}) {
  return (
    <div>
      <h4 className="text-xs font-medium text-slate-500">{title}</h4>
      {characters.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {characters.map((character) => (
            <KanjiChip
              key={character}
              character={character}
              onClick={() => onSelect(character)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">{emptyLabel}</p>
      )}
      {hiddenNote && <p className="mt-1 text-xs italic text-slate-500">{hiddenNote}</p>}
    </div>
  )
}

function LearningFamily({ kanji }: { kanji: KanjiInfo }) {
  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)
  const catalog = useKanjiDatasetStore((state) => state.catalog)
  const childIndex = useKanjiDatasetStore((state) => state.childIndex)
  const enabledLevels = useJlptFilterStore((state) => state.enabledLevels)

  // Every real parent/child relationship, including ones whose data isn't
  // loaded or whose JLPT level is currently disabled - narrowed to just the
  // visible ones below so the panel never exposes a relationship the graph
  // itself is hiding (see isKanjiVisible).
  const allParents = kanji.components
  const allChildren = childIndex[kanji.character] ?? []

  const parents = allParents.filter((id) => isKanjiVisible(id, catalog, enabledLevels))
  const children = allChildren.filter((id) => isKanjiVisible(id, catalog, enabledLevels))

  const hasHiddenParents = parents.length < allParents.length
  const hasHiddenChildren = children.length < allChildren.length

  const navigateTo = (character: string) => {
    const info = catalog[character]
    if (!info) return
    revealKanji(character)
    focusKanji(info)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Learning Family
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {parents.length} parent{parents.length === 1 ? '' : 's'} · {children.length}{' '}
          child{children.length === 1 ? '' : 'ren'}
        </p>
      </div>

      <KanjiChipGroup
        title="Parent Kanji"
        characters={parents}
        emptyLabel="None - this is a root kanji"
        hiddenNote={hasHiddenParents ? HIDDEN_RELATIONSHIPS_NOTE : undefined}
        onSelect={navigateTo}
      />

      <KanjiChipGroup
        title="Child Kanji"
        characters={children}
        emptyLabel="No kanji build on this one yet"
        hiddenNote={hasHiddenChildren ? HIDDEN_RELATIONSHIPS_NOTE : undefined}
        onSelect={navigateTo}
      />
    </div>
  )
}

export default LearningFamily
