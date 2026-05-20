import type { ChordToneFunction } from '../data/chords'
import { NOTE_NAMES_FLAT, NOTE_NAMES_SHARP, modulo } from './musicTheory'

const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

type NoteLetter = (typeof NOTE_LETTERS)[number]

type SpelledNote = {
  name: string
  letter: NoteLetter | null
  accidentalOffset: number
}

const NATURAL_PITCH_CLASSES: Record<NoteLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

const CHORD_TONE_DEGREE_OFFSETS: Record<ChordToneFunction, number> = {
  R: 0,
  b9: 1,
  9: 1,
  '#9': 1,
  b3: 2,
  3: 2,
  4: 3,
  11: 3,
  b5: 4,
  '#11': 3,
  5: 4,
  '#5': 4,
  6: 5,
  13: 5,
  b7: 6,
  7: 6,
}

export function chooseChordNameForSpelling(chordName: string): string {
  const alternatives = chordName
    .split(/\s+\/\s+/)
    .map((candidate) => candidate.trim())
    .filter(Boolean)

  if (alternatives.length <= 1) {
    return chordName.trim()
  }

  return alternatives.reduce((best, candidate) =>
    chordNamePreferenceScore(candidate) < chordNamePreferenceScore(best) ? candidate : best,
  )
}

export function chooseChordRootForSpelling(chordName: string, fallbackRoot: string): string {
  return chordRootFromDisplayName(chooseChordNameForSpelling(chordName)) ?? fallbackRoot
}

export function chordRootFromDisplayName(chordName: string): string | null {
  const normalized = chordName.trim().replace(/[♯]/g, '#').replace(/[♭]/g, 'b')
  const match = normalized.match(/^([A-Ga-g])([#bB])?/)

  if (!match) {
    return null
  }

  return `${match[1].toUpperCase()}${match[2] === '#' ? '#' : match[2] ? 'b' : ''}`
}

export function spellChordToneName(root: string, chordTone: ChordToneFunction, pitchClass: number): string {
  return spellChordTone(root, chordTone, pitchClass).name
}

export function spellChordToneWithOctave(root: string, chordTone: ChordToneFunction, midi: number): string {
  const spelledNote = spellChordTone(root, chordTone, midi)

  if (!spelledNote.letter) {
    return `${spelledNote.name}${Math.floor(midi / 12) - 1}`
  }

  const octave = (midi - NATURAL_PITCH_CLASSES[spelledNote.letter] - spelledNote.accidentalOffset) / 12 - 1

  return `${spelledNote.name}${octave}`
}

function chordNamePreferenceScore(chordName: string): number {
  const root = chordRootFromDisplayName(chordName)

  if (!root) {
    return Number.POSITIVE_INFINITY
  }

  if (!root.includes('#') && !root.includes('b')) {
    return 0
  }

  return root.includes('#') ? 1 : 2
}

function spellChordTone(root: string, chordTone: ChordToneFunction, pitchClass: number): SpelledNote {
  const normalizedRoot = chordRootFromDisplayName(root)
  const rootLetter = normalizedRoot?.[0] as NoteLetter | undefined
  const rootLetterIndex = rootLetter ? NOTE_LETTERS.indexOf(rootLetter) : -1
  const degreeOffset = CHORD_TONE_DEGREE_OFFSETS[chordTone]

  if (!normalizedRoot || rootLetterIndex < 0 || degreeOffset === undefined) {
    return fallbackSpelling(root, pitchClass)
  }

  const targetLetter = NOTE_LETTERS[(rootLetterIndex + degreeOffset) % NOTE_LETTERS.length]
  const accidentalOffset = accidentalOffsetForPitchClass(targetLetter, pitchClass)

  if (Math.abs(accidentalOffset) > 2) {
    return fallbackSpelling(root, pitchClass)
  }

  return {
    name: `${targetLetter}${accidentalSuffix(accidentalOffset)}`,
    letter: targetLetter,
    accidentalOffset,
  }
}

function accidentalOffsetForPitchClass(letter: NoteLetter, pitchClass: number): number {
  const upwardDistance = modulo(pitchClass - NATURAL_PITCH_CLASSES[letter], 12)

  return upwardDistance <= 6 ? upwardDistance : upwardDistance - 12
}

function accidentalSuffix(accidentalOffset: number): string {
  if (accidentalOffset > 0) {
    return '#'.repeat(accidentalOffset)
  }

  if (accidentalOffset < 0) {
    return 'b'.repeat(Math.abs(accidentalOffset))
  }

  return ''
}

function fallbackSpelling(root: string, pitchClass: number): SpelledNote {
  const names = root.includes('b') ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP

  return {
    name: names[modulo(pitchClass, 12)],
    letter: null,
    accidentalOffset: 0,
  }
}
