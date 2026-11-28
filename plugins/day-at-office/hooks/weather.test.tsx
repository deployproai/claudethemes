import { expect, test } from 'claude-code/testing'

import { scene } from './register'

const PANE = {
  plugin: 'day-at-office', component: 'Pane', requestId: 'weather',
  props: { title: 'Choose the weather', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 12 }, view: {} },
} as const

test('the weather pane lists every mode and keeps the one picked', async ($, on) => {
  const stored: Record<string, unknown> = {}
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => { stored[e.key] = e.value; return { value: undefined } })
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Button', key: 'mode-live' }))?.text).toContain('✓')
  expect((await ui.find({ type: 'Button', key: 'mode-windy' }))?.text).toContain('Windy')
  await ui.press({ key: 'mode-rain' })
  expect(stored.mode).toBe('rain')
  expect((await ui.find({ type: 'Button', key: 'mode-rain' }))?.text).toContain('✓')
  await ui.unmount()
})

test('rain gets heavier and the face sadder as the context fills; every city in every weather fits the backdrop', () => {
  const mumbai = { name: 'Mumbai', lat: 19.076, lon: 72.8777, offsetSec: 19800, tz: 'IST' }
  const at = Date.UTC(2026, 10, 27, 6)
  const empty = scene({ used: 50_000, window: 1_000_000, percent: 5 }, at, mumbai, null, 'rain')
  const full = scene({ used: 990_000, window: 1_000_000, percent: 99 }, at, mumbai, null, 'rain')
  const drops = (svg: string) => (svg.match(/l-\d+ \d+/g) ?? []).length
  expect(drops(full)).toBeGreaterThan(drops(empty) * 2)
  expect(empty).not.toContain('class="tear"')
  expect(full).toContain('class="tear"')
  const cities = ['Mumbai', 'Delhi', 'Bengaluru', 'London', 'Paris', 'New York', 'Dubai', 'Singapore', 'Tokyo', 'Sydney', 'Reykjavik']
  for (const name of cities) {
    for (const mode of ['live', 'hot', 'cold', 'rain', 'snow', 'fog', 'cloudy', 'windy'] as const) {
      for (const percent of [0, 100]) {
        for (const code of [0, 75, 95]) {
          const svg = scene({ used: percent * 10_000, window: 1_000_000, percent }, at, { ...mumbai, name }, { code, temp: 20, cloud: 100, at: 0 }, mode)
          expect(svg.length).toBeLessThan(131_072)
        }
      }
    }
  }
})

test('each featured city draws its own view; any other city falls back to Mumbai', () => {
  const at = Date.UTC(2026, 10, 27, 6)
  const place = (name: string) => ({ name, lat: 19.076, lon: 72.8777, offsetSec: 19800, tz: 'IST' })
  const mumbai = scene(null, at, place('Mumbai'))
  const london = scene(null, at, place('London'))
  const elsewhere = scene(null, at, place('Reykjavik'))
  expect(london).not.toBe(mumbai)
  expect(london).toContain('cityclip')
  expect(mumbai).toContain('M477 0H560V504H486Z')
  expect(elsewhere).toContain('M477 0H560V504H486Z')
  expect(elsewhere).not.toContain('cityclip')
})
