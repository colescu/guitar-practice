import type { ChordShape } from '../data/chords'
import { modulo, parseIntervalAnswer, parseNoteAnswer } from './musicTheory'

export type ScaleType = 'major' | 'minor'
export type ScaleDegreeFunction =
  | '1'
  | 'b2'
  | '2'
  | '#2'
  | 'b3'
  | '3'
  | '#3'
  | '4'
  | '#4'
  | 'b5'
  | '5'
  | '#5'
  | 'b6'
  | '6'
  | '#6'
  | 'b7'
  | '7'
  | '#7'

export type ScaleChordQuizQuestion = {
  shape: ChordShape
  scaleType: ScaleType
  tonic: string
  scaleName: string
  romanNumeral: string
  scaleNotes: readonly string[]
  degreeIndex: number
}

type DiatonicDegree = {
  romanNumeral: string
  suffixes: readonly string[]
}

type ScaleChordCandidate = {
  shape: ChordShape
  tonic: string
  scaleType: ScaleType
  scaleNotes: readonly string[]
  degreeIndex: number
  romanNumeral: string
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const NATURAL_PITCH_CLASSES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

const MAJOR_SCALE_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'] as const
const MINOR_SCALE_KEYS = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D', 'G', 'C', 'F', 'Bb', 'Eb'] as const

const SCALE_INTERVALS: Record<ScaleType, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
}

const SCALE_DEGREE_BY_INTERVAL: Record<ScaleType, Record<number, ScaleDegreeFunction>> = {
  major: {
    0: '1',
    1: 'b2',
    2: '2',
    3: 'b3',
    4: '3',
    5: '4',
    6: '#4',
    7: '5',
    8: 'b6',
    9: '6',
    10: 'b7',
    11: '7',
  },
  minor: {
    0: '1',
    1: 'b2',
    2: '2',
    3: '3',
    4: '#3',
    5: '4',
    6: '#4',
    7: '5',
    8: '6',
    9: '#6',
    10: '7',
    11: '#7',
  },
}

const DIATONIC_DEGREES: Record<ScaleType, readonly DiatonicDegree[]> = {
  major: [
    { romanNumeral: 'I', suffixes: ['major', 'maj7', '6', '69', 'add9', 'maj9'] },
    { romanNumeral: 'ii', suffixes: ['minor', 'm7', 'm6', 'madd9', 'm9'] },
    { romanNumeral: 'iii', suffixes: ['minor', 'm7', 'madd9', 'm9'] },
    { romanNumeral: 'IV', suffixes: ['major', 'maj7', '6', '69', 'add9', 'maj9'] },
    { romanNumeral: 'V', suffixes: ['major', '7', '9', '13', '7sus4', '7b5', 'aug7', '7b9', '7#9', 'alt'] },
    { romanNumeral: 'vi', suffixes: ['minor', 'm7', 'madd9', 'm9'] },
    { romanNumeral: 'vii°', suffixes: ['dim', 'm7b5', 'dim7'] },
  ],
  minor: [
    { romanNumeral: 'i', suffixes: ['minor', 'm7', 'madd9', 'm9', 'mmaj7'] },
    { romanNumeral: 'ii°', suffixes: ['dim', 'm7b5', 'dim7'] },
    { romanNumeral: 'III', suffixes: ['major', 'maj7', '6', '69', 'add9', 'maj9'] },
    { romanNumeral: 'iv', suffixes: ['minor', 'm7', 'm6', 'madd9', 'm9'] },
    { romanNumeral: 'v', suffixes: ['minor', 'm7', 'madd9', 'm9'] },
    { romanNumeral: 'VI', suffixes: ['major', 'maj7', '6', '69', 'add9', 'maj9'] },
    { romanNumeral: 'VII', suffixes: ['major', '7', '9', '13', '7sus4', '7b5', 'aug7', '7b9', '7#9', 'alt'] },
  ],
}

export function createScaleChordQuizQuestion(
  shapes: readonly ChordShape[],
  random = Math.random,
): ScaleChordQuizQuestion {
  const candidates = buildScaleChordCandidates(shapes)

  if (candidates.length === 0) {
    throw new Error('Cannot create a scale chord question without diatonic chord shapes')
  }

  const candidate = pick(candidates, random)

  return toScaleChordQuizQuestion(candidate)
}

export function makeScaleChordQuizQuestion(
  shape: ChordShape,
  tonic: string,
  scaleType: ScaleType,
  degreeIndex: number,
): ScaleChordQuizQuestion {
  const scaleNotes = buildScaleNotes(tonic, scaleType)
  const degree = DIATONIC_DEGREES[scaleType][degreeIndex]
  const degreePitchClass = parseNoteAnswer(scaleNotes[degreeIndex])

  if (!degree || degreePitchClass === null) {
    throw new Error(`Invalid ${scaleType} scale degree: ${degreeIndex}`)
  }

  if (
    degreePitchClass !== shape.rootPitchClass
    || !degree.suffixes.includes(shape.suffix)
  ) {
    throw new Error(`${shape.name} is not degree ${degreeIndex + 1} in ${tonic} ${scaleType}`)
  }

  return toScaleChordQuizQuestion({
    shape,
    tonic,
    scaleType,
    scaleNotes,
    degreeIndex,
    romanNumeral: degree.romanNumeral,
  })
}

