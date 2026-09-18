import { describe, expect, it } from 'vitest'

import { computeLearningPath } from './graphPath'
import type { KanjiInfo } from '../../types/kanji'

function kanji(character: string, components: string[] = []): KanjiInfo {
  return {
    character,
    meaning: character,
    onyomi: '',
    kunyomi: '',
    components,
    jlptLevel: 'N5',
    strokeCount: 1,
  }
}

// 木 -> 休 -> (nothing further, chain root is 木)
const catalog: Record<string, KanjiInfo> = {
  木: kanji('木'),
  人: kanji('人'),
  休: kanji('休', ['人', '木']),
}

describe('computeLearningPath', () => {
  it('returns [] for no selection', () => {
    expect(computeLearningPath(null, catalog)).toEqual([])
  })

  it('walks the primary-component chain in root-to-selected order by default', () => {
    expect(computeLearningPath('休', catalog)).toEqual(['人', '休'])
  })

  it('always includes the selected character even if it is itself not visible', () => {
    expect(computeLearningPath('休', catalog, () => false)).toEqual(['休'])
  })

  it('stops before adding an ancestor that fails the visibility check', () => {
    // 休's primary component (人) is loaded but JLPT-filtered out - the
    // chain must not expose it, so it stops at 休 alone.
    const isVisible = (character: string) => character !== '人'
    expect(computeLearningPath('休', catalog, isVisible)).toEqual(['休'])
  })

  it('includes an unloaded ancestor referenced by a loaded step, but stops walking past it', () => {
    // 林's own data is loaded and names 木 as its component, so 木 is a real
    // relationship even though 木's own entry isn't loaded - the walk just
    // can't go any further past it (no components field to read).
    const sparseCatalog: Record<string, KanjiInfo> = { 林: kanji('林', ['木']) }
    expect(computeLearningPath('林', sparseCatalog)).toEqual(['木', '林'])
  })
})
