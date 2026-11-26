import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'day-at-office', component: 'Pane', requestId: 'city',
  props: { title: 'Choose a city', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 14 }, view: {} },
} as const

const GEO = JSON.stringify({ results: [
  { name: 'Frankfurt am Main', latitude: 50.11, longitude: 8.68, country: 'Germany', admin1: 'Hesse', population: 650000 },
  { name: 'Fray Bentos', latitude: -33.1, longitude: -58.3, country: 'Uruguay', admin1: 'Río Negro', population: 24000 },
  { name: 'Francistown', latitude: -21.2, longitude: 27.5, country: 'Botswana', admin1: 'North-East', population: 98000 },
] })
const PARIS = JSON.stringify({ results: [{ name: 'Paris', latitude: 48.85, longitude: 2.35, country: 'France', population: 2100000 }] })
const WX = JSON.stringify({ utc_offset_seconds: 3600, timezone_abbreviation: 'CET', current: { temperature_2m: 7, weather_code: 61, cloud_cover: 100 } })

test('typing fra offers France first, then cities by population, and picking France follows Paris', async ($, on) => {
  const urls: string[] = []
  const stored: Record<string, unknown> = {}
  on('http.fetch', (_, e) => {
    urls.push(e.url)
    const text = e.url.includes('forecast') ? WX : e.url.includes('countryCode=FR') ? PARIS : GEO
    return { value: { status: 200, ok: true, headers: {}, text } }
  })
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => { stored[e.key] = e.value; return { value: undefined } })
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  const logs: string[] = []
  on('ui.log', (_, e) => { logs.push(String(e.text)); return { value: undefined } })
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 26, 12) }))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.input({ key: 'query', text: 'fra', kind: 'change' })
  const first = await ui.find({ type: 'Button', key: 'city-0' })
  const second = await ui.find({ type: 'Button', key: 'city-1' })
  const third = await ui.find({ type: 'Button', key: 'city-2' })
  expect(first?.text).toContain('France · Paris')
  expect(second?.text).toContain('Frankfurt am Main, Hesse, Germany')
  expect(third?.text).toContain('Francistown')

  await ui.press({ key: 'city-0' })
  expect((stored.city as { name: string }).name).toBe('Paris')
  expect(logs).toEqual([])
  expect(urls.some(u => u.includes('forecast') && u.includes('latitude=48.85'))).toBe(true)
  await ui.unmount()
})

test('fewer than three letters asks for more', async ($) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.input({ key: 'query', text: 'fr', kind: 'change' })
  expect((await ui.find({ type: 'Text', text: /at least 3/ }))?.text).toBe('Type at least 3 letters')
  await ui.unmount()
})
