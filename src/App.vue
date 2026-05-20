<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  CHORD_QUALITY_OPTIONS,
  DEFAULT_CHORD_FILTER,
  DEFAULT_ENABLED_SUFFIXES,
  chordAnswerFeedbackName,
  chordAnswerMatches,
  chordFunctionAnswerMatches,
  chordToneFunction,
  chordUsesPosition,
  filterChordShapes,
  activeChordPositions,
  type ChordShape,
  type ChordToneFunction,
} from './data/chords'
import { createChordQuizQuestion, type ChordQuizQuestion } from './lib/chordQuiz'
import { fretNumbers, GUITAR_STRINGS, positionMidi, positionPitchClass, type FretboardPosition } from './lib/quiz'
import {
  createScaleChordQuizQuestion,
  romanAnswerMatches,
  scaleChordQuestionCandidateCount,
  scaleDegreeAnswerMatches,
  scaleDegreeFunction,
  type ScaleChordQuizQuestion,
  type ScaleDegreeFunction,
} from './lib/scaleRomanQuiz'
import { pitchClassNames } from './lib/musicTheory'
import { playChordNotesOnce, playChordShape, stopChordPlayback } from './lib/guitarAudio'

type PracticeMode = 'chord-shapes' | 'chord-recognition' | 'scale-functions'
type FunctionAnswer = ChordToneFunction | ScaleDegreeFunction
type PlaybackState = 'ready' | 'strummed' | 'single-notes'

type CheckResult = {
  correct: boolean
  chordCorrect: boolean
  functionsCorrect: boolean
  incorrectFunctionKeys: readonly string[]
  revealed: boolean
}

const CHORD_FILTER_STORAGE_KEY = 'guitar-practice:selected-suffixes'
const PRACTICE_MODE_STORAGE_KEY = 'guitar-practice:practice-mode'
const frets = fretNumbers()
  .filter((fret) => fret > 0)
const selectedSuffixes = ref(loadSelectedSuffixes())
const practiceMode = ref<PracticeMode>(loadPracticeMode(selectedSuffixes.value))
const availableShapes = computed(() =>
  shapesForSuffixes(selectedSuffixes.value),
)
const question = ref<ChordQuizQuestion>(createChordQuizQuestion(availableShapes.value))
const scaleQuestion = ref<ScaleChordQuizQuestion>(createScaleQuestionForShapes(availableShapes.value))
const primaryAnswer = ref('')
const functionAnswers = ref<Record<string, string>>(blankFunctionAnswersForShape(question.value.shape))
const result = ref<CheckResult | null>(null)
const showFretboardSnapshot = ref(false)
const playbackState = ref<PlaybackState>('ready')
const stats = reactive({
  attempts: 0,
  correct: 0,
  streak: 0,
})

