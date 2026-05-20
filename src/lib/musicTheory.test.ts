import { describe, expect, it } from 'vitest'
import {
  ALL_IMPORTED_CHORD_SHAPES,
  activeChordPositions,
  chordAnswerFeedbackName,
  chordAnswerMatches,
  chordFunctionAnswerMatches,
  chordToneFunction,
  filterChordShapes,
} from '../data/chords'
import {
  intervalAnswerMatches,
  intervalBetween,
  noteAnswerMatches,
  parseIntervalAnswer,
  parseNoteAnswer,
  pitchClassNames,
} from './musicTheory'
import {
  chooseChordNameForSpelling,
  chooseChordRootForSpelling,
  spellChordToneName,
  spellChordToneWithOctave,
} from './chordSpelling'
import { createQuizQuestion, positionPitchClass, samePosition } from './quiz'
import { chordPlaybackNotes } from './guitarAudio'
import {
  makeScaleChordQuizQuestion,
  romanAnswerMatches,
  scaleDegreeAnswerMatches,
  scaleDegreeFunction,
} from './scaleRomanQuiz'

describe('music theory helpers', () => {
  it('parses enharmonic note names to the same pitch class', () => {
    expect(parseNoteAnswer('A#')).toBe(10)
    expect(parseNoteAnswer('Bb')).toBe(10)
    expect(parseNoteAnswer('B♭')).toBe(10)
    expect(noteAnswerMatches('Bb', 10)).toBe(true)
    expect(noteAnswerMatches('A#', 10)).toBe(true)
  })

  it('formats pitch classes with both accidental names when useful', () => {
    expect(pitchClassNames(0)).toBe('C')
    expect(pitchClassNames(1)).toBe('C#/Db')
  })

  it('calculates intervals from a root pitch class', () => {
    expect(intervalBetween(9, 1).name).toBe('major third')
    expect(intervalBetween(4, 2).name).toBe('minor seventh')
  })

  it('accepts common typed interval aliases', () => {
    expect(parseIntervalAnswer('M3')).toBe(4)
    expect(parseIntervalAnswer('major third')).toBe(4)
    expect(parseIntervalAnswer('3')).toBe(4)
    expect(parseIntervalAnswer('m3')).toBe(3)
    expect(parseIntervalAnswer('b3')).toBe(3)
    expect(parseIntervalAnswer('minor 3rd')).toBe(3)
    expect(intervalAnswerMatches('flat fifth', 6)).toBe(true)
  })
})

describe('fretboard quiz helpers', () => {
  it('calculates notes from string and fret positions', () => {
    expect(positionPitchClass({ stringIndex: 0, fret: 0 })).toBe(4)
    expect(positionPitchClass({ stringIndex: 1, fret: 1 })).toBe(0)
    expect(positionPitchClass({ stringIndex: 5, fret: 5 })).toBe(9)
  })

  it('orders chord playback from low string to high string', () => {
    const cMajor = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.id === 'C-major-0')

    expect(cMajor).toBeDefined()
    expect(chordPlaybackNotes(cMajor!).map((note) => note.midi)).toEqual([48, 52, 55, 60, 64])
  })

  it('creates one playback note for every played string', () => {
    for (const shape of ALL_IMPORTED_CHORD_SHAPES) {
      expect(chordPlaybackNotes(shape)).toHaveLength(activeChordPositions(shape).length)
    }
  })

  it('does not generate the same cell for root and target', () => {
    const randomValues = [0, 0, 0.5]
    const question = createQuizQuestion(12, () => randomValues.shift() ?? 0.75)

    expect(samePosition(question.root, question.target)).toBe(false)
  })
})

