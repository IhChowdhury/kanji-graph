export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

// Canonical level ordering, shared by the filter store and the dataset
// store - lives here (not in a store) so both can import it without
// creating a store-to-store circular dependency.
export const JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

export interface KanjiJsonEntry {
  kanji: string
  meaning: string
  // Optional: a kanji can be Jōyō-classified (see `grade`) without ever
  // having carried a legacy-JLPT tag in KANJIDIC2, or vice versa - the
  // app's own N5-N1 bucket files always have this set (see
  // useKanjiDatasetStore's cross-level policy), but the on-disk schema as a
  // whole (including public/data/joyo/) does not guarantee it.
  jlpt?: string
  // Jōyō school grade (1-6 = elementary, 8 = remaining Jōyō taught in
  // secondary school) - only present for Jōyō-classified kanji. Not read by
  // the running app today; kept for transparency/future use (see
  // scripts/import-kanji-data.mjs).
  grade?: number
  onyomi: string[]
  kunyomi: string[]
  components: string[]
  strokes: number
}

export interface KanjiEdgeEntry {
  id: string
  source: string
  target: string
}

export interface LevelManifestEntry {
  available: boolean
  kanjiCount: number
  edgeCount: number
  reason?: string
}

export interface DatasetManifest {
  generatedAt: string
  defaultLevel: JlptLevel
  levels: Record<JlptLevel, LevelManifestEntry>
  // The full 2,136-kanji Jōyō set, generated alongside the JLPT levels but
  // not yet loaded/consumed anywhere at runtime - see KANJIGRAPH_PROJECT.md.
  joyo?: LevelManifestEntry
}

export interface LevelDataset {
  kanji: KanjiJsonEntry[]
  edges: KanjiEdgeEntry[]
}

export interface KanjiInfo {
  character: string
  meaning: string
  onyomi: string
  kunyomi: string
  components: string[]
  jlptLevel: JlptLevel
  strokeCount: number
}

export type KanjiNodeData = KanjiInfo
