export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface KanjiJsonEntry {
  kanji: string
  meaning: string
  jlpt: string
  onyomi: string[]
  kunyomi: string[]
  components: string[]
  strokes: number
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