describe('chord shape helpers', () => {
  it('chooses a single chord spelling for answer metadata', () => {
    expect(chooseChordNameForSpelling('A#m / Bbm')).toBe('A#m')
    expect(chooseChordNameForSpelling('B# / C')).toBe('C')
    expect(chooseChordRootForSpelling('A#m / Bbm', 'Bb')).toBe('A#')
  })

  it('spells note names from their chord tone function', () => {
    expect(spellChordToneName('C', 'b3', 3)).toBe('Eb')
    expect(spellChordToneName('C', 'b7', 10)).toBe('Bb')
    expect(spellChordToneWithOctave('C', 'R', 48)).toBe('C3')
    expect(spellChordToneWithOctave('C', 'b3', 51)).toBe('Eb3')
    expect(spellChordToneWithOctave('C', 'b7', 58)).toBe('Bb3')
    expect(spellChordToneWithOctave('C', 'b3', 63)).toBe('Eb4')
  })

  it('keeps octaves correct for enharmonic chord spellings', () => {
    expect(spellChordToneWithOctave('A#', 'b3', 49)).toBe('C#3')
    expect(spellChordToneWithOctave('A#', '5', 53)).toBe('E#3')
    expect(spellChordToneWithOctave('B#', 'R', 48)).toBe('B#2')
    expect(spellChordToneWithOctave('Cb', 'R', 47)).toBe('Cb3')
  })

  it('accepts practical aliases for whole-chord answers', () => {
    const aMinor = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.root === 'A' && shape.suffix === 'minor')
    const cMajorSeven = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.root === 'C' && shape.suffix === 'maj7')
    const cAddNine = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.root === 'C' && shape.suffix === 'add9')
    const cSixNine = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.root === 'C' && shape.suffix === '69')
    const cSevenSharpNine = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.root === 'C' && shape.suffix === '7#9')

    expect(aMinor).toBeDefined()
    expect(cMajorSeven).toBeDefined()
    expect(cAddNine).toBeDefined()
    expect(cSixNine).toBeDefined()
    expect(cSevenSharpNine).toBeDefined()
    expect(chordAnswerMatches('Am', aMinor!)).toBe(true)
    expect(chordAnswerMatches('A minor', aMinor!)).toBe(true)
    expect(chordAnswerMatches('C major seventh', cMajorSeven!)).toBe(true)
    expect(chordAnswerMatches('CM7', cMajorSeven!)).toBe(true)
    expect(chordAnswerMatches('Cm7', cMajorSeven!)).toBe(false)
    expect(chordAnswerMatches('Cadd9', cAddNine!)).toBe(true)
    expect(chordAnswerMatches('C6/9', cSixNine!)).toBe(true)
    expect(chordAnswerMatches('C7#9', cSevenSharpNine!)).toBe(true)
  })

  it('preserves accepted enharmonic spelling in chord feedback', () => {
    const eFlatMajor = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.root === 'Eb' && shape.suffix === 'major')

    expect(eFlatMajor).toBeDefined()
    expect(chordAnswerMatches('D#', eFlatMajor!)).toBe(true)
    expect(chordAnswerFeedbackName('D#', eFlatMajor!)).toBe('D# / Eb')
  })

  it('maps imported open C major to the rendered high-to-low string order', () => {
    const cMajor = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.id === 'C-major-0')

    expect(cMajor).toBeDefined()
    expect(activeChordPositions(cMajor!)).toEqual([
      { stringIndex: 0, fret: 0 },
      { stringIndex: 1, fret: 1 },
      { stringIndex: 2, fret: 0 },
      { stringIndex: 3, fret: 2 },
      { stringIndex: 4, fret: 3 },
    ])
  })

  it('filters the imported chord set before quiz generation', () => {
    const majorShapes = filterChordShapes({
      suffixes: ['major'],
      maxFret: 12,
      minSoundingStrings: 4,
      maxPositionsPerChord: 1,
    })

    expect(majorShapes).toHaveLength(10)
    expect(majorShapes.every((shape) => shape.suffix === 'major')).toBe(true)
    expect(majorShapes.every((shape) => shape.maxFret <= 12)).toBe(true)
  })

  it('keeps every matching voicing when no per-chord cap is set', () => {
    const majorShapes = filterChordShapes({
      suffixes: ['major'],
      maxFret: 12,
    })

    expect(majorShapes.length).toBeGreaterThan(10)
    expect(majorShapes.every((shape) => shape.suffix === 'major')).toBe(true)
    expect(majorShapes.every((shape) => shape.maxFret <= 12)).toBe(true)
  })

  it('does not exclude compact three-note voicings unless explicitly requested', () => {
    const dimShapes = filterChordShapes({
      suffixes: ['dim'],
      maxFret: 12,
    })

    expect(dimShapes.some((shape) => shape.soundingStringCount < 4)).toBe(true)
    expect(dimShapes.every((shape) => shape.maxFret <= 12)).toBe(true)
  })

  it('computes chord functions for each played note in a shape', () => {
    const cMajor = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.id === 'C-major-0')

    expect(cMajor).toBeDefined()
    expect(
      activeChordPositions(cMajor!).map((position) =>
        chordToneFunction(cMajor!, positionPitchClass(position)),
      ),
    ).toEqual(['3', 'R', '5', '3', 'R'])
  })

  it('accepts common chord-function answer aliases', () => {
    expect(chordFunctionAnswerMatches('R', 'R')).toBe(true)
    expect(chordFunctionAnswerMatches('root', 'R')).toBe(true)
    expect(chordFunctionAnswerMatches('m3', 'b3')).toBe(true)
    expect(chordFunctionAnswerMatches('M3', '3')).toBe(true)
    expect(chordFunctionAnswerMatches('b7', 'b7')).toBe(true)
    expect(chordFunctionAnswerMatches('maj7', '7')).toBe(true)
    expect(chordFunctionAnswerMatches('2', '9')).toBe(true)
    expect(chordFunctionAnswerMatches('11', '4')).toBe(true)
    expect(chordFunctionAnswerMatches('#4', '#11')).toBe(true)
    expect(chordFunctionAnswerMatches('13', '6')).toBe(true)
  })
})

