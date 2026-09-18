import type { JlptLevel, KanjiInfo } from '../types/kanji'

/**
 * Whether `character` is currently visible per the JLPT filter - i.e. its
 * data is loaded AND its level's checkbox is enabled. Shared by every UI
 * surface that lists a kanji's relationships (detail panel's parent/child
 * chips, learning-path breadcrumbs) so none of them can expose a
 * relationship the graph itself would hide.
 */
export function isKanjiVisible(
  character: string,
  catalog: Record<string, KanjiInfo>,
  enabledLevels: Record<JlptLevel, boolean>,
): boolean {
  const info = catalog[character]
  return Boolean(info) && enabledLevels[info.jlptLevel]
}
