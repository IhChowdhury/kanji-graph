import type { DatasetManifest, JlptLevel, LevelDataset } from '../types/kanji'

// import.meta.env.BASE_URL already ends with "/" (e.g. "/" locally, or
// "/kanji-graph/" on GitHub Pages project sites - see vite.config.ts), so
// URLs are built by concatenation, never a hardcoded domain-root path.
// Exported for testing (see datasetLoader.test.ts).
export function dataUrl(...segments: string[]): string {
  return `${import.meta.env.BASE_URL}data/${segments.join('/')}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

let manifestPromise: Promise<DatasetManifest> | null = null

/**
 * Fetches manifest.json once and memoizes it for the lifetime of the page.
 * A failed fetch clears the memo so a later call can retry instead of
 * permanently caching a rejection.
 */
export function loadManifest(): Promise<DatasetManifest> {
  manifestPromise ??= fetchJson<DatasetManifest>(dataUrl('manifest.json')).catch((error) => {
    manifestPromise = null
    throw error
  })
  return manifestPromise
}

const levelCache = new Map<JlptLevel, Promise<LevelDataset>>()

/**
 * Loads one JLPT level's kanji + edges, consulting the manifest first so an
 * unavailable level (e.g. N1 today) resolves to an empty dataset without
 * ever issuing a fetch for files that don't exist. Successful loads are
 * cached for the page's lifetime (never re-fetched); failed loads are
 * evicted from the cache so a later call retries.
 */
export function loadLevelDataset(level: JlptLevel): Promise<LevelDataset> {
  const cached = levelCache.get(level)
  if (cached) return cached

  const promise = loadManifest().then(async (manifest) => {
    const entry = manifest.levels[level]
    if (!entry?.available) {
      return { kanji: [], edges: [] }
    }

    const [kanji, edges] = await Promise.all([
      fetchJson<LevelDataset['kanji']>(dataUrl(level, 'kanji.json')),
      fetchJson<LevelDataset['edges']>(dataUrl(level, 'edges.json')),
    ])
    return { kanji, edges }
  })

  levelCache.set(level, promise)
  promise.catch(() => {
    levelCache.delete(level)
  })
  return promise
}

/** Test-only escape hatch - production code never needs to clear these. */
export function clearDatasetCaches(): void {
  manifestPromise = null
  levelCache.clear()
}
