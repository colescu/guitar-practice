import guitarData from '@tombatossals/chords-db/lib/guitar.json'
import { modulo, parseNoteAnswer } from '../lib/musicTheory'

type ChordsDbPosition = {
  frets: readonly number[]
  baseFret?: number
  barres?: readonly number[]
}

type ChordsDbEntry = {
  key: string
  suffix: string
  positions: readonly ChordsDbPosition[]
}

type ChordsDb = {
  keys: readonly string[]
  chords: Record<string, readonly ChordsDbEntry[]>
}

export type ChordQualityOption = {
  suffix: string
  label: string
  defaultEnabled: boolean
}

export type ChordShape = {
  id: string
  name: string
  root: string
  rootPitchClass: number
  suffix: string
  frets: readonly (number | null)[]
  barres: readonly number[]
  maxFret: number
  soundingStringCount: number
  hasOpenStrings: boolean
  hasMutedStrings: boolean
}

export type ChordToneFunction =
  | 'R'
  | 'b9'
  | '9'
  | '#9'
  | 'b3'
  | '3'
  | '4'
  | '11'
  | 'b5'
  | '#11'
  | '5'
  | '#5'
  | '6'
  | '13'
  | 'b7'
  | '7'

export type ChordShapeFilter = {
  roots?: readonly string[]
  suffixes?: readonly string[]
  maxFret?: number
  minSoundingStrings?: number
  maxPositionsPerChord?: number
  allowBarres?: boolean
  includeOpenStringShapes?: boolean
  includeMutedStringShapes?: boolean
}

type ParsedChordAnswer = {
  root: string
  rootPitchClass: number
  suffix: string
}

export const CHORD_QUALITY_OPTIONS: readonly ChordQualityOption[] = [
  { suffix: 'major', label: 'Major', defaultEnabled: true },
  { suffix: 'minor', label: 'Minor', defaultEnabled: true },
  { suffix: '7', label: '7', defaultEnabled: true },
  { suffix: 'maj7', label: 'Maj7', defaultEnabled: true },
  { suffix: 'm7', label: 'm7', defaultEnabled: true },
  { suffix: 'dim', label: 'Dim', defaultEnabled: false },
  { suffix: 'aug', label: 'Aug', defaultEnabled: false },
  { suffix: 'm7b5', label: 'm7b5', defaultEnabled: false },
  { suffix: 'sus2', label: 'Sus2', defaultEnabled: false },
  { suffix: 'sus4', label: 'Sus4', defaultEnabled: false },
  { suffix: '7sus4', label: '7sus4', defaultEnabled: false },
  { suffix: 'add9', label: 'Add9', defaultEnabled: false },
  { suffix: 'madd9', label: 'mAdd9', defaultEnabled: false },
  { suffix: '6', label: '6', defaultEnabled: false },
  { suffix: 'm6', label: 'm6', defaultEnabled: false },
  { suffix: '69', label: '6/9', defaultEnabled: false },
  { suffix: '9', label: '9', defaultEnabled: false },
  { suffix: 'm9', label: 'm9', defaultEnabled: false },
  { suffix: 'maj9', label: 'Maj9', defaultEnabled: false },
  { suffix: '13', label: '13', defaultEnabled: false },
  { suffix: 'dim7', label: 'Dim7', defaultEnabled: false },
  { suffix: 'mmaj7', label: 'mMaj7', defaultEnabled: false },
  { suffix: '7b5', label: '7b5', defaultEnabled: false },
  { suffix: 'aug7', label: '7#5', defaultEnabled: false },
  { suffix: '7b9', label: '7b9', defaultEnabled: false },
  { suffix: '7#9', label: '7#9', defaultEnabled: false },
  { suffix: 'alt', label: 'Alt', defaultEnabled: false },
]

export const DEFAULT_ENABLED_SUFFIXES = CHORD_QUALITY_OPTIONS
  .filter((option) => option.defaultEnabled)
  .map((option) => option.suffix)

const IMPORTED_SUFFIXES = CHORD_QUALITY_OPTIONS.map((option) => option.suffix)
const GUITAR_CHORDS_DB = guitarData as ChordsDb

export const ALL_IMPORTED_CHORD_SHAPES: readonly ChordShape[] = buildChordShapes()

export const DEFAULT_CHORD_FILTER: ChordShapeFilter = {
  suffixes: DEFAULT_ENABLED_SUFFIXES,
  maxFret: 12,
}

export const DEFAULT_CHORD_SHAPES = filterChordShapes(DEFAULT_CHORD_FILTER)

