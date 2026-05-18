import { DEFAULT_CHORD_SHAPES, type ChordShape } from '../data/chords'

export type ChordQuizQuestion = {
  shape: ChordShape
}

export function createChordQuizQuestion(
  shapes: readonly ChordShape[] = DEFAULT_CHORD_SHAPES,
  random = Math.random,
): ChordQuizQuestion {
  if (shapes.length === 0) {
    throw new Error('Cannot create a chord quiz question without any chord shapes')
  }

  return {
    shape: shapes[Math.floor(random() * shapes.length)],
  }
}