const activeShape = computed(() =>
  practiceMode.value === 'scale-functions'
    ? scaleQuestion.value.shape
    : question.value.shape,
)
const playedPositions = computed(() => activeChordPositions(activeShape.value))
const playedPositionsLowToHigh = computed(() =>
  [...playedPositions.value].sort((left, right) => right.stringIndex - left.stringIndex),
)
const requiresFunctionLabels = computed(() => practiceMode.value !== 'chord-recognition')
const canSubmit = computed(() =>
  primaryAnswer.value.trim() !== ''
    && (
      !requiresFunctionLabels.value
      || playedPositions.value.every((position) => functionAnswers.value[positionKey(position)]?.trim())
    ),
)
const accuracy = computed(() => (stats.attempts === 0 ? 0 : Math.round((stats.correct / stats.attempts) * 100)))
const scaleCandidateCount = computed(() => scaleChordQuestionCandidateCount(availableShapes.value))
const canUseScaleFunctions = computed(() => scaleCandidateCount.value > 0)
const activeShapeCount = computed(() => availableShapes.value.length)
const modeLabel = computed(() => {
  switch (practiceMode.value) {
    case 'chord-recognition':
      return 'Chord recognition quiz'
    case 'scale-functions':
      return 'Scale function quiz'
    case 'chord-shapes':
      return 'Chord shape quiz'
  }
})
const questionTitle = computed(() =>
  {
    switch (practiceMode.value) {
      case 'chord-recognition':
        return 'Name the chord from the shape'
      case 'scale-functions':
        return 'Given the scale, identify the chord function and label every played note'
      case 'chord-shapes':
        return 'Name the chord and label every played note'
    }
  },
)
const answerLabel = computed(() => (practiceMode.value === 'scale-functions' ? 'Roman numeral' : 'Chord name'))
const answerPlaceholder = computed(() => (practiceMode.value === 'scale-functions' ? 'ii' : 'Am7'))
const expectedFunctionLabel = computed(() => (practiceMode.value === 'scale-functions' ? 'Scale degrees' : 'Functions'))
const expectedFunctionSummary = computed(() =>
  playedPositionsLowToHigh.value
    .map((position) => expectedFunctionForPosition(position))
    .join('  '),
)
const feedbackChordName = computed(() =>
  result.value?.chordCorrect
    ? chordAnswerFeedbackName(primaryAnswer.value, question.value.shape)
    : question.value.shape.name,
)
const metadataChordName = computed(() =>
  practiceMode.value === 'scale-functions'
    ? activeShape.value.name
    : feedbackChordName.value,
)
const chordToneSummary = computed(() =>
  playedPositionsLowToHigh.value
    .map((position) => chordToneFunction(activeShape.value, positionPitchClass(position)))
    .join('  '),
)
const actualNoteSummary = computed(() =>
  playedPositionsLowToHigh.value
    .map((position) => noteNameWithOctave(position))
    .join('  '),
)
const playButtonLabel = computed(() => (playbackState.value === 'single-notes' ? 'Stop' : 'Play'))

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  stopChordPlayback()
})

function setPracticeMode(mode: PracticeMode): void {
  if (practiceMode.value === mode) {
    return
  }

  if (mode === 'scale-functions' && !canUseScaleFunctions.value) {
    return
  }

  practiceMode.value = mode
  savePracticeMode(mode)
  nextQuestion()
}

function checkAnswer(): void {
  if (!canSubmit.value || result.value) {
    return
  }

  const chordCorrect = primaryAnswerMatches()
  const incorrectFunctionKeys = requiresFunctionLabels.value
    ? playedPositions.value
      .filter((position) => {
        const expectedFunction = expectedFunctionForPosition(position)

        return !functionAnswerMatches(functionAnswers.value[positionKey(position)] ?? '', expectedFunction)
      })
      .map((position) => positionKey(position))
    : []
  const functionsCorrect = incorrectFunctionKeys.length === 0
  const correct = chordCorrect && functionsCorrect

  stats.attempts += 1
  stats.correct += correct ? 1 : 0
  stats.streak = correct ? stats.streak + 1 : 0
  result.value = { correct, chordCorrect, functionsCorrect, incorrectFunctionKeys, revealed: false }
}

function nextQuestion(): void {
  if (practiceMode.value === 'scale-functions') {
    scaleQuestion.value = createScaleQuestionForShapes(availableShapes.value)
    resetAnswersForShape(scaleQuestion.value.shape)
    return
  }

  question.value = createChordQuizQuestion(availableShapes.value)
  resetAnswersForShape(question.value.shape)
}

function retryQuestion(): void {
  result.value = null
}

function showAnswer(): void {
  if (result.value?.revealed || result.value?.correct) {
    return
  }

  primaryAnswer.value = expectedPrimaryAnswer()

  if (requiresFunctionLabels.value) {
    functionAnswers.value = Object.fromEntries(
      playedPositions.value.map((position) => [positionKey(position), expectedFunctionForPosition(position)]),
    )
  }

  result.value = {
    correct: true,
    chordCorrect: true,
    functionsCorrect: true,
    incorrectFunctionKeys: [],
    revealed: true,
  }
}

