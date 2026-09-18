#!/usr/bin/env node
/**
 * Kanji dataset importer.
 *
 * Reads KANJIDIC2 (kanji meanings/readings/JLPT/Jōyō grade - primary source)
 * and KanjiVG (stroke count, stroke order, SVG stroke data, and component
 * decomposition) and generates:
 *
 *   public/data/manifest.json       - per-bucket availability + counts, read
 *                                      by the app's runtime dataset loader
 *   public/data/quality-report.json - data-quality report (see below)
 *   public/data/<BUCKET>/kanji.json - one entry per kanji in that bucket
 *                                      (kanji, meaning, jlpt?, grade?,
 *                                      onyomi, kunyomi, components, strokes)
 *   public/data/<BUCKET>/edges.json - React Flow compatible edge list
 *                                      (source = component/parent, target =
 *                                      the kanji built from it/child); an
 *                                      edge is grouped under its target's
 *                                      bucket even if the source component
 *                                      belongs to another bucket - resolved
 *                                      at runtime (see KANJIGRAPH_PROJECT.md)
 *   public/stroke-order/*.svg       - one stroke-order SVG per kanji (raw
 *                                      KanjiVG stroke paths, styled and
 *                                      wrapped into a standalone SVG
 *                                      document), fetched lazily by the
 *                                      detail panel
 *
 * Buckets: N5, N4, N3, N2, N1 (JLPT, approximated from KANJIDIC2's legacy
 * 4-level scale - see below) plus `joyo` (the 2,136 Jōyō kanji, derived from
 * KANJIDIC2's <misc><grade> 1-8: grades 1-6 are taught in elementary school,
 * grade 8 is the remaining Jōyō kanji taught in secondary school; grades 9
 * and 10 are Jinmeiyō - name-only - kanji and are deliberately excluded).
 * Jōyō and JLPT classification overlap heavily but are not the same set:
 * some Jōyō kanji have no legacy-JLPT tag at all, and vice versa - both are
 * preserved as-is, never inferred from one another. Only buckets with at
 * least one verified kanji get a directory written; an empty bucket (N1
 * today - KANJIDIC2's legacy scale cannot distinguish old level 1's N2 vs
 * N1 kanji) is recorded in manifest.json as unavailable rather than
 * fabricated.
 *
 * `joyo/` is generated but not yet consumed by the running app (Phase 1's
 * dataset store only ever requests N5-N1) - it's prepared here for a future
 * "browse the full Jōyō set" feature.
 *
 * Usage:
 *   node scripts/import-kanji-data.mjs [options]
 *
 * Options:
 *   --levels=N5,N4       JLPT levels to include (default: N5,N4,N3,N2,N1 -
 *                         i.e. the full JLPT sweep)
 *   --no-joyo            Skip generating the joyo/ bucket
 *   --kanjidic=<path>    Local KANJIDIC2 file (.xml or .xml.gz)
 *   --kanjivg=<path>     Local KanjiVG file (.xml or .xml.gz)
 *   --out=<dir>          Output directory (default: public/data)
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
 * imprecise for the hardest tier, and no kanji can ever land in N1 from
 * this source alone). Treat generated JLPT levels as a best-effort
 * approximation, not an authoritative classification.
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
const CANONICAL_JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const JOYO_MAX_GRADE = 8

function parseArgs(argv) {
  const args = {
    levels: [...CANONICAL_JLPT_LEVELS],
    includeJoyo: true,
    out: 'public/data',
    insecure: false,
  }
  for (const arg of argv) {
    if (arg === '--insecure') {
      args.insecure = true
    } else if (arg === '--no-joyo') {
      args.includeJoyo = false
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
    const grade = entry.misc?.grade !== undefined ? Number(entry.misc.grade) : undefined

    // KANJIDIC2 allows multiple <stroke_count> entries; the first is the
    // conventional count, any others are common miscounts. Used only as a
    // fallback - KanjiVG's actual stroke-path count is the primary source
    // (see buildDataset).
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
      grade,
      strokeCount,
      onyomi,
      kunyomi,
    })
  }

  return byCharacter
}

export function isJoyo(info) {
  return info.grade !== undefined && info.grade <= JOYO_MAX_GRADE
}

const KANJIVG_ID_PATTERN = /^kvg:kanji_([0-9a-f]+)$/i
const KANJIVG_ENTRY_PATTERN = /<kanji id="kvg:kanji_([0-9a-f]+)">([\s\S]*?)<\/kanji>/g

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

  // Single pass over the raw XML text (rather than re-serializing the
  // parsed object tree, to preserve exact path data, and rather than
  // re-scanning per-character with indexOf, which doesn't scale to the full
  // ~6,700-kanji file) to capture each kanji's stroke-path markup once.
  // Reused for both the KanjiVG-derived stroke count and the stroke-order
  // SVG files.
  const strokeMarkupByCharacter = new Map()
  for (const match of rawXml.matchAll(KANJIVG_ENTRY_PATTERN)) {
    const character = String.fromCodePoint(parseInt(match[1], 16))
    strokeMarkupByCharacter.set(character, match[2].trim())
  }

  return { componentsByCharacter, strokeMarkupByCharacter }
}

export function countStrokePaths(markup) {
  return (markup.match(/<path\b/g) ?? []).length
}

function buildStrokeOrderSvg(groupMarkup) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109" width="100%" height="100%">
  <g style="fill:none;stroke:#1f2937;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;">
${groupMarkup}
  </g>
</svg>
`
}

function writeStrokeOrderSvgFiles(entries, strokeMarkupByCharacter) {
  const strokeOrderDir = path.join(ROOT_DIR, 'public', 'stroke-order')
  mkdirSync(strokeOrderDir, { recursive: true })

  let written = 0
  const missing = []
  for (const entry of entries) {
    const groupMarkup = strokeMarkupByCharacter.get(entry.kanji)
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

/** Throws on any duplicate `kanji` character - a real bug, not a data quirk. */
export function validateNoDuplicateKanji(entries, contextLabel) {
  const seen = new Set()
  const duplicatesFound = []
  for (const entry of entries) {
    if (seen.has(entry.kanji)) {
      duplicatesFound.push(entry.kanji)
    } else {
      seen.add(entry.kanji)
    }
  }
  if (duplicatesFound.length > 0) {
    throw new Error(`Duplicate kanji found in ${contextLabel}: ${duplicatesFound.join(' ')}`)
  }
  return { checked: entries.length, duplicatesFound }
}

