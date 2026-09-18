import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearDatasetCaches, dataUrl, loadLevelDataset, loadManifest } from './datasetLoader'
import type { DatasetManifest, KanjiEdgeEntry, KanjiJsonEntry } from '../types/kanji'

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  } as Response
}

const manifest: DatasetManifest = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  defaultLevel: 'N5',
  levels: {
    N5: { available: true, kanjiCount: 1, edgeCount: 0 },
    N4: { available: false, kanjiCount: 0, edgeCount: 0, reason: 'none' },
    N3: { available: false, kanjiCount: 0, edgeCount: 0, reason: 'none' },
    N2: { available: false, kanjiCount: 0, edgeCount: 0, reason: 'none' },
    N1: { available: false, kanjiCount: 0, edgeCount: 0, reason: 'none' },
  },
}

const n5Kanji: KanjiJsonEntry[] = [
  {
    kanji: '一',
    meaning: 'one',
    jlpt: 'N5',
    onyomi: ['イチ'],
    kunyomi: ['ひとつ'],
    components: [],
    strokes: 1,
  },
]
const n5Edges: KanjiEdgeEntry[] = []

beforeEach(() => {
  clearDatasetCaches()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('dataUrl', () => {
  it('builds GitHub Pages project-site URLs from BASE_URL, never a domain-root path', () => {
    const original = import.meta.env.BASE_URL
    import.meta.env.BASE_URL = '/kanji-graph/'
    try {
      expect(dataUrl('manifest.json')).toBe('/kanji-graph/data/manifest.json')
      expect(dataUrl('N5', 'kanji.json')).toBe('/kanji-graph/data/N5/kanji.json')
    } finally {
      import.meta.env.BASE_URL = original
    }
  })

  it('builds root-relative URLs for local dev/production with default BASE_URL', () => {
    const original = import.meta.env.BASE_URL
    import.meta.env.BASE_URL = '/'
    try {
      expect(dataUrl('manifest.json')).toBe('/data/manifest.json')
    } finally {
      import.meta.env.BASE_URL = original
    }
  })
})

describe('loadLevelDataset', () => {
  it('loads one JLPT level (manifest + kanji + edges)', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('manifest.json')) return Promise.resolve(jsonResponse(manifest))
      if (url.endsWith('N5/kanji.json')) return Promise.resolve(jsonResponse(n5Kanji))
      if (url.endsWith('N5/edges.json')) return Promise.resolve(jsonResponse(n5Edges))
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadLevelDataset('N5')

    expect(result.kanji).toEqual(n5Kanji)
    expect(result.edges).toEqual(n5Edges)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('resolves to an empty dataset for an unavailable level without fetching its files', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('manifest.json')) return Promise.resolve(jsonResponse(manifest))
      throw new Error(`unexpected fetch for unavailable level: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadLevelDataset('N1')

    expect(result).toEqual({ kanji: [], edges: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1) // manifest only
  })

  it('caches a successfully loaded level and never re-fetches it', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('manifest.json')) return Promise.resolve(jsonResponse(manifest))
      if (url.endsWith('N5/kanji.json')) return Promise.resolve(jsonResponse(n5Kanji))
      if (url.endsWith('N5/edges.json')) return Promise.resolve(jsonResponse(n5Edges))
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await loadLevelDataset('N5')
    const callsAfterFirstLoad = fetchMock.mock.calls.length
    await loadLevelDataset('N5')
    await loadLevelDataset('N5')

    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirstLoad)
  })

  it('does not cache a failed request, so a later call retries', async () => {
    let kanjiCallCount = 0
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('manifest.json')) return Promise.resolve(jsonResponse(manifest))
      if (url.endsWith('N5/kanji.json')) {
        kanjiCallCount += 1
        return kanjiCallCount === 1
          ? Promise.resolve(jsonResponse(null, false, 500))
          : Promise.resolve(jsonResponse(n5Kanji))
      }
      if (url.endsWith('N5/edges.json')) return Promise.resolve(jsonResponse(n5Edges))
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadLevelDataset('N5')).rejects.toThrow('Failed to load')
    // Retry after the failure should succeed rather than replay the cached rejection.
    const result = await loadLevelDataset('N5')
    expect(result.kanji).toEqual(n5Kanji)
    expect(kanjiCallCount).toBe(2)
  })
})

describe('loadManifest', () => {
  it('memoizes a successful manifest fetch', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(manifest)))
    vi.stubGlobal('fetch', fetchMock)

    await loadManifest()
    await loadManifest()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed manifest fetch', async () => {
    let callCount = 0
    const fetchMock = vi.fn(() => {
      callCount += 1
      return callCount === 1
        ? Promise.resolve(jsonResponse(null, false, 500))
        : Promise.resolve(jsonResponse(manifest))
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadManifest()).rejects.toThrow()
    await expect(loadManifest()).resolves.toEqual(manifest)
    expect(callCount).toBe(2)
  })
})
