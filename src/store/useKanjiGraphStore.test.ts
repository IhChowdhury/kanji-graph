import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { KanjiInfo } from '../types/kanji'

vi.mock('./useKanjiDatasetStore', () => ({
  useKanjiDatasetStore: { getState: vi.fn() },
}))

const { useKanjiDatasetStore } = await import('./useKanjiDatasetStore')
const { useKanjiGraphStore } = await import('./useKanjiGraphStore')

const initialState = useKanjiGraphStore.getState()

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

function mockDataset(overrides: {
  rootKanjiIds?: string[]
  getChildKanji?: (id: string) => KanjiInfo[]
  getKanjiInfo?: (id: string) => KanjiInfo | undefined
}) {
  vi.mocked(useKanjiDatasetStore.getState).mockReturnValue({
    rootKanjiIds: overrides.rootKanjiIds ?? [],
    getChildKanji: overrides.getChildKanji ?? (() => []),
    getKanjiInfo: overrides.getKanjiInfo ?? (() => undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

beforeEach(() => {
  useKanjiGraphStore.setState(initialState, true)
  vi.mocked(useKanjiDatasetStore.getState).mockReset()
})

describe('toggleExpand', () => {
  it('returns the ids of newly-added child nodes on expand', () => {
    mockDataset({ getChildKanji: (id) => (id === '木' ? [kanji('休'), kanji('林')] : []) })
    useKanjiGraphStore.setState({
      nodes: [{ id: '木', type: 'kanji', position: { x: 0, y: 0 }, data: kanji('木') }],
    })

    const result = useKanjiGraphStore.getState().toggleExpand('木')

    expect(result).toEqual(['休', '林'])
    expect(useKanjiGraphStore.getState().nodes.map((n) => n.id).sort()).toEqual(
      ['休', '林', '木'].sort(),
    )
    expect(useKanjiGraphStore.getState().expandedIds.has('木')).toBe(true)
  })

  it('excludes children that are already present as nodes from the returned ids', () => {
    mockDataset({ getChildKanji: () => [kanji('休'), kanji('林')] })
    useKanjiGraphStore.setState({
      nodes: [
        { id: '木', type: 'kanji', position: { x: 0, y: 0 }, data: kanji('木') },
        { id: '休', type: 'kanji', position: { x: 0, y: 0 }, data: kanji('休') }, // already visible
      ],
    })

    const result = useKanjiGraphStore.getState().toggleExpand('木')

    expect(result).toEqual(['林']) // 休 was already there, not "newly added"
  })

  it('returns null (not an empty array) when the call collapses the node', () => {
    mockDataset({ rootKanjiIds: ['木'] })
    useKanjiGraphStore.setState({
      nodes: [
        { id: '木', type: 'kanji', position: { x: 0, y: 0 }, data: kanji('木') },
        { id: '休', type: 'kanji', position: { x: 0, y: 0 }, data: kanji('休', ['木']) },
      ],
      edges: [{ id: '木->休', source: '木', target: '休' }],
      expandedIds: new Set(['木']),
    })

    const result = useKanjiGraphStore.getState().toggleExpand('木')

    expect(result).toBeNull()
    expect(useKanjiGraphStore.getState().expandedIds.has('木')).toBe(false)
    expect(useKanjiGraphStore.getState().nodes.map((n) => n.id)).toEqual(['木'])
  })

  it('returns an empty array (still a valid expand, not a collapse) when every child was already visible', () => {
    mockDataset({ getChildKanji: () => [kanji('休')] })
    useKanjiGraphStore.setState({
      nodes: [
        { id: '木', type: 'kanji', position: { x: 0, y: 0 }, data: kanji('木') },
        { id: '休', type: 'kanji', position: { x: 0, y: 0 }, data: kanji('休') },
      ],
    })

    const result = useKanjiGraphStore.getState().toggleExpand('木')

    expect(result).toEqual([])
    expect(result).not.toBeNull()
  })
})