function playActiveShape(): void {
  if (playbackState.value === 'single-notes') {
    stopChordPlayback()
    playbackState.value = 'ready'
    return
  }

  if (playbackState.value === 'strummed') {
    playbackState.value = 'single-notes'
    void playChordNotesOnce(activeShape.value, () => {
      playbackState.value = 'ready'
    }).then((didPlay) => {
      if (!didPlay && playbackState.value === 'single-notes') {
        playbackState.value = 'ready'
      }
    })
    return
  }

  playbackState.value = 'strummed'
  void playChordShape(activeShape.value)
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.isComposing || event.repeat) {
    return
  }

  const target = event.target

  if (
    target instanceof HTMLElement
    && target.closest('button, summary')
  ) {
    return
  }

  if (canSubmit.value && !result.value) {
    event.preventDefault()
    checkAnswer()
  }
}

function openFretboardSnapshot(event: MouseEvent): void {
  const target = event.target

  if (
    target instanceof HTMLElement
    && target.closest('input, button, summary, details')
  ) {
    return
  }

  if (window.matchMedia('(max-width: 760px)').matches) {
    showFretboardSnapshot.value = true
  }
}

function closeFretboardSnapshot(): void {
  showFretboardSnapshot.value = false
}

function fillRootHints(): void {
  if (result.value || !requiresFunctionLabels.value) {
    return
  }

  const hintValue = practiceMode.value === 'scale-functions'
    ? String(scaleQuestion.value.degreeIndex + 1)
    : 'R'

  functionAnswers.value = {
    ...functionAnswers.value,
    ...Object.fromEntries(
      playedPositions.value
        .filter((position) => expectedFunctionForPosition(position) === hintValue)
        .map((position) => [positionKey(position), hintValue]),
    ),
  }
}

function toggleSuffix(suffix: string): void {
  const nextSuffixes = selectedSuffixes.value.includes(suffix)
    ? selectedSuffixes.value.filter((candidate) => candidate !== suffix)
    : [...selectedSuffixes.value, suffix]

  if (nextSuffixes.length === 0) {
    return
  }

  const nextShapes = shapesForSuffixes(nextSuffixes)

  if (
    practiceMode.value === 'scale-functions'
    && scaleChordQuestionCandidateCount(nextShapes) === 0
  ) {
    return
  }

  selectedSuffixes.value = nextSuffixes
  saveSelectedSuffixes(nextSuffixes)
  nextQuestion()
}

function suffixIsSelected(suffix: string): boolean {
  return selectedSuffixes.value.includes(suffix)
}

function suffixToggleIsDisabled(suffix: string): boolean {
  const nextSuffixes = selectedSuffixes.value.includes(suffix)
    ? selectedSuffixes.value.filter((candidate) => candidate !== suffix)
    : [...selectedSuffixes.value, suffix]

  if (nextSuffixes.length === 0) {
    return true
  }

  return practiceMode.value === 'scale-functions'
    && scaleChordQuestionCandidateCount(shapesForSuffixes(nextSuffixes)) === 0
}

function cellClass(position: FretboardPosition): Record<string, boolean> {
  const isChordTone = chordUsesPosition(activeShape.value, position.stringIndex, position.fret)

  return {
    'fret-cell': true,
    'is-chord-tone': isChordTone,
    'is-last-fret': position.fret === frets[frets.length - 1],
  }
}

function markerFor(position: FretboardPosition): boolean {
  return position.fret > 0 && chordUsesPosition(activeShape.value, position.stringIndex, position.fret)
}

function isOpenString(stringIndex: number): boolean {
  return activeShape.value.frets[stringIndex] === 0
}

function isMutedString(stringIndex: number): boolean {
  return activeShape.value.frets[stringIndex] === null
}

function positionKey(position: FretboardPosition): string {
  return `${position.stringIndex}-${position.fret}`
}

function noteNameWithOctave(position: FretboardPosition): string {
  const midi = positionMidi(position)
  const octave = Math.floor(midi / 12) - 1

  return `${pitchClassNames(midi % 12)}${octave}`
}

