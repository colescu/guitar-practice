import {
  intervalBetween,
  preferredPitchClassName,
  type Interval,
} from './musicTheory'

export type GuitarString = {
  id: string
  label: string
  shortLabel: string
  openPitchClass: number
  openMidi: number
}

export type FretboardPosition = {
  stringIndex: number
  fret: number
}

export type QuizQuestion = {
  root: FretboardPosition
  target: FretboardPosition
  rootPitchClass: number
  targetPitchClass: number
  interval: Interval
}

export const MAX_FRET = 12

export const GUITAR_STRINGS: readonly GuitarString[] = [
  { id: 'high-e', label: 'High E', shortLabel: 'e', openPitchClass: 4, openMidi: 64 },
  { id: 'b', label: 'B', shortLabel: 'B', openPitchClass: 11, openMidi: 59 },
  { id: 'g', label: 'G', shortLabel: 'G', openPitchClass: 7, openMidi: 55 },
  { id: 'd', label: 'D', shortLabel: 'D', openPitchClass: 2, openMidi: 50 },
  { id: 'a', label: 'A', shortLabel: 'A', openPitchClass: 9, openMidi: 45 },
  { id: 'low-e', label: 'Low E', shortLabel: 'E', openPitchClass: 4, openMidi: 40 },
]

export function fretNumbers(maxFret = MAX_FRET): number[] {
  return Array.from({ length: maxFret + 1 }, (_, fret) => fret)
}

export function allFretboardPositions(maxFret = MAX_FRET): FretboardPosition[] {
  return GUITAR_STRINGS.flatMap((_, stringIndex) =>
    fretNumbers(maxFret).map((fret) => ({ stringIndex, fret })),
  )
}

export function positionPitchClass(position: FretboardPosition): number {
  const guitarString = GUITAR_STRINGS[position.stringIndex]

  if (!guitarString) {
    throw new Error(`Invalid string index: ${position.stringIndex}`)
  }

  return (guitarString.openPitchClass + position.fret) % 12
}

export function positionMidi(position: FretboardPosition): number {
  const guitarString = GUITAR_STRINGS[position.stringIndex]

  if (!guitarString) {
    throw new Error(`Invalid string index: ${position.stringIndex}`)
  }

  return guitarString.openMidi + position.fret
}

export function positionLabel(position: FretboardPosition): string {
  const guitarString = GUITAR_STRINGS[position.stringIndex]

  if (!guitarString) {
    throw new Error(`Invalid string index: ${position.stringIndex}`)
  }

  return `${guitarString.label}, fret ${position.fret}`
}

export function samePosition(left: FretboardPosition, right: FretboardPosition): boolean {
  return left.stringIndex === right.stringIndex && left.fret === right.fret
}

export function createQuizQuestion(maxFret = MAX_FRET, random = Math.random): QuizQuestion {
  const positions = allFretboardPositions(maxFret)
  const root = pickPosition(positions, random)
  let target = pickPosition(positions, random)

  while (samePosition(root, target)) {
    target = pickPosition(positions, random)
  }

  const rootPitchClass = positionPitchClass(root)
  const targetPitchClass = positionPitchClass(target)

  return {
    root,
    target,
    rootPitchClass,
    targetPitchClass,
    interval: intervalBetween(rootPitchClass, targetPitchClass),
  }
}

export function noteNameAt(position: FretboardPosition): string {
  return preferredPitchClassName(positionPitchClass(position))
}

function pickPosition(positions: FretboardPosition[], random: () => number): FretboardPosition {
  return positions[Math.floor(random() * positions.length)]
}
