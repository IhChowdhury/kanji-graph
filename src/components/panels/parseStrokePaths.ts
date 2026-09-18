/**
 * Extracts each stroke's path "d" data from a stroke-order SVG document, in
 * the same order KanjiVG authored them - which is the correct stroke
 * order, since each <path> is numbered kvg:<id>-s1, -s2, ... in sequence.
 *
 * Parsed as an HTML fragment (not via DOMParser's strict XML mode): the
 * generated SVGs use kvg:* attributes without declaring that namespace,
 * which a strict XML parser can reject as a well-formedness error. HTML
 * parsing is lenient about this (it's the same parsing mode
 * dangerouslySetInnerHTML uses elsewhere for this same data).
 */
export function parseStrokePaths(svgText: string): string[] {
  const template = document.createElement('template')
  template.innerHTML = svgText
  return Array.from(template.content.querySelectorAll('path'))
    .map((path) => path.getAttribute('d'))
    .filter((d): d is string => Boolean(d))
}