export function scaleChordQuestionCandidateCount(shapes: readonly ChordShape[]): number {
  return buildScaleChordCandidates(shapes).length
}

export function scaleDegreeFunction(
  question: ScaleChordQuizQuestion,
  pitchClass: number,
): ScaleDegreeFunction {
  const tonicPitchClass = parseNoteAnswer(question.tonic)

  if (tonicPitchClass === null) {
    throw new Error(`Invalid scale tonic: ${question.tonic}`)
  }

  const interval = modulo(pitchClass - tonicPitchClass, 12)

  return SCALE_DEGREE_BY_INTERVAL[question.scaleType][interval]
}

export function scaleDegreeAnswerMatches(
  input: string,
  expectedDegree: ScaleDegreeFunction,
  scaleType: ScaleType,
): boolean {
  const compact = input
    .trim()
    .replace(/[._\-\s]+/g, '')
  const compactLower = compact.toLowerCase()

  if (compact === expectedDegree) {
    return true
  }

  if (expectedDegree === '1' && ['r', 'root', 'tonic'].includes(compactLower)) {
    return true
  }

  const parsedScaleDegree = parseScaleDegreeToken(compact, scaleType)
  const parsedInterval = parseIntervalAnswer(input)
  const expectedInterval = scaleDegreeSemitones(expectedDegree, scaleType)

  return parsedScaleDegree === expectedInterval || parsedInterval === expectedInterval
}

export function romanAnswerMatches(
  input: string,
  expectedRomanNumeral: string,
  chordSuffix?: string,
): boolean {
  const normalizedInput = normalizeRomanAnswer(input)

  return romanAnswerVariants(expectedRomanNumeral, chordSuffix).has(normalizedInput)
}

export function buildScaleNotes(tonic: string, scaleType: ScaleType): string[] {
  const tonicPitchClass = parseNoteAnswer(tonic)

  if (tonicPitchClass === null) {
    throw new Error(`Invalid scale tonic: ${tonic}`)
  }

  const tonicLetterIndex = LETTERS.indexOf(tonic[0].toUpperCase() as (typeof LETTERS)[number])

  if (tonicLetterIndex === -1) {
    throw new Error(`Invalid tonic letter: ${tonic}`)
  }

  return SCALE_INTERVALS[scaleType].map((interval, degreeIndex) => {
    const targetPitchClass = modulo(tonicPitchClass + interval, 12)
    const targetLetter = LETTERS[(tonicLetterIndex + degreeIndex) % LETTERS.length]
    const accidentalOffset = normalizeAccidentalOffset(targetPitchClass - NATURAL_PITCH_CLASSES[targetLetter])

    return `${targetLetter}${accidentalForOffset(accidentalOffset)}`
  })
}

function buildScaleChordCandidates(shapes: readonly ChordShape[]): ScaleChordCandidate[] {
  return (['major', 'minor'] as const).flatMap((scaleType) => {
    const keys = scaleType === 'major' ? MAJOR_SCALE_KEYS : MINOR_SCALE_KEYS

    return keys.flatMap((tonic) => {
      const scaleNotes = buildScaleNotes(tonic, scaleType)
      const scalePitchClasses = scaleNotes.map((note) => {
        const pitchClass = parseNoteAnswer(note)

        if (pitchClass === null) {
          throw new Error(`Invalid scale note: ${note}`)
        }

        return pitchClass
      })

      return DIATONIC_DEGREES[scaleType].flatMap((degree, degreeIndex) =>
        shapes
          .filter((shape) =>
            scalePitchClasses[degreeIndex] === shape.rootPitchClass
              && degree.suffixes.includes(shape.suffix),
          )
          .map((shape) => ({
            shape,
            tonic,
            scaleType,
            scaleNotes,
            degreeIndex,
            romanNumeral: degree.romanNumeral,
          })),
      )
    })
  })
}

function toScaleChordQuizQuestion(candidate: ScaleChordCandidate): ScaleChordQuizQuestion {
  return {
    ...candidate,
    scaleName: `${candidate.tonic} ${candidate.scaleType}`,
  }
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]
}

function normalizeAccidentalOffset(offset: number): number {
  if (offset > 6) {
    return offset - 12
  }

  if (offset < -6) {
    return offset + 12
  }

  return offset
}

