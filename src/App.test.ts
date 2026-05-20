import { mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import App from './App.vue'

function getButton(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().trim() === label)

  if (!button) {
    throw new Error(`Button not found: ${label}`)
  }

  return button
}

function metadataLabels(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.answer-metadata dt').map((label) => label.text())
}

function metadataValue(wrapper: VueWrapper, label: string): string {
  const item = wrapper.findAll('.answer-metadata div')
    .find((candidate) => candidate.find('dt').text() === label)

  if (!item) {
    throw new Error(`Metadata item not found: ${label}`)
  }

  return item.find('dd').text()
}

describe('practice app', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists the selected practice mode across app reloads', async () => {
    const wrapper = mount(App)

    await getButton(wrapper, 'Scale Functions').trigger('click')

    expect(window.localStorage.getItem('guitar-practice:practice-mode')).toBe('scale-functions')

    wrapper.unmount()

    const reloadedWrapper = mount(App)

    expect(reloadedWrapper.find('.mode-switch .is-selected').text()).toBe('Scale Functions')

    reloadedWrapper.unmount()
  })

  it('shows answer metadata after revealing answers in every practice mode', async () => {
    const wrapper = mount(App)

    for (const mode of ['Chord Only', 'Chord Shapes', 'Scale Functions']) {
      await getButton(wrapper, mode).trigger('click')
      await getButton(wrapper, 'Show answer').trigger('click')

      expect(metadataLabels(wrapper)).toEqual(expect.arrayContaining(['Chord', 'Chord tones', 'Notes']))

      const playedStringCount = wrapper.findAll('.fretboard .marker').length

      expect(metadataValue(wrapper, 'Chord tones').split(/\s+/)).toHaveLength(playedStringCount)
      expect(metadataValue(wrapper, 'Notes').split(/\s+/)).toHaveLength(playedStringCount)

      if (mode === 'Scale Functions') {
        expect(metadataLabels(wrapper)).toContain('Scale function')
      }

      await getButton(wrapper, 'Next').trigger('click')
    }

    wrapper.unmount()
  })

  it('checks the answer when Enter is pressed', async () => {
    const wrapper = mount(App)

    await getButton(wrapper, 'Chord Only').trigger('click')
    await wrapper.find('.answer-form input').setValue('H')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await nextTick()

    expect(wrapper.find('.feedback').text()).toContain('Not quite')

    wrapper.unmount()
  })

  it('hides answer feedback when retrying the same question', async () => {
    const wrapper = mount(App)

    await getButton(wrapper, 'Chord Only').trigger('click')
    await wrapper.find('.answer-form input').setValue('H')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await nextTick()

    expect(wrapper.find('.feedback').text()).toContain('Not quite')
    expect(wrapper.find('.feedback').text()).not.toContain('This shape is')
    expect(wrapper.find('.answer-metadata').exists()).toBe(false)

    await getButton(wrapper, 'Retry').trigger('click')
    await nextTick()

    expect(wrapper.find('.feedback').exists()).toBe(false)
    expect(wrapper.find('.answer-metadata').exists()).toBe(false)
    expect((wrapper.find('.answer-form input').element as HTMLInputElement).value).toBe('H')

    wrapper.unmount()
  })
})
