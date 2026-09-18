import { describe, expect, it } from 'vitest'

import {
  countStrokePaths,
  isJoyo,
  summarizeClassification,
  validateNoDuplicateKanji,
} from './import-kanji-data.mjs'

// Importing the module must not trigger main() (no download/parse/write
// side effects) - see the isMainModule guard at the bottom of the script.
// If it did, these tests would hang or fail well before reaching an assertion.

describe('isJoyo', () => {
  it('treats grades 1-6 (elementary) and 8 (secondary Jōyō) as Jōyō', () => {
    expect(isJoyo({ grade: 1 })).toBe(true)
    expect(isJoyo({ grade: 6 })).toBe(true)
    expect(isJoyo({ grade: 8 })).toBe(true)
  })

  it('excludes Jinmeiyō grades (9, 10) and ungraded kanji', () => {
    expect(isJoyo({ grade: 9 })).toBe(false)
    expect(isJoyo({ grade: 10 })).toBe(false)
    expect(isJoyo({ grade: undefined })).toBe(false)
  })
})

describe('countStrokePaths', () => {
  it('counts <path elements in KanjiVG markup (real 休 fragment, 6 strokes)', () => {
    const markup = `
<g id="kvg:04f11" kvg:element="休">
  <g id="kvg:04f11-g1" kvg:element="人">
    <path id="kvg:04f11-s1" d="M1,1"/>
    <path id="kvg:04f11-s2" d="M2,2"/>
  </g>
  <g id="kvg:04f11-g2" kvg:element="木">
    <path id="kvg:04f11-s3" d="M3,3"/>
    <path id="kvg:04f11-s4" d="M4,4"/>
    <path id="kvg:04f11-s5" d="M5,5"/>
    <path id="kvg:04f11-s6" d="M6,6"/>
  </g>
</g>`
    expect(countStrokePaths(markup)).toBe(6)
  })

  it('returns 0 for markup with no strokes', () => {
    expect(countStrokePaths('<g></g>')).toBe(0)
  })
})

describe('validateNoDuplicateKanji', () => {
  it('passes silently for a duplicate-free entry list', () => {
    const result = validateNoDuplicateKanji([{ kanji: '一' }, { kanji: '七' }], 'test')
    expect(result).toEqual({ checked: 2, duplicatesFound: [] })
  })

  it('throws on a duplicate kanji character', () => {
    expect(() =>
      validateNoDuplicateKanji([{ kanji: '一' }, { kanji: '一' }], 'test-bucket'),
    ).toThrow('Duplicate kanji found in test-bucket: 一')
  })
})

describe('summarizeClassification', () => {
  it('buckets kanji into joyo-only, jlpt-only, and both', () => {
    const kanjidicMap = new Map([
      ['一', { grade: 1, jlptLevel: 'N5' }], // both
      ['串', { grade: 8, jlptLevel: undefined }], // joyo-only
      ['丁', { grade: undefined, jlptLevel: 'N2' }], // jlpt-only
      ['龍', { grade: 9, jlptLevel: undefined }], // neither (jinmeiyou)
    ])
    const summary = summarizeClassification(kanjidicMap)
    expect(summary.both).toBe(1)
    expect(summary.joyoOnly).toBe(1)
    expect(summary.jlptOnly).toBe(1)
    expect(summary.totalJoyo).toBe(2)
    expect(summary.totalJlptClassified).toBe(2)
  })
})
