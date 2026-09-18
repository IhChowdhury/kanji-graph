#!/usr/bin/env node
/**
 * Kanji dataset importer.
 *
 * Reads KANJIDIC2 (kanji meanings/readings/JLPT) and KanjiVG (stroke-order
 * SVG data, used here purely for its component decomposition) and generates:
 *
 *   src/data/kanji.json          - one entry per kanji (kanji, meaning, jlpt,
 *                                   onyomi, kunyomi, components, strokes)
 *   src/data/edges.json          - React Flow compatible edge list derived
 *                                   from the component relationships
 *                                   (source = component, target = the
 *                                   kanji built from it)
 *   public/stroke-order/*.svg    - one stroke-order SVG per kanji (raw
 *                                   KanjiVG stroke paths, styled and
 *                                   wrapped into a standalone SVG document),
 *                                   fetched lazily by the detail panel
 *
 * Usage:
 *   node scripts/import-kanji-data.mjs [options]
 *
 * Options:
 *   --levels=N5,N4       JLPT levels to include (default: N5)
 *   --kanjidic=<path>    Local KANJIDIC2 file (.xml or .xml.gz)
 *   --kanjivg=<path>     Local KanjiVG file (.xml or .xml.gz)
 *   --out=<dir>          Output directory (default: src/data)
 *   --insecure           Skip TLS verification when downloading (only for
 *                         networks with an SSL-inspecting proxy; do not use
 *                         this by default)
 *
 * If --kanjidic/--kanjivg are omitted, the script tries to download the
 * files itself (KANJIDIC2 from EDRDG, KanjiVG from its latest GitHub
 * release) into scripts/downloads/ and uses those.
 *
 * JLPT levels: KANJIDIC2 only carries the *old* 4-level JLPT scale (1-4,
 * pre-2010), not the current N5-N1 scale, and there is no official kanji
 * list for the new scale. This script uses the widely-used approximation
 * old 4 -> N5, old 3 -> N4, old 2 -> N3, old 1 -> N2 (old level 1 spanned
 * what is now split across N2 and N1, so that mapping is inherently
 * imprecise for the hardest tier). Treat generated JLPT levels as a
 * best-effort approximation, not an authoritative classification.
 */

import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { XMLParser } from 'fast-xml-parser'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const DOWNLOADS_DIR = path.join(__dirname, 'downloads')

const KANJIDIC2_URL = 'http://www.edrdg.org/kanjidic/kanjidic2.xml.gz'
const KANJIVG_RELEASES_API = 'https://api.github.com/repos/KanjiVG/kanjivg/releases/latest'

const OLD_JLPT_TO_NEW = { 4: 'N5', 3: 'N4', 2: 'N3', 1: 'N2' }

function parseArgs(argv) {
  const args = { levels: ['N5'], out: 'src/data', insecure: false }
  for (const arg of argv) {
    if (arg === '--insecure') {
      args.insecure = true
    } else if (arg.startsWith('--levels=')) {
      args.levels = arg
        .slice('--levels='.length)
        .split(',')
        .map((level) => level.trim().toUpperCase())
        .filter(Boolean)
    } else if (arg.startsWith('--kanjidic=')) {
      args.kanjidic = arg.slice('--kanjidic='.length)
    } else if (arg.startsWith('--kanjivg=')) {
      args.kanjivg = arg.slice('--kanjivg='.length)
    } else if (arg.startsWith('--out=')) {
      args.out = arg.slice('--out='.length)
    } else if (arg === '--help' || arg === '-h') {
      console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0])
      process.exit(0)
    }
  }
  return args
}

function download(url, destination, insecure) {
  mkdirSync(path.dirname(destination), { recursive: true })
  const curlArgs = ['-sSL', '--fail', '--retry', '3', '-o', destination, url]
  if (insecure) curlArgs.unshift('-k')
  console.log(`Downloading ${url}`)
  execFileSync('curl', curlArgs, { stdio: 'inherit' })
}

function resolveKanjivgAssetUrl(insecure) {
  const curlArgs = ['-sSL', '--fail']
  if (insecure) curlArgs.unshift('-k')
  const json = execFileSync('curl', [...curlArgs, KANJIVG_RELEASES_API], {
    encoding: 'utf8',
  })
  const release = JSON.parse(json)
  const asset = (release.assets ?? []).find((candidate) =>
    /\.xml\.gz$/i.test(candidate.name),
  )
  if (!asset) {
    throw new Error(
      'Could not find a .xml.gz asset on the latest KanjiVG release. ' +
        'Download it manually and pass --kanjivg=<path>.',
    )
  }
  return asset.browser_download_url
}