function expectedFunctionForPosition(position: FretboardPosition): FunctionAnswer {
  const pitchClass = positionPitchClass(position)

  return practiceMode.value === 'scale-functions'
    ? scaleDegreeFunction(scaleQuestion.value, pitchClass)
    : chordToneFunction(question.value.shape, pitchClass)
}

function markerClass(position: FretboardPosition): Record<string, boolean> {
  const key = positionKey(position)
  const showFunctionFeedback = Boolean(result.value && requiresFunctionLabels.value)

  return {
    marker: true,
    'is-function-correct': showFunctionFeedback && !result.value!.incorrectFunctionKeys.includes(key),
    'is-function-incorrect': showFunctionFeedback && result.value!.incorrectFunctionKeys.includes(key),
  }
}

function primaryAnswerMatches(): boolean {
  return practiceMode.value === 'scale-functions'
    ? romanAnswerMatches(primaryAnswer.value, scaleQuestion.value.romanNumeral, scaleQuestion.value.shape.suffix)
    : chordAnswerMatches(primaryAnswer.value, question.value.shape)
}

function expectedPrimaryAnswer(): string {
  return practiceMode.value === 'scale-functions'
    ? scaleQuestion.value.romanNumeral
    : activeShape.value.name
}

function functionAnswerMatches(input: string, expectedFunction: FunctionAnswer): boolean {
  return practiceMode.value === 'scale-functions'
    ? scaleDegreeAnswerMatches(input, expectedFunction as ScaleDegreeFunction, scaleQuestion.value.scaleType)
    : chordFunctionAnswerMatches(input, expectedFunction as ChordToneFunction)
}

function resetAnswersForShape(shape: ChordShape): void {
  primaryAnswer.value = ''
  functionAnswers.value = blankFunctionAnswersForShape(shape)
  result.value = null
  showFretboardSnapshot.value = false
  playbackState.value = 'ready'
  stopChordPlayback()
}

function blankFunctionAnswersForShape(shape: ChordShape): Record<string, string> {
  return Object.fromEntries(
    activeChordPositions(shape).map((position) => [positionKey(position), '']),
  )
}

function shapesForSuffixes(suffixes: readonly string[]): ChordShape[] {
  return filterChordShapes({
    ...DEFAULT_CHORD_FILTER,
    suffixes,
  })
}

function createScaleQuestionForShapes(shapes: readonly ChordShape[]): ScaleChordQuizQuestion {
  const shapesWithScaleQuestions = scaleChordQuestionCandidateCount(shapes) > 0
    ? shapes
    : shapesForSuffixes(DEFAULT_ENABLED_SUFFIXES)

  return createScaleChordQuizQuestion(shapesWithScaleQuestions)
}

function loadSelectedSuffixes(): string[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_ENABLED_SUFFIXES]
  }

  try {
    const rawValue = window.localStorage.getItem(CHORD_FILTER_STORAGE_KEY)
    const parsedValue = rawValue ? JSON.parse(rawValue) : null
    const validSuffixes = new Set(CHORD_QUALITY_OPTIONS.map((option) => option.suffix))

    if (!Array.isArray(parsedValue)) {
      return [...DEFAULT_ENABLED_SUFFIXES]
    }

    const suffixes = parsedValue
      .filter((suffix): suffix is string => typeof suffix === 'string' && validSuffixes.has(suffix))

    return suffixes.length > 0 ? [...new Set(suffixes)] : [...DEFAULT_ENABLED_SUFFIXES]
  } catch {
    return [...DEFAULT_ENABLED_SUFFIXES]
  }
}

function loadPracticeMode(suffixes: readonly string[]): PracticeMode {
  if (typeof window === 'undefined') {
    return 'chord-shapes'
  }

  const storedMode = window.localStorage.getItem(PRACTICE_MODE_STORAGE_KEY)
  const validModes: readonly PracticeMode[] = ['chord-recognition', 'chord-shapes', 'scale-functions']

  if (!validModes.includes(storedMode as PracticeMode)) {
    return 'chord-shapes'
  }

  if (
    storedMode === 'scale-functions'
    && scaleChordQuestionCandidateCount(shapesForSuffixes(suffixes)) === 0
  ) {
    return 'chord-shapes'
  }

  return storedMode as PracticeMode
}

