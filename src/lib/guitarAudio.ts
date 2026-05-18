import type { ChordShape } from '../data/chords'
import { positionMidi, type FretboardPosition } from './quiz'

type BrowserWindowWithAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

export type ChordPlaybackNote = FretboardPosition & {
  midi: number
  frequency: number
}

type ActiveVoice = {
  oscillator: OscillatorNode
  overtone: OscillatorNode
  voiceGain: GainNode
}

const LOW_TO_HIGH_STRING_INDICES = [5, 4, 3, 2, 1, 0] as const
const STRUM_NOTE_DELAY_SECONDS = 0.045
const NOTE_DURATION_SECONDS = 1.35
const SINGLE_NOTE_DURATION_SECONDS = 1.25
const SINGLE_NOTE_DELAY_SECONDS = 0.48
const STOP_FADE_SECONDS = 0.035

let audioContext: AudioContext | null = null
let masterGain: GainNode | null = null
let activeVoices: ActiveVoice[] = []
let playbackCompletionTimerId: number | null = null
let playbackRequestId = 0

export function chordPlaybackNotes(shape: Pick<ChordShape, 'frets'>): ChordPlaybackNote[] {
  return LOW_TO_HIGH_STRING_INDICES.flatMap((stringIndex) => {
    const fret = shape.frets[stringIndex]

    if (fret === null || fret === undefined) {
      return []
    }

    const position = { stringIndex, fret }
    const midi = positionMidi(position)

    return [{ ...position, midi, frequency: midiToFrequency(midi) }]
  })
}

export async function playChordShape(shape: Pick<ChordShape, 'frets'>): Promise<boolean> {
  const context = getAudioContext()

  if (!context) {
    return false
  }

  const requestId = beginPlaybackRequest(context)

  if (context.state === 'suspended') {
    await context.resume()
  }

  if (requestId !== playbackRequestId) {
    return false
  }

  const notes = chordPlaybackNotes(shape)
  const startTime = context.currentTime + 0.025
  const destination = getMasterGain(context)

  notes.forEach((note, index) => {
    activeVoices.push(
      playPluckedNote(
        context,
        note.frequency,
        startTime + index * STRUM_NOTE_DELAY_SECONDS,
        NOTE_DURATION_SECONDS,
        playbackGainForNote(note),
        destination,
      ),
    )
  })

  return notes.length > 0
}

export async function playChordNotesOnce(
  shape: Pick<ChordShape, 'frets'>,
  onComplete?: () => void,
): Promise<boolean> {
  const context = getAudioContext()

  if (!context) {
    return false
  }

  const requestId = beginPlaybackRequest(context)

  if (context.state === 'suspended') {
    await context.resume()
  }

  if (requestId !== playbackRequestId) {
    return false
  }

  const notes = chordPlaybackNotes(shape)

  if (notes.length === 0) {
    return false
  }

  const destination = getMasterGain(context)
  const startTime = context.currentTime + 0.025

  notes.forEach((note, index) => {
    activeVoices.push(
      playPluckedNote(
        context,
        note.frequency,
        startTime + index * SINGLE_NOTE_DELAY_SECONDS,
        SINGLE_NOTE_DURATION_SECONDS,
        playbackGainForNote(note),
        destination,
      ),
    )
  })

  if (onComplete) {
    playbackCompletionTimerId = window.setTimeout(() => {
      if (requestId === playbackRequestId) {
        onComplete()
      }
    }, ((notes.length - 1) * SINGLE_NOTE_DELAY_SECONDS + SINGLE_NOTE_DURATION_SECONDS) * 1000)
  }

  return true
}

export function stopChordPlayback(): void {
  playbackRequestId += 1
  clearPlaybackCompletion()

  if (!audioContext) {
    return
  }

  stopActiveVoices(audioContext)
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  const audioWindow = window as BrowserWindowWithAudio
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext

  if (!AudioContextConstructor) {
    return null
  }

  audioContext ??= new AudioContextConstructor()

  return audioContext
}

function getMasterGain(context: AudioContext): GainNode {
  if (!masterGain || masterGain.context !== context) {
    masterGain = context.createGain()
    masterGain.gain.value = 2
    masterGain.connect(context.destination)
  }

  return masterGain
}

function playPluckedNote(
  context: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  peakGain: number,
  destination: AudioNode,
): ActiveVoice {
  const stopTime = startTime + duration
  const sustainTime = Math.min(stopTime - 0.05, startTime + 0.2)
  const oscillator = context.createOscillator()
  const overtone = context.createOscillator()
  const overtoneGain = context.createGain()
  const filter = context.createBiquadFilter()
  const voiceGain = context.createGain()

  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(frequency, startTime)

  overtone.type = 'sine'
  overtone.frequency.setValueAtTime(frequency * 2, startTime)
  overtoneGain.gain.setValueAtTime(0.12, startTime)
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, stopTime)

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(filterFrequencyForPitch(frequency), startTime)
  filter.frequency.exponentialRampToValueAtTime(1100, stopTime)
  filter.Q.setValueAtTime(0.75, startTime)

  voiceGain.gain.setValueAtTime(0.0001, startTime)
  voiceGain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.012)
  voiceGain.gain.setValueAtTime(peakGain * 0.78, sustainTime)
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, stopTime)

  oscillator.connect(filter)
  filter.connect(voiceGain)
  overtone.connect(overtoneGain)
  overtoneGain.connect(voiceGain)
  voiceGain.connect(destination)

  oscillator.start(startTime)
  overtone.start(startTime)
  oscillator.stop(stopTime)
  overtone.stop(stopTime)

  const activeVoice = { oscillator, overtone, voiceGain }

  oscillator.onended = () => {
    activeVoices = activeVoices.filter((voice) => voice !== activeVoice)
    oscillator.disconnect()
    overtone.disconnect()
    overtoneGain.disconnect()
    filter.disconnect()
    voiceGain.disconnect()
  }

  return activeVoice
}

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

function beginPlaybackRequest(context: AudioContext): number {
  playbackRequestId += 1
  clearPlaybackCompletion()
  stopActiveVoices(context)

  return playbackRequestId
}

function playbackGainForNote(note: ChordPlaybackNote): number {
  return note.stringIndex >= 4 ? 0.3 : 0.2
}

function filterFrequencyForPitch(frequency: number): number {
  return frequency < 150 ? 4200 : 3400
}

function clearPlaybackCompletion(): void {
  if (playbackCompletionTimerId === null) {
    return
  }

  window.clearTimeout(playbackCompletionTimerId)
  playbackCompletionTimerId = null
}

function stopActiveVoices(context: AudioContext): void {
  const stopTime = context.currentTime + STOP_FADE_SECONDS

  activeVoices.forEach(({ oscillator, overtone, voiceGain }) => {
    voiceGain.gain.cancelScheduledValues(context.currentTime)
    voiceGain.gain.setValueAtTime(0.0001, context.currentTime)

    try {
      oscillator.stop(stopTime)
    } catch {
      // The voice may already have been stopped by its natural decay.
    }

    try {
      overtone.stop(stopTime)
    } catch {
      // The voice may already have been stopped by its natural decay.
    }
  })

  activeVoices = []
}
