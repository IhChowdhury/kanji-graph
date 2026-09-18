import kanjiEntries from './kanji.json'
import kanjiEdges from './edges.json'
import type { JlptLevel, KanjiInfo, KanjiJsonEntry } from '../types/kanji'

function toKanjiInfo(entry: KanjiJsonEntry): KanjiInfo {
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

const catalog: Record<string, KanjiInfo> = {}
for (const entry of kanjiEntries as KanjiJsonEntry[]) {
  const info = toKanjiInfo(entry)
  catalog[info.character] = info
}

const childIdsByComponent: Record<string, string[]> = {}
for (const edge of kanjiEdges as { source: string; target: string }[]) {
  childIdsByComponent[edge.source] = [
    ...(childIdsByComponent[edge.source] ?? []),
    edge.target,
  ]
}

export const rootKanjiIds: string[] = Object.values(catalog)
  .filter((kanji) => kanji.components.length === 0)
  .map((kanji) => kanji.character)

export const allKanji: KanjiInfo[] = Object.values(catalog)

export function getKanjiInfo(character: string): KanjiInfo {
  const info = catalog[character]
  if (!info) {
    throw new Error(`Unknown kanji: ${character}`)
  }
  return info
}

export function getChildKanji(character: string): KanjiInfo[] {
  return (childIdsByComponent[character] ?? []).map(getKanjiInfo)
}

export function hasChildKanji(character: string): boolean {
  return (childIdsByComponent[character] ?? []).length > 0
}
