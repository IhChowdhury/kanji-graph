import { describe, expect, it } from 'vitest'

import { computeLearningFocusGraph } from './learningFocus'
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

// 木 -> 林 -> 森 (grandchild), 木 -> 本 ; 休 <- 人, 休 <- 木 (two parents)
const catalog: Record<string, KanjiInfo> = {
  木: kanji('木'),
  人: kanji('人'),
  本: kanji('本', ['木']),
  林: kanji('林', ['木']),
  森: kanji('森', ['林']),
  休: kanji('休', ['人', '木']),
}
const childIndex: Record<string, string[]> = {
  木: ['本', '林', '休'],
  人: ['休'],
  林: ['森'],
}

describe('computeLearningFocusGraph', () => {
  it('returns an empty graph for no selection or unknown kanji', () => {
    expect(computeLearningFocusGraph(null, catalog, childIndex).nodeIds.size).toBe(0)
    expect(computeLearningFocusGraph('missing', catalog, childIndex).nodeIds.size).toBe(0)
  })

  it('includes parents, direct children, and grandchildren for a root-ish kanji', () => {
    const graph = computeLearningFocusGraph('木', catalog, childIndex)

    expect(graph.parentIds).toEqual(new Set())
    expect(graph.childIds).toEqual(new Set(['本', '林', '休']))
    expect(graph.grandchildIds).toEqual(new Set(['森']))
    expect(graph.nodeIds).toEqual(new Set(['木', '本', '林', '休', '森']))
  })

  it('includes every parent when a kanji has more than one component', () => {
    const graph = computeLearningFocusGraph('休', catalog, childIndex)

    expect(graph.parentIds).toEqual(new Set(['人', '木']))
    expect(graph.childIds).toEqual(new Set())
    expect(graph.nodeIds).toEqual(new Set(['休', '人', '木']))
  })

  it('builds edges connecting parents to self and self/children to their children', () => {
    const graph = computeLearningFocusGraph('木', catalog, childIndex)
    const edgeIds = graph.edges.map((edge) => edge.id).sort()

    expect(edgeIds).toEqual(['木->休', '木->本', '木->林', '林->森'].sort())
  })

  it('does not include a grandchild whose data is not in the loaded catalog', () => {
    const sparseCatalog: Record<string, KanjiInfo> = { 木: kanji('木'), 林: kanji('林', ['木']) }
    const graph = computeLearningFocusGraph('木', sparseCatalog, {
      木: ['林'],
      林: ['森'], // 森 not in sparseCatalog - e.g. its JLPT level isn't enabled
    })

    expect(graph.childIds).toEqual(new Set(['林']))
    expect(graph.grandchildIds).toEqual(new Set())
    expect(graph.nodeIds).toEqual(new Set(['木', '林']))
  })
})
