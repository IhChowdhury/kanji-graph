import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { KanjiEdgeEntry, KanjiJsonEntry, LevelDataset } from '../types/kanji'

vi.mock('../data/datasetLoader', () => ({
  loadManifest: vi.fn(),
  loadLevelDataset: vi.fn(),
}))

const { loadLevelDataset } = await import('../data/datasetLoader')
const { useKanjiDatasetStore } = await import('./useKanjiDatasetStore')

const initialState = useKanjiDatasetStore.getState()

function entry(kanji: string, components: string[], jlpt = 'N5'): KanjiJsonEntry {
  return { kanji, meaning: kanji, jlpt, onyomi: [], kunyomi: [], components, strokes: 1 }
}

function edge(source: string, target: string): KanjiEdgeEntry {
  return { id: `${source}->${target}`, source, target }
}

beforeEach(() => {
  useKanjiDatasetStore.setState(initialState, true)
  vi.mocked(loadLevelDataset).mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ensureLevelLoaded', () => {
  it('merges a single level into the catalog', async () => {
    const dataset: LevelDataset = {
      kanji: [entry('一', []), entry('七', ['一'])],
      edges: [edge('一', '七')],
    }
    vi.mocked(loadLevelDataset).mockResolvedValueOnce(dataset)

    await useKanjiDatasetStore.getState().ensureLevelLoaded('N5')
    const state = useKanjiDatasetStore.getState()

    expect(state.levelStates.N5.status).toBe('loaded')
    expect(state.allKanji.map((k) => k.character).sort()).toEqual(['一', '七'])
    expect(state.rootKanjiIds).toEqual(['一'])
    expect(state.mergedEdges).toEqual([edge('一', '七')])
  })

  it('marks a level with zero kanji as empty, not an error', async () => {
    vi.mocked(loadLevelDataset).mockResolvedValueOnce({ kanji: [], edges: [] })

    await useKanjiDatasetStore.getState().ensureLevelLoaded('N1')

    expect(useKanjiDatasetStore.getState().levelStates.N1.status).toBe('empty')
  })

  it('is idempotent: a loaded level is never re-fetched', async () => {
    vi.mocked(loadLevelDataset).mockResolvedValue({ kanji: [entry('一', [])], edges: [] })

    await useKanjiDatasetStore.getState().ensureLevelLoaded('N5')
    await useKanjiDatasetStore.getState().ensureLevelLoaded('N5')
    await useKanjiDatasetStore.getState().ensureLevelLoaded('N5')

    expect(loadLevelDataset).toHaveBeenCalledTimes(1)
  })

  it('records a failed level load without corrupting existing data', async () => {
    vi.mocked(loadLevelDataset).mockRejectedValueOnce(new Error('network down'))

    await useKanjiDatasetStore.getState().ensureLevelLoaded('N4')

    const state = useKanjiDatasetStore.getState()
    expect(state.levelStates.N4.status).toBe('error')
    expect(state.levelStates.N4.error).toBe('network down')
    expect(state.allKanji).toEqual([])
  })

  it('merges multiple levels without duplicate node ids or duplicate edge ids', async () => {
    vi.mocked(loadLevelDataset).mockImplementation((level) => {
      if (level === 'N5') {
        return Promise.resolve({
          kanji: [entry('一', []), entry('七', ['一'])],
          edges: [edge('一', '七')],
        })
      }
      if (level === 'N2') {
        return Promise.resolve({
          // 丁 (N2) depends on 一 (N5) - a genuine cross-level edge.
          kanji: [entry('丁', ['一'], 'N2')],
          edges: [edge('一', '丁')],
        })
      }
      throw new Error(`unexpected level ${level}`)
    })

    await useKanjiDatasetStore.getState().ensureLevelLoaded('N5')
    await useKanjiDatasetStore.getState().ensureLevelLoaded('N2')

    const state = useKanjiDatasetStore.getState()
    const characters = state.allKanji.map((k) => k.character)
    expect(new Set(characters).size).toBe(characters.length) // no duplicate node ids
    expect(characters.sort()).toEqual(['一', '丁', '七'])

    const edgeIds = state.mergedEdges.map((e) => e.id)
    expect(new Set(edgeIds).size).toBe(edgeIds.length) // no duplicate edge ids
    // Cross-level edge is kept once both endpoints (一 from N5, 丁 from N2) are loaded.
    expect(edgeIds).toContain('一->丁')
  })

  it('drops a cross-level edge when only one endpoint is loaded (no placeholder nodes)', async () => {
    vi.mocked(loadLevelDataset).mockResolvedValueOnce({
      // 丁's component 一 is not part of this level's payload and hasn't been loaded.
      kanji: [entry('丁', ['一'], 'N2')],
      edges: [edge('一', '丁')],
    })

    await useKanjiDatasetStore.getState().ensureLevelLoaded('N2')

    const state = useKanjiDatasetStore.getState()
    expect(state.mergedEdges).toEqual([])
    expect(state.childIndex).toEqual({})
  })
})

describe('accessors', () => {
  it('getKanjiInfo/getChildKanji/hasChildKanji reflect currently loaded data', async () => {
    vi.mocked(loadLevelDataset).mockResolvedValueOnce({
      kanji: [entry('木', []), entry('休', ['木'])],
      edges: [edge('木', '休')],
    })

    await useKanjiDatasetStore.getState().ensureLevelLoaded('N5')
    const state = useKanjiDatasetStore.getState()

    expect(state.getKanjiInfo('木')?.character).toBe('木')
    expect(state.getKanjiInfo('missing')).toBeUndefined()
    expect(state.getChildKanji('木').map((k) => k.character)).toEqual(['休'])
    expect(state.hasChildKanji('木')).toBe(true)
    expect(state.hasChildKanji('休')).toBe(false)
  })
})
