import { create } from 'zustand'

import { loadLevelDataset, loadManifest } from '../data/datasetLoader'
import { buildChildIndex, buildKanjiCatalog, getRootKanjiIds } from '../data/kanjiCatalog'
import {
  JLPT_LEVELS,
  type DatasetManifest,
  type JlptLevel,
  type KanjiEdgeEntry,
  type KanjiInfo,
  type KanjiJsonEntry,
} from '../types/kanji'

export const DEFAULT_JLPT_LEVEL: JlptLevel = 'N5'

export type LevelLoadStatus = 'idle' | 'loading' | 'loaded' | 'empty' | 'error'

export interface LevelState {
  status: LevelLoadStatus
  error?: string
}

function createIdleLevelStates(): Record<JlptLevel, LevelState> {
  const states = {} as Record<JlptLevel, LevelState>
  for (const level of JLPT_LEVELS) states[level] = { status: 'idle' }
  return states
}

interface DerivedCatalog {
  catalog: Record<string, KanjiInfo>
  childIndex: Record<string, string[]>
  allKanji: KanjiInfo[]
  rootKanjiIds: string[]
  mergedEdges: KanjiEdgeEntry[]
}

/**
 * Cross-level edge policy: an edge is only kept once BOTH its source and
 * target kanji are present in the merged (currently loaded) catalog. The
 * app has no placeholder/stub node concept today, so an edge referencing a
 * not-yet-loaded level would otherwise point at a node that doesn't exist.
 * Enabling that other level (which loads its data) is what makes the edge
 * appear - see KANJIGRAPH_PROJECT.md.
 */
function deriveCatalog(
  loadedEntries: Partial<Record<JlptLevel, KanjiJsonEntry[]>>,
  loadedEdges: Partial<Record<JlptLevel, KanjiEdgeEntry[]>>,
): DerivedCatalog {
  const allEntries = Object.values(loadedEntries).flatMap((entries) => entries ?? [])
  const catalog = buildKanjiCatalog(allEntries)

  const allRawEdges = Object.values(loadedEdges).flatMap((edges) => edges ?? [])
  const seenEdgeIds = new Set<string>()
  const mergedEdges: KanjiEdgeEntry[] = []
  for (const edge of allRawEdges) {
    if (seenEdgeIds.has(edge.id)) continue
    if (!catalog[edge.source] || !catalog[edge.target]) continue
    seenEdgeIds.add(edge.id)
    mergedEdges.push(edge)
  }

  return {
    catalog,
    childIndex: buildChildIndex(mergedEdges),
    allKanji: Object.values(catalog),
    rootKanjiIds: getRootKanjiIds(catalog),
    mergedEdges,
  }
}

interface KanjiDatasetState {
  manifest: DatasetManifest | null
  manifestStatus: 'idle' | 'loading' | 'loaded' | 'error'
  manifestError?: string
  levelStates: Record<JlptLevel, LevelState>
  loadedEntries: Partial<Record<JlptLevel, KanjiJsonEntry[]>>
  loadedEdges: Partial<Record<JlptLevel, KanjiEdgeEntry[]>>

  catalog: Record<string, KanjiInfo>
  childIndex: Record<string, string[]>
  allKanji: KanjiInfo[]
  rootKanjiIds: string[]
  mergedEdges: KanjiEdgeEntry[]

  /** Loads the manifest, then the default level. Safe to call more than once. */
  initialize: () => Promise<void>
  /** Idempotent: a level already loading/loaded/empty is never re-fetched. */
  ensureLevelLoaded: (level: JlptLevel) => Promise<void>
  getKanjiInfo: (character: string) => KanjiInfo | undefined
  getChildKanji: (character: string) => KanjiInfo[]
  hasChildKanji: (character: string) => boolean
}

export const useKanjiDatasetStore = create<KanjiDatasetState>((set, get) => ({
  manifest: null,
  manifestStatus: 'idle',
  levelStates: createIdleLevelStates(),
  loadedEntries: {},
  loadedEdges: {},
  catalog: {},
  childIndex: {},
  allKanji: [],
  rootKanjiIds: [],
  mergedEdges: [],

  initialize: async () => {
    if (get().manifestStatus === 'loading' || get().manifestStatus === 'loaded') {
      await get().ensureLevelLoaded(DEFAULT_JLPT_LEVEL)
      return
    }

    set({ manifestStatus: 'loading', manifestError: undefined })
    try {
      const manifest = await loadManifest()
      set({ manifest, manifestStatus: 'loaded' })
    } catch (error) {
      set({ manifestStatus: 'error', manifestError: (error as Error).message })
      return
    }

    await get().ensureLevelLoaded(DEFAULT_JLPT_LEVEL)
  },

  ensureLevelLoaded: async (level) => {
    const currentStatus = get().levelStates[level].status
    if (currentStatus === 'loading' || currentStatus === 'loaded' || currentStatus === 'empty') {
      return
    }

    set((state) => ({
      levelStates: { ...state.levelStates, [level]: { status: 'loading' } },
    }))

    try {
      const { kanji, edges } = await loadLevelDataset(level)
      const status: LevelLoadStatus = kanji.length === 0 ? 'empty' : 'loaded'

      set((state) => {
        const loadedEntries = { ...state.loadedEntries, [level]: kanji }
        const loadedEdges = { ...state.loadedEdges, [level]: edges }
        return {
          loadedEntries,
          loadedEdges,
          levelStates: { ...state.levelStates, [level]: { status } },
          ...deriveCatalog(loadedEntries, loadedEdges),
        }
      })
    } catch (error) {
      set((state) => ({
        levelStates: {
          ...state.levelStates,
          [level]: { status: 'error', error: (error as Error).message },
        },
      }))
    }
  },

  getKanjiInfo: (character) => get().catalog[character],

  getChildKanji: (character) =>
    (get().childIndex[character] ?? [])
      .map((id) => get().catalog[id])
      .filter((info): info is KanjiInfo => Boolean(info)),

  hasChildKanji: (character) => (get().childIndex[character]?.length ?? 0) > 0,
}))