function savePracticeMode(mode: PracticeMode): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PRACTICE_MODE_STORAGE_KEY, mode)
}

function saveSelectedSuffixes(suffixes: readonly string[]): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(CHORD_FILTER_STORAGE_KEY, JSON.stringify(suffixes))
}

function stringStyle(stringIndex: number): Record<string, string> {
  return {
    '--string-thickness': `${Math.max(1, stringIndex + 1)}px`,
  }
}
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <div>
        <p class="mode-label">{{ modeLabel }}</p>
        <h1>Guitar Theory Practice</h1>
      </div>
      <dl class="stats-strip" aria-label="Session results">
        <div>
          <dt>Streak</dt>
          <dd>{{ stats.streak }}</dd>
        </div>
        <div>
          <dt>Attempts</dt>
          <dd>{{ stats.attempts }}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{{ accuracy }}%</dd>
        </div>
      </dl>
    </header>

    <nav class="mode-switch" aria-label="Practice modes">
      <button
        type="button"
        :class="{ 'is-selected': practiceMode === 'chord-recognition' }"
        @click="setPracticeMode('chord-recognition')"
      >
        Chord Only
      </button>
      <button
        type="button"
        :class="{ 'is-selected': practiceMode === 'chord-shapes' }"
        @click="setPracticeMode('chord-shapes')"
      >
        Chord Shapes
      </button>
      <button
        type="button"
        :class="{ 'is-selected': practiceMode === 'scale-functions' }"
        :disabled="!canUseScaleFunctions"
        @click="setPracticeMode('scale-functions')"
      >
        Scale Functions
      </button>
    </nav>

    <section class="practice-panel" aria-labelledby="question-title">
      <div class="question-row">
        <div>
          <p class="mode-label">Current question</p>
          <h2 id="question-title">{{ questionTitle }}</h2>
        </div>
        <div class="question-actions">
          <button type="button" class="play-button" @click="playActiveShape">{{ playButtonLabel }}</button>
        </div>
      </div>

      <div v-if="practiceMode === 'scale-functions'" class="scale-prompt">
        <div>
          <span>Scale</span>
          <strong>{{ scaleQuestion.scaleName }}</strong>
        </div>
      </div>

      <div class="fretboard-wrap" aria-label="Guitar fretboard" @click="openFretboardSnapshot">
        <div class="fretboard">
          <template v-for="(guitarString, stringIndex) in GUITAR_STRINGS" :key="guitarString.id">
            <div
              v-for="fret in frets"
              :key="`${guitarString.id}-${fret}`"
              :class="cellClass({ stringIndex, fret })"
              :aria-label="`${guitarString.label}, fret ${fret}`"
              :style="stringStyle(stringIndex)"
            >
              <span class="string-line" aria-hidden="true"></span>
              <span v-if="isMutedString(stringIndex) && fret === 1" class="muted-marker" aria-hidden="true">X</span>
              <span
                v-if="isOpenString(stringIndex) && fret === 1"
                :class="[markerClass({ stringIndex, fret: 0 }), 'open-marker']"
              >
                <input
                  v-if="requiresFunctionLabels"
                  v-model="functionAnswers[positionKey({ stringIndex, fret: 0 })]"
                  class="marker-input"
                  :disabled="Boolean(result)"
                  maxlength="4"
                  placeholder="?"
                  :aria-label="`Function for ${guitarString.label} open string`"
                  @click.stop
                />
              </span>
              <span v-if="markerFor({ stringIndex, fret })" :class="markerClass({ stringIndex, fret })">
                <input
                  v-if="requiresFunctionLabels"
                  v-model="functionAnswers[positionKey({ stringIndex, fret })]"
                  class="marker-input"
                  :disabled="Boolean(result)"
                  maxlength="4"
                  placeholder="?"
                  :aria-label="`Function for ${guitarString.label}, fret ${fret}`"
                  @click.stop
                />
              </span>
            </div>
          </template>
        </div>
      </div>

      <form :class="['answer-form', { 'scale-answer-form': practiceMode === 'scale-functions' }]" @submit.prevent="checkAnswer">
        <label>
          <span>{{ answerLabel }}</span>
          <input
            v-model="primaryAnswer"
            :disabled="Boolean(result)"
            autocomplete="off"
            :placeholder="answerPlaceholder"
          />
        </label>
        <button
          v-if="practiceMode === 'chord-shapes'"
          type="button"
          class="secondary-button"
          :disabled="Boolean(result)"
          @click="fillRootHints"
        >
          Fill R
        </button>
        <button v-if="!result" type="button" class="secondary-button" @click="showAnswer">
          Show answer
        </button>
        <button v-if="!result" type="submit" :disabled="!canSubmit">Check</button>
        <template v-else>
          <button
            v-if="!result.correct && !result.revealed"
            type="button"
            class="secondary-button"
            @click="retryQuestion"
          >
            Retry
          </button>
          <button
            v-if="!result.correct && !result.revealed"
            type="button"
            class="secondary-button"
            @click="showAnswer"
          >
            Show answer
          </button>
          <button type="button" @click="nextQuestion">Next</button>
        </template>
      </form>

      <details class="answer-help">
        <summary>Accepted answers</summary>
        <div v-if="practiceMode === 'scale-functions'" class="answer-help-content">
          <section>
            <h3>Roman numeral</h3>
            <p>
              Major scale:
              <code>I</code> <code>ii</code> <code>iii</code> <code>IV</code>
              <code>V</code> <code>vi</code> <code>viio</code>
            </p>
            <p>
              Minor scale:
              <code>i</code> <code>iio</code> <code>III</code> <code>iv</code>
              <code>v</code> <code>VI</code> <code>VII</code>
            </p>
            <p>
              Seventh forms also work when the shown shape has that quality:
              <code>V7</code> <code>Imaj7</code> <code>ii7</code> <code>iim7</code>
              <code>viim7b5</code>
            </p>
            <p>
              Extensions can be typed when they match the shape:
              <code>I6</code> <code>Imaj9</code> <code>V9</code> <code>V13</code>
            </p>
          </section>
          <section>
            <h3>Circle labels</h3>
            <p>
              Use scale degrees <code>1</code> through <code>7</code>.
              Altered degrees also work, such as <code>b6</code>, <code>#4</code>,
              or <code>#7</code>.
            </p>
            <p>
              Interval-style answers also work, such as <code>b3</code> in minor
              or <code>3</code> in major.
            </p>
          </section>
        </div>
        <div v-else-if="practiceMode === 'chord-shapes'" class="answer-help-content">
          <section>
            <h3>Chord name</h3>
            <p>
              Examples:
              <code>Am</code> <code>A minor</code> <code>Cmaj7</code>
              <code>CM7</code> <code>G7</code> <code>Cadd9</code>
              <code>G13</code> <code>Bm7b5</code>
            </p>
            <p>Enharmonic spellings are accepted, such as <code>D#</code> for <code>Eb</code>.</p>
          </section>
          <section>
            <h3>Circle labels</h3>
            <p>
              Use chord functions:
              <code>R</code> <code>b9</code> <code>9</code> <code>b3</code>
              <code>3</code> <code>4</code> <code>b5</code> <code>5</code>
              <code>#5</code> <code>6</code> <code>b7</code> <code>7</code>
            </p>
            <p>
              Common aliases work too:
              <code>root</code> <code>2</code> <code>m3</code> <code>M3</code>
              <code>11</code> <code>13</code> <code>maj7</code>
            </p>
          </section>
        </div>
        <div v-else class="answer-help-content">
          <section>
            <h3>Chord name</h3>
            <p>
              Examples:
              <code>Am</code> <code>A minor</code> <code>Cmaj7</code>
              <code>CM7</code> <code>G7</code> <code>Cadd9</code>
              <code>G13</code> <code>Bm7b5</code>
            </p>
            <p>Enharmonic spellings are accepted, such as <code>D#</code> for <code>Eb</code>.</p>
          </section>
        </div>
      </details>

      <p
        v-if="result"
        :class="['feedback', result.revealed ? 'is-revealed' : result.correct ? 'is-correct' : 'is-incorrect']"
        role="status"
      >
        <strong>{{ result.revealed ? 'Answer' : result.correct ? 'Correct' : 'Not quite' }}</strong>
        <template v-if="!result.correct && !result.revealed">
          Try again, reveal the answer, or skip to the next question.
        </template>
        <template v-else-if="practiceMode === 'scale-functions'">
          In {{ scaleQuestion.scaleName }}, this chord is {{ scaleQuestion.romanNumeral }}.
          {{ expectedFunctionLabel }}: {{ expectedFunctionSummary }}.
        </template>
        <template v-else-if="practiceMode === 'chord-recognition'">
          This shape is {{ feedbackChordName }}.
        </template>
        <template v-else>
          This shape is {{ feedbackChordName }}. {{ expectedFunctionLabel }}: {{ expectedFunctionSummary }}.
        </template>
      </p>

      <dl v-if="result && (result.correct || result.revealed)" class="answer-metadata" aria-label="Answer details">
        <div>
          <dt>Chord</dt>
          <dd>{{ metadataChordName }}</dd>
        </div>
        <div>
          <dt>Chord tones</dt>
          <dd>{{ chordToneSummary }}</dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>{{ actualNoteSummary }}</dd>
        </div>
        <div v-if="practiceMode === 'scale-functions'">
          <dt>Scale function</dt>
          <dd>{{ scaleQuestion.romanNumeral }} in {{ scaleQuestion.scaleName }}</dd>
        </div>
      </dl>

      <div class="filter-row chord-type-row" aria-label="Chord type filters">
        <span class="shape-count">{{ activeShapeCount }} shapes</span>
        <button
          v-for="option in CHORD_QUALITY_OPTIONS"
          :key="option.suffix"
          type="button"
          :class="['filter-button', { 'is-selected': suffixIsSelected(option.suffix) }]"
          :aria-pressed="suffixIsSelected(option.suffix)"
          :disabled="suffixToggleIsDisabled(option.suffix)"
          @click="toggleSuffix(option.suffix)"
        >
          {{ option.label }}
        </button>
      </div>
    </section>

    <div
      v-if="showFretboardSnapshot"
      class="snapshot-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Full fretboard snapshot"
      @click.self="closeFretboardSnapshot"
    >
      <div class="snapshot-panel">
        <button type="button" class="snapshot-close" aria-label="Close snapshot" @click="closeFretboardSnapshot">
          ×
        </button>
        <div class="snapshot-fretboard" aria-hidden="true">
          <template v-for="(guitarString, stringIndex) in GUITAR_STRINGS" :key="`snapshot-${guitarString.id}`">
            <div
              v-for="fret in frets"
              :key="`snapshot-${guitarString.id}-${fret}`"
              :class="cellClass({ stringIndex, fret })"
              :style="stringStyle(stringIndex)"
            >
              <span class="string-line" aria-hidden="true"></span>
              <span v-if="isMutedString(stringIndex) && fret === 1" class="muted-marker" aria-hidden="true">X</span>
              <span
                v-if="isOpenString(stringIndex) && fret === 1"
                :class="[markerClass({ stringIndex, fret: 0 }), 'open-marker']"
              >
                <span
                  v-if="functionAnswers[positionKey({ stringIndex, fret: 0 })]"
                  class="snapshot-marker-text"
                >
                  {{ functionAnswers[positionKey({ stringIndex, fret: 0 })] || '?' }}
                </span>
              </span>
              <span v-if="markerFor({ stringIndex, fret })" :class="markerClass({ stringIndex, fret })">
                <span
                  v-if="functionAnswers[positionKey({ stringIndex, fret })]"
                  class="snapshot-marker-text"
                >
                  {{ functionAnswers[positionKey({ stringIndex, fret })] || '?' }}
                </span>
              </span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </main>
</template>