function buildDataset({ kanjidicMap, kanjivgMap, strokeMarkupByCharacter, levels, includeJoyo }) {
  const targetCharacters = new Set()
  for (const info of kanjidicMap.values()) {
    const matchesRequestedLevel = info.jlptLevel && levels.includes(info.jlptLevel)
    const matchesJoyo = includeJoyo && isJoyo(info)
    if (matchesRequestedLevel || matchesJoyo) targetCharacters.add(info.character)
  }

  // Pull in direct components, but only ones that are themselves real,
  // classified kanji (JLPT-tagged or Jōyō). KanjiVG decomposes down to
  // Kangxi radical primitives (一, 丨, 丿, 冖, 厂, ...) that KANJIDIC2 has no
  // classification for at all - those are stroke/radical building blocks,
  // not kanji a learner studies, so they're excluded rather than defaulted
  // to a level or to Jōyō.
  let frontier = [...targetCharacters]
  const droppedComponents = new Set()
  while (frontier.length > 0) {
    const next = []
    for (const character of frontier) {
      for (const component of kanjivgMap.get(character) ?? []) {
        if (targetCharacters.has(component)) continue
        const componentInfo = kanjidicMap.get(component)
        if (componentInfo && (componentInfo.jlptLevel || isJoyo(componentInfo))) {
          targetCharacters.add(component)
          next.push(component)
        } else {
          droppedComponents.add(component)
        }
      }
    }
    frontier = next
  }

  const entries = []
  const strokeQuality = { fromKanjiVG: 0, fallbackToKanjidic2: 0, missing: [] }

  for (const character of targetCharacters) {
    const info = kanjidicMap.get(character)
    const components = (kanjivgMap.get(character) ?? []).filter((component) =>
      targetCharacters.has(component),
    )

    const markup = strokeMarkupByCharacter.get(character)
    let strokes
    if (markup) {
      strokes = countStrokePaths(markup)
      strokeQuality.fromKanjiVG += 1
    } else if (Number.isFinite(info.strokeCount)) {
      strokes = info.strokeCount
      strokeQuality.fallbackToKanjidic2 += 1
    } else {
      strokeQuality.missing.push(character)
    }

    entries.push({
      kanji: character,
      meaning: info.meaning,
      jlpt: info.jlptLevel,
      grade: info.grade,
      onyomi: info.onyomi,
      kunyomi: info.kunyomi,
      components,
      strokes,
    })
  }

  entries.sort((a, b) => a.kanji.codePointAt(0) - b.kanji.codePointAt(0))

  const duplicateCheck = validateNoDuplicateKanji(entries, 'full dataset')

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

  return { entries, edges, droppedComponents, strokeQuality, duplicateCheck }
}

