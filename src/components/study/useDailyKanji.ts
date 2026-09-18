import { useMemo } from 'react'

import { allKanji } from '../../data/kanjiCatalog'
import { useJlptFilterStore } from '../../store/useJlptFilterStore'
import { useMasteryStore } from '../../store/useMasteryStore'
import { useStudyModeStore } from '../../store/useStudyModeStore'
import type { KanjiInfo } from '../../types/kanji'
import { getDailyKanji, getTodayKey } from './dailyKanji'

interface DailyKanjiResult {
  isActive: boolean
  today: string
  dailyKanji: KanjiInfo[]
}

/**
 * Shared source of truth for "today's study list" - used by both the
 * Study Mode sidebar panel and the graph highlighting, so they never fall
 * out of sync with each other.
 */
export function useDailyKanji(): DailyKanjiResult {
  const isActive = useStudyModeStore((state) => state.isActive)
  const enabledLevels = useJlptFilterStore((state) => state.enabledLevels)
  const masteredIds = useMasteryStore((state) => state.masteredIds)
  const today = getTodayKey()

  const dailyKanji = useMemo(() => {
    if (!isActive) return []
    const pool = allKanji.filter(
      (kanji) => enabledLevels[kanji.jlptLevel] && !masteredIds[kanji.character],
    )
    return getDailyKanji(pool, today)
  }, [isActive, enabledLevels, masteredIds, today])

  return { isActive, today, dailyKanji }
}
