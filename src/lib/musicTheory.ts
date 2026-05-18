export const NOTE_NAMES_SHARP = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

export const NOTE_NAMES_FLAT = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

const NATURAL_PITCH_CLASSES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

export type Interval = {
  semitones: number
  name: string
  shortName: string
  symbolAliases: readonly string[]
  wordAliases: readonly string[]
}

export const INTERVALS: readonly Interval[] = [
  {
    semitones: 0,
    name: 'perfect unison',
    shortName: 'P1',
    symbolAliases: ['P1', '1'],
    wordAliases: ['perfect unison', 'unison', 'root', 'tonic'],
  },
  {
    semitones: 1,
    name: 'minor second',
    shortName: 'm2',
    symbolAliases: ['m2', 'b2'],
    wordAliases: ['minor second', 'minor 2', 'flat second', 'flat 2'],
  },
  {
    semitones: 2,
    name: 'major second',
    shortName: 'M2',
    symbolAliases: ['M2', '2'],
    wordAliases: ['major second', 'major 2', 'second'],
  },
  {
    semitones: 3,
    name: 'minor third',
    shortName: 'm3',
    symbolAliases: ['m3', 'b3'],
    wordAliases: ['minor third', 'minor 3', 'flat third', 'flat 3'],
  },
  {
    semitones: 4,
    name: 'major third',
    shortName: 'M3',
    symbolAliases: ['M3', '3'],
    wordAliases: ['major third', 'major 3', 'third'],
  },
  {
    semitones: 5,
    name: 'perfect fourth',
    shortName: 'P4',
    symbolAliases: ['P4', '4'],
    wordAliases: ['perfect fourth', 'perfect 4', 'fourth'],
  },
  {
    semitones: 6,
    name: 'tritone',
    shortName: 'TT',
    symbolAliases: ['TT', 'A4', 'd5', '#4', 'b5'],
    wordAliases: [
      'tritone',
      'augmented fourth',
      'augmented 4',
      'sharp fourth',
      'sharp 4',
      'diminished fifth',
      'diminished 5',
      'flat fifth',
      'flat 5',
    ],
  },
  {
    semitones: 7,
    name: 'perfect fifth',
    shortName: 'P5',
    symbolAliases: ['P5', '5'],
    wordAliases: ['perfect fifth', 'perfect 5', 'fifth'],
  },
  {
    semitones: 8,
    name: 'minor sixth',
    shortName: 'm6',
    symbolAliases: ['m6', 'b6'],
    wordAliases: ['minor sixth', 'minor 6', 'flat sixth', 'flat 6'],
  },
  {
    semitones: 9,
    name: 'major sixth',
    shortName: 'M6',
    symbolAliases: ['M6', '6'],
    wordAliases: ['major sixth', 'major 6', 'sixth'],
  },
  {
    semitones: 10,
    name: 'minor seventh',
    shortName: 'm7',
    symbolAliases: ['m7', 'b7'],
    wordAliases: ['minor seventh', 'minor 7', 'flat seventh', 'flat 7', 'dominant seventh'],
  },
  {
    semitones: 11,
    name: 'major seventh',
    shortName: 'M7',
    symbolAliases: ['M7', '7'],
    wordAliases: ['major seventh', 'major 7', 'seventh'],
  },
]

export function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

export function parseNoteAnswer(input: string): number | null {
  const cleaned = input.trim().replace(/[♯]/g, '#').replace(/[♭]/g, 'b').replace(/\s+/g, '')
  const match = cleaned.match(/^([A-Ga-g])([#bB])?$/)

  if (!match) {
    return null
  }

  const natural = match[1].toUpperCase()
  const accidental = match[2] === '#' ? 1 : match[2] ? -1 : 0

  return modulo(NATURAL_PITCH_CLASSES[natural] + accidental, 12)
}

export function noteAnswerMatches(input: string, pitchClass: number): boolean {
  return parseNoteAnswer(input) === modulo(pitchClass, 12)
}

export function pitchClassNames(pitchClass: number): string {
  const pitch = modulo(pitchClass, 12)
  const sharpName = NOTE_NAMES_SHARP[pitch]
  const flatName = NOTE_NAMES_FLAT[pitch]

  return sharpName === flatName ? sharpName : `${sharpName}/${flatName}`
}

export function preferredPitchClassName(pitchClass: number): string {
  return NOTE_NAMES_SHARP[modulo(pitchClass, 12)]
}

export function intervalFromSemitones(semitones: number): Interval {
  const pitchDistance = modulo(semitones, 12)
  const interval = INTERVALS.find((candidate) => candidate.semitones === pitchDistance)

  if (!interval) {
    throw new Error(`No interval found for ${pitchDistance} semitones`)
  }

  return interval
}

export function intervalBetween(rootPitchClass: number, targetPitchClass: number): Interval {
  return intervalFromSemitones(targetPitchClass - rootPitchClass)
}

export function parseIntervalAnswer(input: string): number | null {
  const prepared = input.trim().replace(/[♯]/g, '#').replace(/[♭]/g, 'b').replace(/[._-]+/g, ' ')
  const compactOriginal = prepared.replace(/\s+/g, '')
  const compactLower = compactOriginal.toLowerCase()
  const wordAnswer = normalizeIntervalWords(prepared)

  for (const interval of INTERVALS) {
    if (interval.symbolAliases.some((alias) => symbolAliasMatches(alias, compactOriginal, compactLower))) {
      return interval.semitones
    }

    if (interval.wordAliases.some((alias) => normalizeIntervalWords(alias) === wordAnswer)) {
      return interval.semitones
    }
  }

  return null
}

export function intervalAnswerMatches(input: string, expectedSemitones: number): boolean {
  return parseIntervalAnswer(input) === modulo(expectedSemitones, 12)
}

function symbolAliasMatches(alias: string, compactOriginal: string, compactLower: string): boolean {
  if (alias === compactOriginal) {
    return true
  }

  const startsWithQualityCaseMarker = alias.startsWith('M') || alias.startsWith('m')

  return !startsWithQualityCaseMarker && alias.toLowerCase() === compactLower
}

function normalizeIntervalWords(input: string): string {
  return input
    .replace(/[♯#]/g, ' sharp ')
    .replace(/[♭]/g, ' flat ')
    .replace(/\bb(?=\d)/gi, ' flat ')
    .replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