function ensureSourceFile(kind, explicitPath, url, insecure) {
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      throw new Error(`${kind} file not found: ${explicitPath}`)
    }
    return explicitPath
  }

  const extension = kind === 'KANJIDIC2' ? 'kanjidic2.xml.gz' : 'kanjivg.xml.gz'
  const cached = path.join(DOWNLOADS_DIR, extension)
  if (existsSync(cached)) return cached

  const resolvedUrl = typeof url === 'function' ? url(insecure) : url
  download(resolvedUrl, cached, insecure)
  return cached
}

function readXmlFile(filePath) {
  const raw = readFileSync(filePath)
  const xml = filePath.endsWith('.gz') ? gunzipSync(raw) : raw
  return xml.toString('utf8')
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) =>
    [
      'character',
      'rmgroup',
      'reading',
      'meaning',
      'cp_value',
      'stroke_count',
      'kanji',
      'g',
    ].includes(name),
})

function toArray(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function parseKanjidic2(filePath) {
  const doc = xmlParser.parse(readXmlFile(filePath))
  const characters = toArray(doc.kanjidic2?.character)
  const byCharacter = new Map()

  for (const entry of characters) {
    const literal = entry.literal
    if (!literal) continue

    const oldJlpt = entry.misc?.jlpt ? Number(entry.misc.jlpt) : undefined
    const jlptLevel = oldJlpt ? OLD_JLPT_TO_NEW[oldJlpt] : undefined

    // KANJIDIC2 allows multiple <stroke_count> entries; the first is the
    // conventional count, any others are common miscounts.
    const strokeCount = Number(toArray(entry.misc?.stroke_count)[0])

    const rmgroups = toArray(entry.reading_meaning?.rmgroup)
    const meanings = []
    const onyomi = []
    const kunyomi = []

    for (const group of rmgroups) {
      for (const meaning of toArray(group.meaning)) {
        if (typeof meaning === 'string') {
          meanings.push(meaning)
        } else if (!meaning['@_m_lang'] || meaning['@_m_lang'] === 'en') {
          meanings.push(meaning['#text'])
        }
      }
      for (const reading of toArray(group.reading)) {
        const text = reading['#text']
        // Leading/trailing "-" marks a compound-only fragment (e.g. "-り" in
        // 二人 ふたり), not a standalone reading, so skip those entirely.
        if (typeof text !== 'string' || text.includes('-')) continue

        if (reading['@_r_type'] === 'ja_on') {
          onyomi.push(text)
        } else if (reading['@_r_type'] === 'ja_kun') {
          // "." separates the kanji-read root from its okurigana suffix
          // (e.g. "やす.む" -> the word is written 休む); join them back
          // into the full reading rather than truncating at the dot.
          kunyomi.push(text.replace('.', ''))
        }
      }
    }

    byCharacter.set(literal, {
      character: literal,
      meaning: meanings[0] ?? '',
      jlptLevel,
      strokeCount,
      onyomi,
      kunyomi,
    })
  }

  return byCharacter
}

const KANJIVG_ID_PATTERN = /^kvg:kanji_([0-9a-f]+)$/i

function parseKanjivg(filePath) {
  const rawXml = readXmlFile(filePath)
  const doc = xmlParser.parse(rawXml)
  const kanjiEntries = toArray(doc.kanjivg?.kanji)
  const componentsByCharacter = new Map()

  for (const entry of kanjiEntries) {
    const id = entry['@_id']
    const match = typeof id === 'string' ? id.match(KANJIVG_ID_PATTERN) : null
    if (!match) continue

    const character = String.fromCodePoint(parseInt(match[1], 16))
    const rootGroup = toArray(entry.g)[0]
    if (!rootGroup) continue

    const componentSet = new Set()
    for (const child of toArray(rootGroup.g)) {
      const element = child['@_kvg:element']
      if (!element) continue
      const component = child['@_kvg:original'] || element
      if (component !== character) componentSet.add(component)
    }

    componentsByCharacter.set(character, [...componentSet])
  }

  return { componentsByCharacter, rawXml }
}

function codepointHex(character) {
  return character.codePointAt(0).toString(16).padStart(5, '0')
}

/**
 * Pulls the raw <g id="kvg:XXXX" kvg:element="...">...</g> stroke-path
 * markup for one kanji straight out of the source XML text (rather than
 * re-serializing the parsed object tree), so the original path data is
 * preserved exactly as KanjiVG authored it.
 */
function extractStrokeGroupMarkup(rawXml, character) {
  const openTag = `<kanji id="kvg:kanji_${codepointHex(character)}">`
  const startIdx = rawXml.indexOf(openTag)
  if (startIdx === -1) return null

  const contentStart = startIdx + openTag.length
  const endIdx = rawXml.indexOf('</kanji>', contentStart)
  if (endIdx === -1) return null

  return rawXml.slice(contentStart, endIdx).trim()
}

function buildStrokeOrderSvg(groupMarkup) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109" width="100%" height="100%">
  <g style="fill:none;stroke:#1f2937;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;">
${groupMarkup}
  </g>
</svg>
`
}

function writeStrokeOrderSvgFiles(entries, kanjivgRawXml) {
  const strokeOrderDir = path.join(ROOT_DIR, 'public', 'stroke-order')
  mkdirSync(strokeOrderDir, { recursive: true })

  let written = 0
  const missing = []
  for (const entry of entries) {
    const groupMarkup = extractStrokeGroupMarkup(kanjivgRawXml, entry.kanji)
    if (!groupMarkup) {
      missing.push(entry.kanji)
      continue
    }
    writeFileSync(
      path.join(strokeOrderDir, `${entry.kanji}.svg`),
      buildStrokeOrderSvg(groupMarkup),
    )
    written += 1
  }

  console.log(`Wrote ${written}/${entries.length} stroke order SVGs to ${strokeOrderDir}`)
  if (missing.length > 0) {
    console.warn(`Note: no stroke data found for: ${missing.join(' ')}`)
  }
}

function buildDataset({ kanjidicMap, kanjivgMap, levels }) {
  const targetCharacters = new Set()
  for (const info of kanjidicMap.values()) {
    if (info.jlptLevel && levels.includes(info.jlptLevel)) {
      targetCharacters.add(info.character)
    }
  }

  // Pull in direct components, but only ones that are themselves real,
  // JLPT-classified kanji. KanjiVG decomposes down to Kangxi radical
  // primitives (一, 丨, 丿, 冖, 厂, ...) that KANJIDIC2 has no JLPT data for -
  // those are stroke/radical building blocks, not kanji a learner studies,
  // so they're excluded rather than defaulted to a level.
  let frontier = [...targetCharacters]
  const droppedRadicals = new Set()
  while (frontier.length > 0) {
    const next = []
    for (const character of frontier) {
      for (const component of kanjivgMap.get(character) ?? []) {
        if (targetCharacters.has(component)) continue
        if (kanjidicMap.get(component)?.jlptLevel) {
          targetCharacters.add(component)
          next.push(component)
        } else {
          droppedRadicals.add(component)
        }
      }
    }
    frontier = next
  }

  const entries = []

  for (const character of targetCharacters) {
    const info = kanjidicMap.get(character)
    const components = (kanjivgMap.get(character) ?? []).filter((component) =>
      targetCharacters.has(component),
    )

    entries.push({
      kanji: character,
      meaning: info.meaning,
      jlpt: info.jlptLevel,
      onyomi: info.onyomi,
      kunyomi: info.kunyomi,
      components,
      strokes: info.strokeCount,
    })
  }

  entries.sort(
    (a, b) => a.kanji.codePointAt(0) - b.kanji.codePointAt(0),
  )

  if (droppedRadicals.size > 0) {
    console.warn(
      `Note: excluded ${droppedRadicals.size} unclassified radical/primitive ` +
        `components (not real JLPT kanji): ${[...droppedRadicals].join(' ')}`,
    )
  }

  const edges = []
  const edgeIds = new Set()
  for (const entry of entries) {
    for (const component of entry.components) {
      const id = `${component}->${entry.kanji}`
      if (edgeIds.has(id)) continue
      edgeIds.add(id)
      edges.push({ id, source: component, target: entry.kanji })
    }
  }

  return { entries, edges }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  const kanjidicPath = ensureSourceFile(
    'KANJIDIC2',
    args.kanjidic,
    KANJIDIC2_URL,
    args.insecure,
  )
  const kanjivgPath = ensureSourceFile(
    'KanjiVG',
    args.kanjivg,
    () => resolveKanjivgAssetUrl(args.insecure),
    args.insecure,
  )

  console.log(`Parsing ${kanjidicPath}`)
  const kanjidicMap = parseKanjidic2(kanjidicPath)
  console.log(`Parsing ${kanjivgPath}`)
  const { componentsByCharacter: kanjivgMap, rawXml: kanjivgRawXml } =
    parseKanjivg(kanjivgPath)

  console.log(`Building dataset for levels: ${args.levels.join(', ')}`)
  const { entries, edges } = buildDataset({
    kanjidicMap,
    kanjivgMap,
    levels: args.levels,
  })

  const outDir = path.resolve(ROOT_DIR, args.out)
  mkdirSync(outDir, { recursive: true })

  const kanjiJsonPath = path.join(outDir, 'kanji.json')
  const edgesJsonPath = path.join(outDir, 'edges.json')

  writeFileSync(kanjiJsonPath, JSON.stringify(entries, null, 2) + '\n')
  writeFileSync(edgesJsonPath, JSON.stringify(edges, null, 2) + '\n')

  console.log(`Wrote ${entries.length} kanji to ${kanjiJsonPath}`)
  console.log(`Wrote ${edges.length} edges to ${edgesJsonPath}`)

  writeStrokeOrderSvgFiles(entries, kanjivgRawXml)
}

main()