export function filterChordShapes(filter: ChordShapeFilter): ChordShape[] {
  const roots = filter.roots ? new Set(filter.roots) : null
  const suffixes = filter.suffixes ? new Set(filter.suffixes) : null
  const positionsPerChord = new Map<string, number>()
  const maxPositionsPerChord = filter.maxPositionsPerChord ?? Number.POSITIVE_INFINITY

  return ALL_IMPORTED_CHORD_SHAPES.filter((shape) => {
    if (roots && !roots.has(shape.root)) {
      return false
    }

    if (suffixes && !suffixes.has(shape.suffix)) {
      return false
    }

    if (filter.maxFret !== undefined && shape.maxFret > filter.maxFret) {
      return false
    }

    if (filter.minSoundingStrings !== undefined && shape.soundingStringCount < filter.minSoundingStrings) {
      return false
    }

    if (filter.allowBarres === false && shape.barres.length > 0) {
      return false
    }

    if (filter.includeOpenStringShapes === false && shape.hasOpenStrings) {
      return false
    }

    if (filter.includeMutedStringShapes === false && shape.hasMutedStrings) {
      return false
    }

    const chordKey = `${shape.root}-${shape.suffix}`
    const currentPositionCount = positionsPerChord.get(chordKey) ?? 0

    if (currentPositionCount >= maxPositionsPerChord) {
      return false
    }

    positionsPerChord.set(chordKey, currentPositionCount + 1)

    return true
  })
}

export function chordAnswerMatches(input: string, shape: ChordShape): boolean {
  const parsedAnswer = parseChordAnswer(input)

  return parsedAnswer !== null
    && parsedAnswer.rootPitchClass === shape.rootPitchClass
    && parsedAnswer.suffix === shape.suffix
}

export function chordAnswerFeedbackName(input: string, shape: ChordShape): string {
  const parsedAnswer = parseChordAnswer(input)

  if (
    parsedAnswer === null
    || parsedAnswer.rootPitchClass !== shape.rootPitchClass
    || parsedAnswer.suffix !== shape.suffix
  ) {
    return shape.name
  }

  const typedName = displayChordName(parsedAnswer.root, parsedAnswer.suffix)

  return typedName === shape.name ? shape.name : `${typedName} / ${shape.name}`
}

export function activeChordPositions(shape: ChordShape): Array<{ stringIndex: number; fret: number }> {
  return shape.frets.flatMap((fret, stringIndex) => (fret === null ? [] : [{ stringIndex, fret }]))
}

export function chordUsesPosition(shape: ChordShape, stringIndex: number, fret: number): boolean {
  return shape.frets[stringIndex] === fret
}

export function chordToneFunction(shape: ChordShape, pitchClass: number): ChordToneFunction {
  const distanceFromRoot = modulo(pitchClass - shape.rootPitchClass, 12)

  switch (distanceFromRoot) {
    case 0:
      return 'R'
    case 1:
      return 'b9'
    case 2:
      return '9'
    case 3:
      return shape.suffix.includes('#9') ? '#9' : 'b3'
    case 4:
      return '3'
    case 5:
      return shape.suffix.includes('sus4') ? '4' : '11'
    case 6:
      return shape.suffix.includes('#11') ? '#11' : 'b5'
    case 7:
      return '5'
    case 8:
      return '#5'
    case 9:
      return shape.suffix.includes('13') ? '13' : '6'
    case 10:
      return 'b7'
    case 11:
      return '7'
    default:
      throw new Error(`Unsupported chord tone distance: ${distanceFromRoot}`)
  }
}

export function chordFunctionAnswerMatches(input: string, expectedFunction: ChordToneFunction): boolean {
  const parsedFunction = canonicalChordFunction(input)

  return parsedFunction !== null
    && equivalentChordFunctions(expectedFunction).includes(parsedFunction)
}

function buildChordShapes(): ChordShape[] {
  return GUITAR_CHORDS_DB.keys.flatMap((root) => {
    const entries = GUITAR_CHORDS_DB.chords[root] ?? []

    return entries
      .filter((entry) => IMPORTED_SUFFIXES.includes(entry.suffix))
      .flatMap((entry) => entry.positions.map((position, positionIndex) => toChordShape(entry, position, positionIndex)))
  })
}

function toChordShape(entry: ChordsDbEntry, position: ChordsDbPosition, positionIndex: number): ChordShape {
  const baseFret = position.baseFret ?? 1
  const lowToHighFrets = position.frets.map((fret) => toActualFret(fret, baseFret))
  const highToLowFrets = [...lowToHighFrets].reverse()
  const frettedNotes = highToLowFrets.filter((fret): fret is number => fret !== null && fret > 0)
  const rootPitchClass = parseNoteAnswer(entry.key)

  if (rootPitchClass === null) {
    throw new Error(`Cannot parse chord root ${entry.key}`)
  }

  return {
    id: `${entry.key}-${entry.suffix}-${positionIndex}`,
    name: displayChordName(entry.key, entry.suffix),
    root: entry.key,
    rootPitchClass,
    suffix: entry.suffix,
    frets: highToLowFrets,
    barres: position.barres ?? [],
    maxFret: Math.max(0, ...frettedNotes),
    soundingStringCount: highToLowFrets.filter((fret) => fret !== null).length,
    hasOpenStrings: highToLowFrets.includes(0),
    hasMutedStrings: highToLowFrets.includes(null),
  }
}

