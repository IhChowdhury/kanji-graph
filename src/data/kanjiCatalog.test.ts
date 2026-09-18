import { describe, expect, it } from 'vitest'

import { buildChildIndex, buildKanjiCatalog, getRootKanjiIds, toKanjiInfo } from './kanjiCatalog'
import type { KanjiEdgeEntry, KanjiJsonEntry } from '../types/kanji'

function entry(overrides: Partial<KanjiJsonEntry>): KanjiJsonEntry {
  return {
    kanji: '休',
    meaning: 'rest',
    jlpt: 'N5',
    onyomi: ['キュウ'],
    kunyomi: ['やすむ'],
    components: ['人', '木'],
    strokes: 6,
    ...overrides,
  }
}

describe('toKanjiInfo', () => {
  it('joins onyomi/kunyomi and renames fields', () => {
    const info = toKanjiInfo(entry({}))
    expect(info).toEqual({
      character: '休',
      meaning: 'rest',
      onyomi: 'キュウ',
      kunyomi: 'やすむ',
      components: ['人', '木'],
      jlptLevel: 'N5',
      strokeCount: 6,
    })
  })
})

describe('buildKanjiCatalog', () => {
  it('indexes entries by character', () => {
    const catalog = buildKanjiCatalog([
      entry({ kanji: '人', components: [] }),
      entry({ kanji: '木', components: [] }),
      entry({ kanji: '休', components: ['人', '木'] }),
    ])
    expect(Object.keys(catalog).sort()).toEqual(['人', '休', '木'])
    expect(catalog['休'].components).toEqual(['人', '木'])
  })
})

describe('getRootKanjiIds', () => {
  it('returns only kanji with no components', () => {
    const catalog = buildKanjiCatalog([
      entry({ kanji: '人', components: [] }),
      entry({ kanji: '木', components: [] }),
      entry({ kanji: '休', components: ['人', '木'] }),
    ])
    expect(getRootKanjiIds(catalog).sort()).toEqual(['人', '木'])
  })
})

describe('buildChildIndex', () => {
  it('groups multiple children under the same source', () => {
    const edges: KanjiEdgeEntry[] = [
      { id: '一->丁', source: '一', target: '丁' },
      { id: '一->七', source: '一', target: '七' },
      { id: '一->万', source: '一', target: '万' },
      { id: '乙->七', source: '乙', target: '七' },
    ]
    const index = buildChildIndex(edges)
    expect(index['一']).toEqual(['丁', '七', '万'])
    expect(index['乙']).toEqual(['七'])
  })

  it('returns an empty index for no edges', () => {
    expect(buildChildIndex([])).toEqual({})
  })

  it('preserves edge order per source and handles high fan-out without losing entries', () => {
    const edges: KanjiEdgeEntry[] = Array.from({ length: 200 }, (_, i) => ({
      id: `木->child${i}`,
      source: '木',
      target: `child${i}`,
    }))
    const index = buildChildIndex(edges)
    expect(index['木']).toHaveLength(200)
    expect(index['木'][0]).toBe('child0')
    expect(index['木'][199]).toBe('child199')
  })
})