function writeBucketFiles(outDir, bucketName, bucketEntries, bucketEdges) {
  const bucketDir = path.join(outDir, bucketName)
  mkdirSync(bucketDir, { recursive: true })
  writeFileSync(
    path.join(bucketDir, 'kanji.json'),
    JSON.stringify(bucketEntries, null, 2) + '\n',
  )
  writeFileSync(
    path.join(bucketDir, 'edges.json'),
    JSON.stringify(bucketEdges, null, 2) + '\n',
  )
}

/**
 * Splits the flat entries/edges into one directory per bucket (N5-N1, plus
 * joyo) and writes manifest.json describing what's actually available. A
 * kanji can appear in more than one bucket (e.g. 一 is both N5 and joyo) -
 * each bucket's kanji.json is independent, not partitioned. An edge is
 * grouped under the bucket(s) its *target* (the compound kanji it builds)
 * belongs to, even if the source component belongs to a different bucket -
 * the source may not be present in that bucket's kanji.json, and gets
 * reconciled at runtime by the dataset loader/store, not here (see
 * KANJIGRAPH_PROJECT.md's cross-level edge policy).
 */
function writeSplitDataset(entries, edges, outDir, { includeJoyo }) {
  const entryByCharacter = new Map(entries.map((entry) => [entry.kanji, entry]))

  const jlptEntries = new Map(CANONICAL_JLPT_LEVELS.map((level) => [level, []]))
  const joyoEntries = []
  for (const entry of entries) {
    if (entry.jlpt && jlptEntries.has(entry.jlpt)) jlptEntries.get(entry.jlpt).push(entry)
    if (includeJoyo && isJoyo(entry)) joyoEntries.push(entry)
  }

  const jlptEdges = new Map(CANONICAL_JLPT_LEVELS.map((level) => [level, []]))
  const joyoEdges = []
  for (const edge of edges) {
    const targetEntry = entryByCharacter.get(edge.target)
    if (!targetEntry) continue
    if (targetEntry.jlpt && jlptEdges.has(targetEntry.jlpt)) jlptEdges.get(targetEntry.jlpt).push(edge)
    if (includeJoyo && isJoyo(targetEntry)) joyoEdges.push(edge)
  }

  mkdirSync(outDir, { recursive: true })

  const manifest = {
    generatedAt: new Date().toISOString(),
    defaultLevel: 'N5',
    levels: {},
  }
  const bucketReports = {}

  for (const level of CANONICAL_JLPT_LEVELS) {
    const levelEntries = jlptEntries.get(level)
    const levelEdges = jlptEdges.get(level)
    const available = levelEntries.length > 0
    const duplicateCheck = validateNoDuplicateKanji(levelEntries, level)

    manifest.levels[level] = available
      ? { available: true, kanjiCount: levelEntries.length, edgeCount: levelEdges.length }
      : {
          available: false,
          kanjiCount: 0,
          edgeCount: 0,
          reason: 'No verified kanji currently classified at this level.',
        }
    bucketReports[level] = {
      kanjiCount: levelEntries.length,
      edgeCount: levelEdges.length,
      duplicatesFound: duplicateCheck.duplicatesFound,
    }

    if (available) writeBucketFiles(outDir, level, levelEntries, levelEdges)
  }

  if (includeJoyo) {
    const available = joyoEntries.length > 0
    const duplicateCheck = validateNoDuplicateKanji(joyoEntries, 'joyo')

    manifest.joyo = available
      ? { available: true, kanjiCount: joyoEntries.length, edgeCount: joyoEdges.length }
      : { available: false, kanjiCount: 0, edgeCount: 0, reason: 'No verified Jōyō kanji found.' }
    bucketReports.joyo = {
      kanjiCount: joyoEntries.length,
      edgeCount: joyoEdges.length,
      duplicatesFound: duplicateCheck.duplicatesFound,
    }

    if (available) writeBucketFiles(outDir, 'joyo', joyoEntries, joyoEdges)
  }

  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

  return { manifest, bucketReports }
}