function toActualFret(fret: number, baseFret: number): number | null {
  if (fret < 0) {
    return null
  }

  if (fret === 0) {
    return 0
  }

  return fret + baseFret - 1
}

function parseChordAnswer(input: string): ParsedChordAnswer | null {
  const normalizedAccidentals = input.trim().replace(/[♯]/g, '#').replace(/[♭]/g, 'b')
  const match = normalizedAccidentals.match(/^([A-Ga-g](?:#|b|B)?)(.*)$/)

  if (!match) {
    return null
  }

  const root = normalizeRootToken(match[1])
  const rootPitchClass = parseNoteAnswer(root)
  const suffix = canonicalSuffix(match[2])

  if (rootPitchClass === null || suffix === null) {
    return null
  }

  return { root, rootPitchClass, suffix }
}

function normalizeRootToken(input: string): string {
  const natural = input[0].toUpperCase()
  const accidental = input.slice(1)

  if (accidental === '#') {
    return `${natural}#`
  }

  if (accidental.toLowerCase() === 'b') {
    return `${natural}b`
  }

  return natural
}

function canonicalSuffix(input: string): string | null {
  const compactOriginal = input
    .trim()
    .replace(/[._\-\s]+/g, '')
    .replace(/[♭]/g, 'b')
    .replace(/[♯]/g, '#')
  const compactLower = compactOriginal.toLowerCase()

  if (compactOriginal === '') {
    return 'major'
  }

  if (compactOriginal === 'M7') {
    return 'maj7'
  }

  if (compactOriginal === 'm7') {
    return 'm7'
  }

  if (['maj', 'major'].includes(compactLower)) {
    return 'major'
  }

  if (['m', 'min', 'minor'].includes(compactLower)) {
    return 'minor'
  }

  if (['7', 'dom7', 'dominant7', 'dominantseventh'].includes(compactLower)) {
    return '7'
  }

  if (['maj7', 'major7', 'majorseventh'].includes(compactLower)) {
    return 'maj7'
  }

  if (['min7', 'minor7', 'minorseventh'].includes(compactLower)) {
    return 'm7'
  }

  if (['dim', 'diminished'].includes(compactLower)) {
    return 'dim'
  }

  if (['aug', 'augmented'].includes(compactLower)) {
    return 'aug'
  }

  if (['m7b5', 'min7b5', 'minor7b5', 'halfdim', 'halfdiminished'].includes(compactLower)) {
    return 'm7b5'
  }

  if (['sus2', 'suspended2', 'suspendedsecond'].includes(compactLower)) {
    return 'sus2'
  }

  if (['sus4', 'suspended4', 'suspendedfourth'].includes(compactLower)) {
    return 'sus4'
  }

  if (['7sus4', 'dom7sus4', 'dominant7sus4'].includes(compactLower)) {
    return '7sus4'
  }

  if (['add9', 'add2', 'added9', 'added2'].includes(compactLower)) {
    return 'add9'
  }

  if (['madd9', 'minadd9', 'minoradd9', 'madd2', 'minadd2', 'minoradd2'].includes(compactLower)) {
    return 'madd9'
  }

  if (['6', 'sixth'].includes(compactLower)) {
    return '6'
  }

  if (['m6', 'min6', 'minor6', 'minorsixth'].includes(compactLower)) {
    return 'm6'
  }

  if (['69', '6/9', 'sixnine', 'sixninechord', '6add9'].includes(compactLower)) {
    return '69'
  }

  if (['9', 'dom9', 'dominant9', 'dominantninth'].includes(compactLower)) {
    return '9'
  }

  if (['m9', 'min9', 'minor9', 'minorninth'].includes(compactLower)) {
    return 'm9'
  }

  if (['maj9', 'major9', 'majorninth'].includes(compactLower)) {
    return 'maj9'
  }

  if (['13', 'dom13', 'dominant13', 'dominantthirteenth'].includes(compactLower)) {
    return '13'
  }

  if (['dim7', 'diminished7', 'diminishedseventh'].includes(compactLower)) {
    return 'dim7'
  }

  if (
    compactOriginal === 'mM7'
    || ['mmaj7', 'mmajor7', 'minmaj7', 'minormaj7', 'minormajor7', 'minormajorseventh'].includes(compactLower)
  ) {
    return 'mmaj7'
  }

  if (['7b5', 'dom7b5', 'dominant7b5'].includes(compactLower)) {
    return '7b5'
  }

  if (['aug7', '7#5', 'dom7#5', 'dominant7#5'].includes(compactLower)) {
    return 'aug7'
  }

  if (['7b9', 'dom7b9', 'dominant7b9'].includes(compactLower)) {
    return '7b9'
  }

  if (['7#9', 'dom7#9', 'dominant7#9'].includes(compactLower)) {
    return '7#9'
  }

  if (['alt', '7alt', 'altered'].includes(compactLower)) {
    return 'alt'
  }

  return null
}

function canonicalChordFunction(input: string): ChordToneFunction | null {
  const compactOriginal = input
    .trim()
    .replace(/[♯]/g, '#')
    .replace(/[♭]/g, 'b')
    .replace(/[._\-\s]+/g, '')

  if (compactOriginal === 'R') {
    return 'R'
  }

  if (compactOriginal === 'M3') {
    return '3'
  }

  if (compactOriginal === 'M7') {
    return '7'
  }

  const compactLower = compactOriginal.toLowerCase()

  if (['r', 'root', '1'].includes(compactLower)) {
    return 'R'
  }

  if (['b3', 'm3', 'min3', 'minor3', 'minorthird', 'flat3', 'flatthird'].includes(compactLower)) {
    return 'b3'
  }

  if (['b9', 'b2', 'flat9', 'flatnine', 'flat2', 'flatsecond'].includes(compactLower)) {
    return 'b9'
  }

  if (['9', '2', 'add9', 'add2', 'maj2', 'major2', 'majorsecond'].includes(compactLower)) {
    return '9'
  }

  if (['#9', 'sharp9', 'sharpnine'].includes(compactLower)) {
    return '#9'
  }

  if (['3', 'maj3', 'major3', 'majorthird'].includes(compactLower)) {
    return '3'
  }

  if (['4', '11', 'p4', 'perfect4', 'perfectfourth', 'sus4'].includes(compactLower)) {
    return '4'
  }

  if (['5', 'p5', 'perfect5', 'perfectfifth'].includes(compactLower)) {
    return '5'
  }

  if (['b5', 'dim5', 'diminished5', 'flat5', 'flatfifth'].includes(compactLower)) {
    return 'b5'
  }

  if (['#11', '#4', 'sharp11', 'sharpeleven', 'sharp4', 'sharpfour', 'aug4', 'augmented4'].includes(compactLower)) {
    return '#11'
  }

  if (['#5', 'aug5', 'augmented5', 'sharp5', 'sharpfifth'].includes(compactLower)) {
    return '#5'
  }

  if (['6', '13', 'maj6', 'major6', 'majorsixth'].includes(compactLower)) {
    return '6'
  }

  if (['b13', 'b6', 'flat13', 'flatthirteen', 'flat6', 'flatsixth'].includes(compactLower)) {
    return '#5'
  }

  if (['b7', 'm7', 'min7', 'minor7', 'minorseventh', 'flat7', 'flatseventh'].includes(compactLower)) {
    return 'b7'
  }

  if (['7', 'maj7', 'major7', 'majorseventh'].includes(compactLower)) {
    return '7'
  }

  return null
}

function equivalentChordFunctions(expectedFunction: ChordToneFunction): readonly ChordToneFunction[] {
  switch (expectedFunction) {
    case '9':
      return ['9']
    case '4':
    case '11':
      return ['4', '11']
    case 'b5':
    case '#11':
      return ['b5', '#11']
    case '6':
    case '13':
      return ['6', '13']
    default:
      return [expectedFunction]
  }
}

function displayChordName(root: string, suffix: string): string {
  switch (suffix) {
    case 'major':
      return root
    case 'minor':
      return `${root}m`
    case '7':
      return `${root}7`
    case 'maj7':
      return `${root}maj7`
    case 'm7':
      return `${root}m7`
    case 'dim':
      return `${root}dim`
    case 'aug':
      return `${root}aug`
    case 'm7b5':
      return `${root}m7b5`
    case 'sus2':
      return `${root}sus2`
    case 'sus4':
      return `${root}sus4`
    case '7sus4':
      return `${root}7sus4`
    case 'add9':
      return `${root}add9`
    case 'madd9':
      return `${root}madd9`
    case '6':
      return `${root}6`
    case 'm6':
      return `${root}m6`
    case '69':
      return `${root}6/9`
    case '9':
      return `${root}9`
    case 'm9':
      return `${root}m9`
    case 'maj9':
      return `${root}maj9`
    case '13':
      return `${root}13`
    case 'dim7':
      return `${root}dim7`
    case 'mmaj7':
      return `${root}mMaj7`
    case '7b5':
      return `${root}7b5`
    case 'aug7':
      return `${root}7#5`
    case '7b9':
      return `${root}7b9`
    case '7#9':
      return `${root}7#9`
    case 'alt':
      return `${root}alt`
    default:
      return `${root}${suffix}`
  }
}
