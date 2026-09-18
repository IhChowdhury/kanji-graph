import type { JlptLevel, KanjiEdgeEntry, KanjiInfo, KanjiJsonEntry } from '../types/kanji'

// Pure data-transformation helpers only - no static import of generated
// JSON and no runtime/loading state here. Data now arrives at runtime (see
// datasetLoader.ts) and is merged/held by useKanjiDatasetStore, which calls
// into these functions whenever the set of loaded levels changes.

// entry.jlpt is optional at the file-schema level (public/data/joyo/kanji.json
// includes Jōyō-only kanji with no legacy-JLPT tag), but the app only ever
// loads N5-N1 bucket files (useKanjiDatasetStore), where it's always set -
// see the KanjiJsonEntry/KanjiInfo comments in types/kanji.ts.
export function toKanjiInfo(entry: KanjiJsonEntry): KanjiInfo {
  return {
    character: entry.kanji,
    meaning: entry.meaning,
    onyomi: entry.onyomi.join('、'),
    kunyomi: entry.kunyomi.join('、'),
    components: entry.components,
    jlptLevel: entry.jlpt as JlptLevel,
    strokeCount: entry.strokes,
  }
}

export function buildKanjiCatalog(entries: KanjiJsonEntry[]): Record<string, KanjiInfo> {
  const catalog: Record<string, KanjiInfo> = {}
  for (const entry of entries) {
    catalog[entry.kanji] = toKanjiInfo(entry)
  }
  return catalog
}

/**
 * Component -> child-kanji index. Previously built with
 * `[...(childIdsByComponent[edge.source] ?? []), edge.target]` inside the
 * loop, which reallocates and copies the whole array-so-far on every edge
 * for a given source - O(k^2) for a source with k children. Building with a
 * Map and pushing is O(1) amortized per edge; the Map is only an
 * intermediate - the exported shape (Record<string, string[]>) is
 * unchanged so existing callers don't need to change.
 */
export function buildChildIndex(edges: KanjiEdgeEntry[]): Record<string, string[]> {
  const index = new Map<string, string[]>()
  for (const edge of edges) {
    const children = index.get(edge.source)
    if (children) {
      children.push(edge.target)
    } else {
      index.set(edge.source, [edge.target])
    }
  }
  return Object.fromEntries(index)
}

export function getRootKanjiIds(catalog: Record<string, KanjiInfo>): string[] {
  return Object.values(catalog)
    .filter((kanji) => kanji.components.length === 0)
    .map((kanji) => kanji.character)
}
