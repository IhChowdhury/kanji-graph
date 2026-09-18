import { describe, expect, it } from 'vitest'

import { isKanjiVisible } from './kanjiVisibility'
import type { JlptLevel, KanjiInfo } from '../types/kanji'

function kanji(character: string, jlptLevel: JlptLevel): KanjiInfo {
  return {
    character,
    meaning: character,
    onyomi: '',
    kunyomi: '',
    components: [],
    jlptLevel,
    strokeCount: 1,
  }
}

const catalog: Record<string, KanjiInfo> = {
  木: kanji('木', 'N5'),
  峠: kanji('峠', 'N2'),
}
const enabledLevels: Record<JlptLevel, boolean> = {
  N5: true,
  N4: false,
  N3: false,
  N2: false,
  N1: false,
}

describe('isKanjiVisible', () => {
  it('is visible when loaded and its level is enabled', () => {
    expect(isKanjiVisible('木', catalog, enabledLevels)).toBe(true)
  })

  it('is hidden when loaded but its level is disabled', () => {
    expect(isKanjiVisible('峠', catalog, enabledLevels)).toBe(false)
  })

  it('is hidden when not loaded at all', () => {
    expect(isKanjiVisible('missing', catalog, enabledLevels)).toBe(false)
  })
})