describe('scale roman numeral helpers', () => {
  it('generates major-key chord-shape functions', () => {
    const dMinor = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.root === 'D' && shape.suffix === 'minor')

    expect(dMinor).toBeDefined()

    const question = makeScaleChordQuizQuestion(dMinor!, 'C', 'major', 1)

    expect(question.scaleName).toBe('C major')
    expect(question.romanNumeral).toBe('ii')
    expect(
      new Set(activeChordPositions(dMinor!).map((position) =>
        scaleDegreeFunction(question, positionPitchClass(position)),
      )),
    ).toEqual(new Set(['2', '4', '6']))
  })

  it('generates natural-minor chord-shape functions', () => {
    const cMajor = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.root === 'C' && shape.suffix === 'major')

    expect(cMajor).toBeDefined()

    const question = makeScaleChordQuizQuestion(cMajor!, 'A', 'minor', 2)

    expect(question.scaleName).toBe('A minor')
    expect(question.romanNumeral).toBe('III')
    expect(
      new Set(activeChordPositions(cMajor!).map((position) =>
        scaleDegreeFunction(question, positionPitchClass(position)),
      )),
    ).toEqual(new Set(['3', '5', '7']))
  })

  it('accepts common roman numeral forms for scale chord functions', () => {
    expect(romanAnswerMatches('V7', 'V', '7')).toBe(true)
    expect(romanAnswerMatches('V7', 'V', 'major')).toBe(false)
    expect(romanAnswerMatches('vii°', 'vii°')).toBe(true)
    expect(romanAnswerMatches('viio', 'vii°')).toBe(true)
    expect(romanAnswerMatches('vii dim', 'vii°')).toBe(true)
    expect(romanAnswerMatches('viiø7', 'vii°', 'm7b5')).toBe(true)
  })

  it('accepts scale-degree and interval names for note functions', () => {
    expect(scaleDegreeAnswerMatches('3', '3', 'minor')).toBe(true)
    expect(scaleDegreeAnswerMatches('b3', '3', 'minor')).toBe(true)
    expect(scaleDegreeAnswerMatches('b3', '3', 'major')).toBe(false)
    expect(scaleDegreeAnswerMatches('b5', '#4', 'major')).toBe(true)
    expect(scaleDegreeAnswerMatches('maj7', '#7', 'minor')).toBe(true)
    expect(scaleDegreeAnswerMatches('root', '1', 'major')).toBe(true)
  })

  it('labels altered chord tones relative to the displayed scale', () => {
    const gSevenFlatNine = ALL_IMPORTED_CHORD_SHAPES.find((shape) => shape.root === 'G' && shape.suffix === '7b9')

    expect(gSevenFlatNine).toBeDefined()

    const question = makeScaleChordQuizQuestion(gSevenFlatNine!, 'C', 'major', 4)

    expect(question.romanNumeral).toBe('V')
    expect(
      new Set(activeChordPositions(gSevenFlatNine!).map((position) =>
        scaleDegreeFunction(question, positionPitchClass(position)),
      )),
    ).toContain('b6')
  })
})
