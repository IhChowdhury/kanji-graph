import type { KanjiInfo } from '../../types/kanji'

export const DAILY_KANJI_COUNT = 8

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function hashStringToSeed(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return hash >>> 0
}

// Small deterministic PRNG (mulberry32) - same seed always produces the
// same sequence, so "today's list" is stable across reloads without
// needing to persist the list itself.
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items]
  const random = mulberry32(seed)
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Deterministically picks today's study list from a pool (already filtered
 * by JLPT level / mastery upstream). Same date + same pool always yields
 * the same list, so it doesn't need to be persisted separately - only
 * completion state does.
 */
export function getDailyKanji(
  pool: KanjiInfo[],
  dateKey: string,
  count: number = DAILY_KANJI_COUNT,
): KanjiInfo[] {
  const stablePool = [...pool].sort((a, b) =>
    a.character < b.character ? -1 : a.character > b.character ? 1 : 0,
  )
  const seed = hashStringToSeed(dateKey)
  return seededShuffle(stablePool, seed).slice(0, count)
}
