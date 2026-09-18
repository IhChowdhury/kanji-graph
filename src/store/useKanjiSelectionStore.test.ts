import { beforeEach, describe, expect, it } from 'vitest'

import { useKanjiSelectionStore } from './useKanjiSelectionStore'
import type { KanjiInfo } from '../types/kanji'

const initialState = useKanjiSelectionStore.getState()

function kanji(character: string): KanjiInfo {
  return {
    character,
    meaning: character,
    onyomi: '',
    kunyomi: '',
    components: [],
    jlptLevel: 'N5',
    strokeCount: 1,
  }
}

beforeEach(() => {
  useKanjiSelectionStore.setState(initialState, true)
})

describe('focusKanji (plain focus: node click, search, reveal, breadcrumb nav)', () => {
  it('selects the kanji, focuses its node, and is not an expand focus', () => {
    useKanjiSelectionStore.getState().focusKanji(kanji('休'))
    const state = useKanjiSelectionStore.getState()

    expect(state.selectedKanji?.character).toBe('休')
    expect(state.focusNodeId).toBe('休')
    expect(state.isExpandFocus).toBe(false)
    expect(state.focusExtraNodeIds).toEqual([])
    expect(state.focusDurationMs).toBe(800)
  })

  it('clears a previous expand focus\'s extra ids/flag when focusing normally afterward', () => {
    useKanjiSelectionStore.getState().focusKanjiForExpand(kanji('木'), ['休'])
    useKanjiSelectionStore.getState().focusKanji(kanji('人'))
    const state = useKanjiSelectionStore.getState()

    expect(state.isExpandFocus).toBe(false)
    expect(state.focusExtraNodeIds).toEqual([])
    expect(state.focusDurationMs).toBe(800)
  })

  it('increments focusToken on every call, even for the same kanji', () => {
    const before = useKanjiSelectionStore.getState().focusToken
    useKanjiSelectionStore.getState().focusKanji(kanji('休'))
    useKanjiSelectionStore.getState().focusKanji(kanji('休'))
    expect(useKanjiSelectionStore.getState().focusToken).toBe(before + 2)
  })
})

describe('focusKanjiForExpand', () => {
  it('selects the expanded node and marks it as an expand focus with a 300-500ms duration', () => {
    useKanjiSelectionStore.getState().focusKanjiForExpand(kanji('木'), ['休', '林'])
    const state = useKanjiSelectionStore.getState()

    expect(state.selectedKanji?.character).toBe('木')
    expect(state.focusNodeId).toBe('木')
    expect(state.isExpandFocus).toBe(true)
    expect(state.focusExtraNodeIds).toEqual(['休', '林'])
    expect(state.focusDurationMs).toBeGreaterThanOrEqual(300)
    expect(state.focusDurationMs).toBeLessThanOrEqual(500)
  })

  it('is still an expand focus even when zero new nodes were added', () => {
    // e.g. expanding a parent whose only child is already visible via
    // another expanded branch - still an expand for viewport purposes.
    useKanjiSelectionStore.getState().focusKanjiForExpand(kanji('木'), [])
    const state = useKanjiSelectionStore.getState()

    expect(state.isExpandFocus).toBe(true)
    expect(state.focusExtraNodeIds).toEqual([])
  })
})