function parseScaleDegreeToken(input: string, scaleType: ScaleType): number | null {
  const normalized = input.replace(/[♯]/g, '#').replace(/[♭]/g, 'b')
  const normalizedLower = normalized.toLowerCase()

  if (['maj7', 'major7', 'majorseventh'].includes(normalizedLower)) {
    return 11
  }

  if (['#5', 'sharp5', 'sharpfifth', 'aug5', 'augmented5'].includes(normalizedLower)) {
    return 8
  }

  const match = normalized.match(/^([b#]?)([1-7])$/)

  if (!match) {
    return null
  }

  const accidental = match[1] === 'b' ? -1 : match[1] === '#' ? 1 : 0
  const degree = Number(match[2]) as 1 | 2 | 3 | 4 | 5 | 6 | 7

  return modulo(SCALE_INTERVALS[scaleType][degree - 1] + accidental, 12)
}

function scaleDegreeSemitones(degreeFunction: ScaleDegreeFunction, scaleType: ScaleType): number {
  const semitones = parseScaleDegreeToken(degreeFunction, scaleType)

  if (semitones === null) {
    throw new Error(`Invalid scale degree function: ${degreeFunction}`)
  }

  return semitones
}

function accidentalForOffset(offset: number): string {
  switch (offset) {
    case -2:
      return 'bb'
    case -1:
      return 'b'
    case 0:
      return ''
    case 1:
      return '#'
    case 2:
      return '##'
    default:
      throw new Error(`Unsupported accidental offset: ${offset}`)
  }
}

function romanAnswerVariants(expectedRomanNumeral: string, chordSuffix?: string): Set<string> {
  const expected = normalizeRomanAnswer(expectedRomanNumeral)
  const variants = new Set([expected])

  switch (chordSuffix) {
    case '6':
      variants.add(`${expected}6`)
      break
    case '69':
      variants.add(`${expected}69`)
      variants.add(`${expected}6/9`)
      break
    case '7':
      variants.add(`${expected}7`)
      break
    case '9':
      variants.add(`${expected}9`)
      break
    case '13':
      variants.add(`${expected}13`)
      break
    case 'maj7':
      variants.add(`${expected}maj7`)
      break
    case 'maj9':
      variants.add(`${expected}maj9`)
      break
    case 'm7':
      variants.add(`${expected}7`)
      variants.add(`${expected}m7`)
      break
    case 'm9':
      variants.add(`${expected}9`)
      variants.add(`${expected}m9`)
      break
    case 'm6':
      variants.add(`${expected}6`)
      variants.add(`${expected}m6`)
      break
    case 'mmaj7':
      variants.add(`${expected}mmaj7`)
      variants.add(`${expected}mmaj7`)
      variants.add(`${expected}mM7`)
      break
    case 'add9':
      variants.add(`${expected}add9`)
      break
    case 'madd9':
      variants.add(`${expected}add9`)
      variants.add(`${expected}madd9`)
      break
    case '7sus4':
      variants.add(`${expected}7sus4`)
      break
    case '7b5':
      variants.add(`${expected}7b5`)
      break
    case 'aug7':
      variants.add(`${expected}aug7`)
      variants.add(`${expected}7#5`)
      break
    case '7b9':
      variants.add(`${expected}7b9`)
      break
    case '7#9':
      variants.add(`${expected}7#9`)
      break
    case 'alt':
      variants.add(`${expected}alt`)
      variants.add(`${expected}7alt`)
      break
    case 'm7b5':
      addDiminishedVariants(variants, expected, true)
      break
    case 'dim7':
      variants.add(`${expected}7`)
      addDiminishedVariants(variants, expected, false)
      break
    case 'dim':
      addDiminishedVariants(variants, expected, false)
      break
  }

  if (expected.includes('°')) {
    addDiminishedVariants(variants, expected, chordSuffix === 'm7b5')
  }

  return new Set([...variants].map(normalizeRomanAnswer))
}

function addDiminishedVariants(variants: Set<string>, expected: string, includeHalfDiminished: boolean): void {
  const base = expected.replace(/[°ø]7?$/, '')

  variants.add(`${base}°`)
  variants.add(`${base}dim`)
  variants.add(`${base}o`)

  if (includeHalfDiminished) {
    variants.add(`${base}ø`)
    variants.add(`${base}ø7`)
    variants.add(`${base}m7b5`)
  }
}

function normalizeRomanAnswer(input: string): string {
  return input
    .trim()
    .replace(/[º˚]/g, '°')
    .replace(/[Ø]/g, 'ø')
    .replace(/[._\-\s]+/g, '')
    .replace(/M7$/, 'maj7')
    .replace(/m7b5$/i, 'ø7')
    .replace(/(?:halfdiminished|halfdim)$/i, 'ø')
    .replace(/(?:diminished|dim)7$/i, '°7')
    .replace(/(?:diminished|dim)$/i, '°')
    .replace(/[oO](?=7?$)/, '°')
}
