import { useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import type { KanjiInfo } from '../../types/kanji'

function capitalize(text: string): string {
  return text.length > 0 ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

/**
 * Deterministic, template-based mnemonic sentence built purely from each
 * component's meaning plus the kanji's own meaning - not a hand-authored
 * explanation, so grammar quality varies by kanji, but it stays honest
 * about only ever combining data that's actually in the dataset.
 */
function buildMnemonicSentence(
  componentMeanings: string[],
  kanjiMeaning: string,
): string {
  if (componentMeanings.length === 1) {
    return `${capitalize(componentMeanings[0])} represents ${kanjiMeaning}.`
  }

  if (componentMeanings.length === 2) {
    const [first, second] = componentMeanings
    return `A ${first} and a ${second} come together to mean ${kanjiMeaning}.`
  }

  return `${capitalize(componentMeanings.join(', '))} combine to mean ${kanjiMeaning}.`
}

function MnemonicPanel({ kanji }: { kanji: KanjiInfo }) {
  const catalog = useKanjiDatasetStore((state) => state.catalog)

  if (kanji.components.length === 0) return null

  // A component whose level isn't loaded yet is skipped rather than
  // crashing - see the cross-level policy in KANJIGRAPH_PROJECT.md.
  const componentMeanings = kanji.components
    .map((component) => catalog[component]?.meaning)
    .filter((meaning): meaning is string => Boolean(meaning))

  if (componentMeanings.length === 0) return null

  const sentence = buildMnemonicSentence(componentMeanings, kanji.meaning)

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Mnemonic
      </h3>

      <p className="mt-2 flex flex-wrap items-center gap-1 text-lg text-white">
        {kanji.components.map((component, index) => (
          <span key={component} className="flex items-center gap-1">
            {index > 0 && <span className="text-slate-500">+</span>}
            <span>{component}</span>
          </span>
        ))}
        <span className="text-slate-500">=</span>
        <span className="font-semibold">{kanji.character}</span>
      </p>

      <p className="mt-2 text-sm italic text-slate-300">&quot;{sentence}&quot;</p>
    </div>
  )
}

export default MnemonicPanel