export function summarizeClassification(kanjidicMap) {
  let joyoOnly = 0
  let jlptOnly = 0
  let both = 0
  for (const info of kanjidicMap.values()) {
    const joyo = isJoyo(info)
    const jlpt = Boolean(info.jlptLevel)
    if (joyo && jlpt) both += 1
    else if (joyo) joyoOnly += 1
    else if (jlpt) jlptOnly += 1
  }
  return {
    joyoOnly,
    jlptOnly,
    both,
    totalJoyo: joyoOnly + both,
    totalJlptClassified: jlptOnly + both,
    note: 'Counted across the entire KANJIDIC2 file, not just this run\'s target set - context for how much Jōyō/JLPT overlap (but don\'t fully coincide).',
  }
}

function writeQualityReport(outDir, report) {
  const reportPath = path.join(outDir, 'quality-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
  return reportPath
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
  const { componentsByCharacter: kanjivgMap, strokeMarkupByCharacter } = parseKanjivg(kanjivgPath)

  console.log(
    `Building dataset for levels: ${args.levels.join(', ')}${args.includeJoyo ? ' + joyo' : ''}`,
  )
  const { entries, edges, droppedComponents, strokeQuality, duplicateCheck } = buildDataset({
    kanjidicMap,
    kanjivgMap,
    strokeMarkupByCharacter,
    levels: args.levels,
    includeJoyo: args.includeJoyo,
  })

  const outDir = path.resolve(ROOT_DIR, args.out)
  const { manifest, bucketReports } = writeSplitDataset(entries, edges, outDir, {
    includeJoyo: args.includeJoyo,
  })

  console.log(`Wrote manifest + per-bucket datasets to ${outDir}`)
  for (const [level, info] of Object.entries(manifest.levels)) {
    console.log(
      `  ${level}: ${info.available ? `${info.kanjiCount} kanji, ${info.edgeCount} edges` : 'unavailable'}`,
    )
  }
  if (manifest.joyo) {
    console.log(
      `  joyo: ${manifest.joyo.available ? `${manifest.joyo.kanjiCount} kanji, ${manifest.joyo.edgeCount} edges` : 'unavailable'}`,
    )
  }

  if (droppedComponents.size > 0) {
    console.warn(
      `Note: excluded ${droppedComponents.size} unclassified component(s) (not JLPT- or ` +
        `Jōyō-classified): ${[...droppedComponents].join(' ')}`,
    )
  }
  if (strokeQuality.missing.length > 0) {
    console.warn(
      `Note: ${strokeQuality.missing.length} kanji had no stroke data at all (KanjiVG or ` +
        `KANJIDIC2): ${strokeQuality.missing.join(' ')}`,
    )
  }

  const report = {
    generatedAt: manifest.generatedAt,
    source: {
      kanjidic2: { path: kanjidicPath, totalCharactersParsed: kanjidicMap.size },
      kanjivg: { path: kanjivgPath, totalCharactersParsed: kanjivgMap.size },
    },
    requestedLevels: args.levels,
    includeJoyo: args.includeJoyo,
    totalUniqueKanji: entries.length,
    totalEdges: edges.length,
    buckets: bucketReports,
    classification: summarizeClassification(kanjidicMap),
    strokeSource: {
      fromKanjiVG: strokeQuality.fromKanjiVG,
      fallbackToKanjidic2: strokeQuality.fallbackToKanjidic2,
      missingCount: strokeQuality.missing.length,
      missingCharacters: strokeQuality.missing,
    },
    droppedComponents: {
      count: droppedComponents.size,
      characters: [...droppedComponents].sort(),
      note:
        'Real KanjiVG decomposition components with no JLPT tag and not Jōyō-classified in ' +
        'KANJIDIC2 - excluded rather than defaulted, per project policy of not fabricating ' +
        'classification data.',
    },
    dataCompleteness: {
      missingMeaning: entries.filter((entry) => !entry.meaning).map((entry) => entry.kanji),
      missingReadings: entries
        .filter((entry) => entry.onyomi.length === 0 && entry.kunyomi.length === 0)
        .map((entry) => entry.kanji),
    },
    duplicateValidation: {
      globalDuplicatesFound: duplicateCheck.duplicatesFound,
      perBucketDuplicatesFound: Object.fromEntries(
        Object.entries(bucketReports).map(([bucket, info]) => [bucket, info.duplicatesFound]),
      ),
    },
  }
  const reportPath = writeQualityReport(outDir, report)
  console.log(`Wrote data quality report to ${reportPath}`)

  writeStrokeOrderSvgFiles(entries, strokeMarkupByCharacter)
}

// Only auto-run when executed directly (`node import-kanji-data.mjs`), not
// when imported (e.g. by import-kanji-data.test.mjs) - importing must not
// have the side effect of downloading/parsing/writing the whole dataset.
const isMainModule =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  main()
}
