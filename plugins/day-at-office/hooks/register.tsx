import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { matchCountries } from './countries'
import { MODES, WEATHER_CSS, WEATHER_DEFS, character, conditionsFor, describe, moodFor, weatherLayer } from './weather'
import type { Mode } from './weather'
import { MUMBAI_VIEW, sceneFor } from './cities'
import type { City, Place, Search, Sky, Weather } from '../types'

// An office-window sky that follows the time of day in India (IST). By night the
// moon is up and the stars go out one by one as the context window fills; by
// day the sun crosses a blue sky of clouds. A gauge on the right carries the
// token figures, and a clock at the top shows the time in IST.

const SCENE = 'day-at-office'
const TOTAL_STARS = 160
const sky = atom({ plugin: 'day-at-office', key: 'sky' } as const, null)
const clock = atom({ plugin: 'day-at-office', key: 'now' } as const, null)
const where = atom({ plugin: 'day-at-office', key: 'place' } as const, null)
const conditions = atom({ plugin: 'day-at-office', key: 'weather' } as const, null)
const finder = atom({ plugin: 'day-at-office', key: 'search' } as const, { query: '', results: [], note: '' } as Search)
const PANE = 'city'
const MODE_PANE = 'weather'
const chosenMode = atom({ plugin: 'day-at-office', key: 'mode' } as const, 'live')
const asMode = (v: unknown): Mode => (MODES.find(m => m.mode === v)?.mode ?? 'live')
const MUMBAI_CITY: City = { name: 'Mumbai', label: 'Mumbai, Maharashtra, India', lat: 19.076, lon: 72.8777 }

/** Until the city's own figures arrive, or if they never do, the sky follows Mumbai. */
const MUMBAI: Place = { name: 'Mumbai', lat: 19.076, lon: 72.8777, offsetSec: 19_800, tz: 'IST' }

const { theme, problems } = makeColors({
  label: 'Day at office',
  only: 'dark',
  roles: { accent: '#e6b84a', danger: '#e5604f', success: '#5fbf8a', warning: '#e8a33d', pro: '#a98be8' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b1026',
        'surface-1': '#10173a',
        'surface-2': '#141c41',
        'surface-3': '#182147',
        'text-primary': '#eef0fa',
        'text-secondary': '#c6cbe4',
        'text-muted': '#a2a9cc',
      },
    },
  },
})

// Messages sit on their own cards, so the app's frosting over the chat column can be almost clear
// and the sky shows all around the words. Replies are midnight invitations with a gold hairline and
// corner sparkles; the person's messages are golden tickets with cut corners, tilted a touch.
const NAVY = '#0e1534'
const GOLD = '#f4c24f'
const sparkle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}L${cx + r * 0.28} ${cy - r * 0.28}L${cx + r} ${cy}L${cx + r * 0.28} ${cy + r * 0.28}L${cx} ${cy + r}L${cx - r * 0.28} ${cy + r * 0.28}L${cx - r} ${cy}L${cx - r * 0.28} ${cy - r * 0.28}Z`
const dot = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`

const INVITATION = {
  vector: {
    viewBox: 96,
    slice: 28,
    paths: [
      { d: 'M10 0H86Q96 0 96 10V86Q96 96 86 96H10Q0 96 0 86V10Q0 0 10 0Z', color: NAVY },
      { d: 'M11 5H85Q91 5 91 11V85Q91 91 85 91H11Q5 91 5 85V11Q5 5 11 5Z', strokeWidth: 1, color: '#ffd16699' },
      { d: sparkle(13, 13, 5), color: '#ffd166' },
      { d: dot(21, 9, 1.1), color: '#ffd166' },
      { d: sparkle(83, 83, 5), color: '#ffd166' },
      { d: dot(75, 87, 1.1), color: '#ffd166' },
    ],
  },
} as const

const TICKET = {
  vector: {
    viewBox: 96,
    slice: 24,
    paths: [
      { d: 'M10 0H86A10 10 0 0 0 96 10V86A10 10 0 0 0 86 96H10A10 10 0 0 0 0 86V10A10 10 0 0 0 10 0Z', color: GOLD },
      { d: 'M13 5H83A9 9 0 0 0 91 13V83A9 9 0 0 0 83 91H13A9 9 0 0 0 5 83V13A9 9 0 0 0 13 5Z', strokeWidth: 1, color: '#7a4e00aa' },
      { d: sparkle(84, 14, 4), color: '#7a4e00' },
    ],
  },
} as const

const ticket = { color: '#2a1e06', backgroundColor: GOLD, fill: TICKET, padding: 16, shadow: { y: 5, blur: 14, color: '#0007' } } as const

export const LOOK: ThemeSetArgs = {
  colors: theme,
  overrideColorScheme: 'dark',
  backdrop: { scene: SCENE, glass: { blur: 2, tint: '#0b1026', opacity: 0.12 } },
  style: {
    Heading: { color: '#ffd166', fontFamily: ['serif'], italic: true },
    UserMessage: [{ ...ticket, rotate: -1 }, { ...ticket, rotate: 1 }],
    AssistantMessage: { color: '#eef0fa', backgroundColor: NAVY, fill: INVITATION, padding: 22, shadow: { y: 6, blur: 18, color: '#0008' } },
    ToolUse: { color: '#ffd166', backgroundColor: 'rgba(11, 16, 38, 0.88)', radius: 12, borderColor: '#ffd16655', borderWidth: 1, paddingX: 10, paddingY: 4 },
  },
}

// A build that doesn't take `style` refuses the whole look, so fall back to a frosted column.
const FALLBACK: ThemeSetArgs = {
  colors: theme,
  overrideColorScheme: 'dark',
  backdrop: { scene: SCENE, glass: { blur: 4, tint: '#0b1026', opacity: 0.42 } },
}

/** 84213 -> "84.2K", 1000000 -> "1M". */
function short(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`
  return String(n)
}

function toSky(c: SessionContextUsage): Sky {
  const used = c.tokens ?? null
  const percent = c.percent ?? (used !== null && c.window > 0 ? Math.round((used / c.window) * 100) : 0)
  return { used, window: c.window, percent: Math.max(0, Math.min(100, percent)) }
}

/** Minutes past midnight in the city's local time. */
function localMinutes(epochMs: number, p: Place): number {
  const d = new Date(epochMs + p.offsetSec * 1000)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** "10:42 AM". */
function clockLabel(epochMs: number, p: Place): string {
  const m = localMinutes(epochMs, p)
  const h24 = Math.floor(m / 60)
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}

/**
 * Today's sunrise and sunset in the city, as minutes past local midnight, from the standard NOAA
 * approximation (good to a minute or two). The full moon rises as the sun sets and sets as it rises.
 * In polar night the sun never rises; under the midnight sun it never sets.
 */
function sunTimes(epochMs: number, p: Place): { rise: number; set: number } {
  const d = new Date(epochMs + p.offsetSec * 1000)
  const doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000) + 1
  const g = (2 * Math.PI / 365) * (doy - 1)
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  const rad = Math.PI / 180, lat = p.lat * rad
  const c = Math.cos(90.833 * rad) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl)
  if (c >= 1) return { rise: 720, set: 720 }
  if (c <= -1) return { rise: 0, set: 1440 }
  const ha = Math.acos(c) / rad
  const offset = p.offsetSec / 60
  return { rise: 720 - 4 * (p.lon + ha) - eq + offset, set: 720 - 4 * (p.lon - ha) - eq + offset }
}

const sunUp = (epochMs: number, p: Place) => {
  const m = localMinutes(epochMs, p)
  const { rise, set } = sunTimes(epochMs, p)
  return m >= rise && m < set
}

/** The season there now: wet and dry within the tropics, the four seasons beyond them, flipped south of the equator. */
function season(epochMs: number, p: Place): string {
  const month = new Date(epochMs + p.offsetSec * 1000).getUTCMonth()
  const south = p.lat < 0
  if (Math.abs(p.lat) < 23.5) {
    const wet = south ? month >= 10 || month <= 3 : month >= 5 && month <= 8
    return wet ? 'Wet season' : 'Dry season'
  }
  const m = south ? (month + 6) % 12 : month
  return m <= 1 || m === 11 ? 'Winter' : m <= 4 ? 'Spring' : m <= 7 ? 'Summer' : 'Autumn'
}


/** How much daylight there is, 0 (night) to 1 (day): twilight runs 45 minutes either side of sunrise and sunset. */
function daylight(m: number, rise: number, set: number): number {
  const ramp = (v: number) => Math.max(0, Math.min(1, v))
  return m < 720 ? ramp((m - rise + 45) / 90) : ramp((set + 45 - m) / 90)
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  return `#${pa.map((v, i) => Math.round(v + ((pb[i] ?? 0) - v) * t).toString(16).padStart(2, '0')).join('')}`
}

/** Same stars every time: a small seeded generator, so stars go out one by one and never jump around. */
function makeStars(): { x: number; y: number; r: number; dur: number; delay: number; base: number }[] {
  let seed = 20270101
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  return Array.from({ length: TOTAL_STARS }, () => ({
    x: Math.round(rand() * 1600),
    y: Math.round(rand() * 760),
    r: +(0.7 + rand() * rand() * 2.1).toFixed(2),
    dur: +(4 + rand() * 5).toFixed(1),
    delay: +(rand() * 6).toFixed(1),
    base: +(0.45 + rand() * 0.5).toFixed(2),
  }))
}
const STARS = makeStars()

/** Stars go out from the faintest first, so the bright ones are the last to leave. */
const ORDER = STARS.map((s, i) => ({ i, weight: s.r * s.base })).sort((a, b) => b.weight - a.weight).map(s => s.i)

const starsLeft = (s: Sky | null) => Math.round(TOTAL_STARS * (1 - (s?.percent ?? 0) / 100))

/**
 * Where the sun or moon sits, as percentages of the backdrop, t from 0 (rising) to 1 (setting).
 * It comes up from behind the buildings on the left, climbs high over the city and goes down
 * behind them again just short of the glass tower. Outside 0 to 1 it is below the skyline.
 */
function arc(t: number, base = 50): { x: number; y: number } {
  // Climbs quickly off the horizon, so it is seen clearing the rooftops rather than hidden for an hour.
  const sin = Math.sin(Math.PI * t)
  const lift = Math.sign(sin) * Math.abs(sin) ** 0.6
  return { x: 8 + 72 * t, y: base - (base - 14) * lift }
}

export function scene(s: Sky | null, nowMs: number, p: Place = MUMBAI, w: Weather | null = null, mode: Mode = 'live'): string {
  const minutes = localMinutes(nowMs, p)
  const { rise, set } = sunTimes(nowMs, p)
  // The view out of the window: the chosen city's, where the theme has one, else Mumbai's.
  const view = sceneFor(p.name) ?? MUMBAI_VIEW
  const VW = view.width, VH = view.height
  // Where the skyline falls on a typical 16:10 window, so the sun and moon rise from behind it.
  const aspect = 1.6, tall = (VH / VW) * aspect
  const arcBase = view.arcBase ?? Math.max(40, Math.min(70, (view.horizon * tall - (tall - 1)) * 100 + 4))
  const towerShape = view.towerPath ?? `M${view.tower} 0H${VW}V${VH}H${view.tower}Z`
  const hz = view.horizon
  // Mumbai's photo keeps the fit it always had; the other cities are drawn to the full width of a
  // 16:10 window, bottom-aligned, so the glass tower on the right is never cropped away.
  const fitted = view.arcBase === undefined
  const viewTall = 100 * tall
  const viewFrame = fitted ? `x="0" y="${(100 - viewTall).toFixed(2)}" width="100" height="${viewTall.toFixed(2)}"` : 'x="0" y="0" width="100" height="100"'
  // The weather grows stronger as the context window fills: k runs from 0.2 (empty) to 1 (full).
  const k = 0.2 + 0.8 * ((s?.percent ?? 0) / 100)
  const cond = conditionsFor(mode, w, k)
  const sky = { kind: cond.kind, label: cond.label }
  const wet = sky.kind === 'rain' || sky.kind === 'drizzle' || sky.kind === 'storm' || sky.kind === 'snow'
  const cover = cond.cover
  const grey = cond.grey
  const veiled = cond.veiled
  const day = daylight(minutes, rise, set)
  const warmth = Math.max(0, 1 - Math.abs(day - 0.5) * 2)
  const percent = s?.percent ?? 0

  // The photo's sky: blue overhead, paling to a grey haze at the horizon.
  const overcastTone = mix('#161b26', sky.kind === 'storm' ? '#5d6674' : '#8e98a6', day)
  const [tintColor, tintAmount] = cond.tint
  const tinted = (c: string, more = 1) => mix(c, tintColor, Math.min(1, tintAmount * more * (0.4 + 0.6 * day)))
  const top = tinted(mix(mix('#06103a', '#1668cf', day), overcastTone, grey), 0.6)
  const middle = tinted(mix(mix(mix('#0d2a6c', '#3f93e6', day), '#d88a6a', warmth * 0.35), overcastTone, grey))
  const bottom = tinted(mix(mix(mix('#2a5ea8', '#a8d2f4', day), '#f0a066', warmth * 0.6), mix(overcastTone, '#ffffff', 0.15), grey), 1.3)

  const visible = starsLeft(s)
  const keep = new Set(ORDER.slice(0, visible))
  const lit = STARS.map((st, i) => keep.has(i)
    ? `<circle cx="${st.x}" cy="${st.y}" r="${(st.r * 0.8).toFixed(2)}" opacity="${(st.base * 0.85).toFixed(2)}"/>`
    : '').join('')

  const left = s && s.used !== null ? Math.max(0, s.window - s.used) : null
  const usedLabel = s && s.used !== null ? `${short(s.used)} used` : 'no tokens yet'
  const leftLabel = left !== null ? `${short(left)} left` : s ? `${short(s.window)} window` : ''

  // The sun runs from sunrise to sunset; the full moon from sunset to the next sunrise. A little either
  // side of those times each is still drawn, sinking behind the skyline or just coming up from it.
  const tSun = (minutes - rise) / (set - rise)
  const nightLength = 1440 - (set - rise)
  const sinceSet = (minutes - set + 1440) % 1440
  const tMoon = (sinceSet > nightLength + 30 ? sinceSet - 1440 : sinceSet) / nightLength
  const showSun = tSun > -0.06 && tSun < 1.06
  const showMoon = tMoon > -0.06 && tMoon < 1.06
  // Night: a full blue-white moon with soft grey seas and a wide glow. Day: a white-hot sun with a
  // starburst of rays and a string of lens flares, as a camera sees it.
  const sea = (cx: number, cy: number, rx: number, ry: number, o: number) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#sea)" opacity="${o}"/>`
  const rays = Array.from({ length: 16 }, (_, k) => {
    const a = (k * Math.PI) / 8 + 0.2
    const len = k % 4 === 0 ? 285 : k % 2 === 0 ? 215 : 140
    const w = k % 2 === 0 ? 0.035 : 0.022
    const p = (ang: number, r: number) => `${(Math.cos(ang) * r).toFixed(1)} ${(Math.sin(ang) * r).toFixed(1)}`
    return `M${p(a - w * 4, 20)}L${p(a, len)}L${p(a + w * 4, 20)}Z`
  }).join('')
  const sunBody = `<circle r="290" fill="url(#glare)"/><path d="${rays}" fill="url(#ray)"/><circle r="74" fill="url(#core)"/><circle r="30" fill="#ffffff"/>
<circle cx="-62" cy="-118" r="20" fill="#ffc46b" opacity="0.4"/><circle cx="-30" cy="-190" r="24" fill="#b9a4f0" opacity="0.22"/><circle cx="2" cy="-150" r="12" fill="#ffd9a0" opacity="0.3"/>
<circle cx="50" cy="96" r="26" fill="#bfe0ff" opacity="0.2"/><circle cx="-34" cy="66" r="15" fill="#ffe6b0" opacity="0.25"/><circle cx="104" cy="200" r="38" fill="#cfe6ff" opacity="0.12" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>`
  const moonBody = `<circle class="halo" r="290" fill="url(#halo)"/><circle r="124" fill="#cfe4fb" opacity="0.5"/><circle r="118" fill="url(#moon)"/>
${sea(-34, -52, 46, 34, 0.75)}${sea(22, -66, 34, 24, 0.6)}${sea(38, -22, 40, 30, 0.7)}${sea(-62, -6, 30, 40, 0.6)}${sea(-20, 6, 34, 22, 0.45)}${sea(60, 22, 24, 30, 0.45)}${sea(-40, 60, 30, 20, 0.35)}${sea(12, 44, 20, 14, 0.3)}
<circle cx="-22" cy="84" r="7" fill="#ffffff" opacity="0.8"/><circle cx="-22" cy="84" r="20" fill="url(#bright)"/><circle cx="-84" cy="-34" r="5" fill="#ffffff" opacity="0.7"/><circle cx="52" cy="70" r="16" fill="url(#bright)"/><circle cx="-70" cy="44" r="18" fill="url(#bright)"/>
<circle r="118" fill="url(#limb)"/>`

  // Drawn before the city, so the buildings hide the sun and moon as they rise and set.
  const place = (t: number, art: string) => {
    const { x, y } = arc(t, arcBase)
    return `<svg x="${(x - 11.25).toFixed(2)}" y="${(y - 18).toFixed(2)}" width="22.5" height="36" viewBox="-300 -300 600 600" preserveAspectRatio="none">${art}</svg>`
  }

  // Clouds: heaps of soft puffs. The low ones stay through the night, lit blue by the moon; the high ones come with the day.
  const puffs: [number, number, number, number][] = [[-0.38, 0.08, 0.3, 0.19], [-0.16, -0.08, 0.33, 0.25], [0.1, -0.13, 0.36, 0.28], [0.36, 0.05, 0.3, 0.2], [0, 0.13, 0.52, 0.16]]
  const cloud = (cx: number, cy: number, w: number, o: number) => `<g opacity="${o.toFixed(2)}"><ellipse cx="${cx}" cy="${cy + w * 0.2}" rx="${w * 0.5}" ry="${w * 0.1}" fill="url(#shade)"/>${puffs.map(([dx, dy, rx, ry]) =>
    `<ellipse cx="${(cx + dx * w).toFixed(0)}" cy="${(cy + dy * w).toFixed(0)}" rx="${(rx * w).toFixed(0)}" ry="${(ry * w).toFixed(0)}" fill="url(#puff)"/>`).join('')}<ellipse cx="${cx}" cy="${(cy + w * 0.11).toFixed(0)}" rx="${(w * 0.5).toFixed(0)}" ry="${(w * 0.11).toFixed(0)}" fill="url(#under)" opacity="${Math.min(1, 0.25 + grey).toFixed(2)}"/></g>`
  // More cloud the more the sky is covered: a low bank always, a high layer from a quarter cover,
  // and under overcast or rain a heavy deck across the whole sky.
  const low = (0.45 + 0.55 * Math.min(1, cover / 60)) * (0.7 + day * 0.25)
  const high = Math.max(day, 0.55) * Math.min(1, cover / 30)
  const deck = cover >= 85 || wet
    ? [[160, 80, 420], [560, 40, 480], [980, 90, 440], [1400, 50, 460], [360, 230, 400], [800, 200, 460], [1250, 220, 420]].map(([cx, cy, sz]) => cloud(cx ?? 0, cy ?? 0, sz ?? 0, 0.95)).join('')
    : ''
  const clouds = cloud(250, 520, 330, low) + cloud(640, 560, 420, low) + cloud(1050, 530, 360, low) + cloud(1420, 560, 380, low) + cloud(860, 585, 300, low)
    + deck + (cover >= 50 ? cloud(300, 420, 300, high) + cloud(1000, 400, 340, high) + cloud(1350, 300, 260, high) : '') + (cover >= 25 ? cloud(520, 330, 230, high) + cloud(1180, 250, 260, high) + cloud(1480, 120, 200, high) + cloud(820, 110, 170, high) + cloud(90, 300, 200, high) : '')
  const puffTone = mix(mix('#a9c8ee', '#ffffff', day), mix('#2c323d', wet ? '#8a939f' : '#b3bac4', day), grey * 0.9)
  const shadeTone = mix(mix('#3a5f9c', '#9fb8d4', day), mix('#20252f', '#6b7480', day), grey * 0.9)

  const SANS = "'Avenir Next', Avenir, 'Segoe UI Variable', 'Segoe UI', 'Helvetica Neue', sans-serif"
  const SERIF = "Didot, 'Bodoni 72', 'Bodoni MT', 'Playfair Display', Georgia, serif"
  const floors = 20
  const litFloors = percent > 0 ? Math.max(1, Math.round((percent / 100) * floors)) : 0
  const gaugeColor = percent >= 85 ? '#f1603f' : percent >= 65 ? '#ff9a52' : '#ffb347'
  const floorRects = Array.from({ length: floors }, (_, k) => {
    const isLit = k < litFloors
    const fy = 970 - (k + 1) * 45
    return `<rect x="18" y="${fy + 3}" width="36" height="39" rx="2" fill="${isLit ? gaugeColor : '#ffffff'}" opacity="${isLit ? 0.95 : 0.16}"/>`
  }).join('')
  const markY = 970 - (percent / 100) * 900
  const gauge = `<rect x="0" y="0" width="150" height="1200" rx="20" fill="url(#veil)"/>
<text x="75" y="44" text-anchor="middle" font-family="${SANS}" font-size="15" font-weight="500" letter-spacing="7" fill="#ffffff" fill-opacity="0.85">CONTEXT</text>
<rect x="12" y="66" width="48" height="908" rx="6" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5"/>
${floorRects}
<path d="M64 ${markY.toFixed(0)}l10 -7v14z" fill="${gaugeColor}"/>
<text x="80" y="${(markY + 12).toFixed(0)}" font-family="${SERIF}" font-size="36" fill="#ffffff">${percent}%</text>
<text x="75" y="1034" text-anchor="middle" font-family="${SERIF}" font-size="30" fill="#ffffff">${usedLabel}</text>
<text x="75" y="1076" text-anchor="middle" font-family="${SANS}" font-size="20" font-weight="400" fill="#ffffff" fill-opacity="0.85">${leftLabel}</text>
<text x="75" y="1126" text-anchor="middle" font-family="${SANS}" font-size="14" letter-spacing="3" fill="#ffffff" fill-opacity="0.7">${visible} STARS</text>
<text x="75" y="1166" text-anchor="middle" font-family="${SANS}" font-size="13" letter-spacing="3" fill="#ffffff" fill-opacity="0.7">${short(s?.window ?? 0)} WINDOW</text>`

  const effects = weatherLayer(cond, k, day, mix('#3a4150', '#d9dee4', day))
  const hero = character(cond, k, moodFor(s?.percent ?? 0), day)

  const time = clockLabel(nowMs, p)
  const strip = mode === 'live' ? (w ? `${Math.round(w.temp)}°C · ${sky.label} · ${season(nowMs, p)}` : season(nowMs, p)) : `${sky.label} · ${season(nowMs, p)}`
  const night = (1 - day) * 0.6

  // The root maps its units to percentages of the backdrop; each nested drawing keeps its own shape.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
<style>
.stars circle { fill: #f4f1e8; }
.halo { animation: breathe 10s ease-in-out infinite alternate; }
@keyframes breathe { from { opacity: 0.6; } to { opacity: 0.9; } }
${WEATHER_CSS}

@keyframes led { from { opacity: 0.85; } to { opacity: 1; } }
</style>
<defs>
${WEATHER_DEFS}
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${top}"/><stop offset="0.5" stop-color="${middle}"/><stop offset="1" stop-color="${bottom}"/>
</linearGradient>
<linearGradient id="pane" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#173c44" stop-opacity="${(0.25 + day * 0.4).toFixed(2)}"/><stop offset="1" stop-color="#173c44" stop-opacity="0"/>
</linearGradient>
${view.skyline ? `<clipPath id="cityclip"><path d="${view.skyline}"/></clipPath><linearGradient id="cityhaze" x1="0" y1="0" x2="0" y2="1"><stop offset="${(hz - 0.04).toFixed(3)}" stop-color="${mix('#3a4660', '#dce8f5', day)}" stop-opacity="0.32"/><stop offset="${(hz + 0.14).toFixed(3)}" stop-color="${mix('#3a4660', '#dce8f5', day)}" stop-opacity="0"/></linearGradient>` : ''}
<linearGradient id="dark" x1="0" y1="0" x2="0" y2="1">
<stop offset="${(hz - 0.06).toFixed(3)}" stop-color="#0a0f26" stop-opacity="0"/><stop offset="${(hz + 0.07).toFixed(3)}" stop-color="#0a0f26" stop-opacity="1"/>
</linearGradient>
<radialGradient id="veil" cx="0.5" cy="0.5" r="0.75">
<stop offset="0" stop-color="#060a18" stop-opacity="0.5"/><stop offset="1" stop-color="#060a18" stop-opacity="0.28"/>
</radialGradient>
<linearGradient id="cityglow" x1="0" y1="0" x2="0" y2="1">
<stop offset="${(hz - 0.06).toFixed(3)}" stop-color="#ff9e4a" stop-opacity="0"/><stop offset="${(hz + 0.14).toFixed(3)}" stop-color="#ff9e4a" stop-opacity="0.35"/><stop offset="1" stop-color="#ffb870" stop-opacity="0.15"/>
</linearGradient>
<radialGradient id="glare" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.22" stop-color="#eaf5ff" stop-opacity="0.55"/><stop offset="0.6" stop-color="#cfe6ff" stop-opacity="0.16"/><stop offset="1" stop-color="#cfe6ff" stop-opacity="0"/>
</radialGradient>
<radialGradient id="ray" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="285">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.4"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>
<radialGradient id="core" cx="0.5" cy="0.5" r="0.5">
<stop offset="0.3" stop-color="#ffffff"/><stop offset="0.6" stop-color="#fffbe6" stop-opacity="0.8"/><stop offset="1" stop-color="#fff6cc" stop-opacity="0"/>
</radialGradient>
<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
<stop offset="0.38" stop-color="#bcd9ff" stop-opacity="0.5"/><stop offset="0.6" stop-color="#7fb0f0" stop-opacity="0.18"/><stop offset="1" stop-color="#7fb0f0" stop-opacity="0"/>
</radialGradient>
<radialGradient id="moon" cx="0.42" cy="0.4" r="0.7">
<stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#e6f1fc"/><stop offset="1" stop-color="#b3cfee"/>
</radialGradient>
<radialGradient id="sea" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#7d9cc4" stop-opacity="0.85"/><stop offset="0.55" stop-color="#8fadd2" stop-opacity="0.5"/><stop offset="1" stop-color="#a9c4e4" stop-opacity="0"/>
</radialGradient>
<radialGradient id="bright" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>
<radialGradient id="limb" cx="0.5" cy="0.5" r="0.5">
<stop offset="0.8" stop-color="#5f86bd" stop-opacity="0"/><stop offset="1" stop-color="#5f86bd" stop-opacity="0.45"/>
</radialGradient>
<radialGradient id="puff" cx="0.5" cy="0.4" r="0.5">
<stop offset="0" stop-color="${puffTone}" stop-opacity="1"/><stop offset="0.6" stop-color="${puffTone}" stop-opacity="0.85"/><stop offset="1" stop-color="${puffTone}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="under" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shadeTone}" stop-opacity="0"/><stop offset="1" stop-color="${shadeTone}" stop-opacity="0.75"/></linearGradient>
<radialGradient id="shade" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="${shadeTone}" stop-opacity="0.6"/><stop offset="1" stop-color="${shadeTone}" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="100" height="100" fill="url(#sky)"/>
<svg x="0" y="0" width="84" height="38" viewBox="0 0 1400 600" preserveAspectRatio="xMidYMid slice"><g class="stars" opacity="${(1 - day).toFixed(2)}">${lit}</g></svg>
<svg x="0" y="0" width="100" height="62" viewBox="0 0 1600 640" preserveAspectRatio="xMidYMax slice"><g class="drift" style="--drift:${cover >= 85 ? 90 : 140}s">${clouds}</g></svg>
<g opacity="${veiled.toFixed(2)}">${showMoon ? place(tMoon, moonBody) : ''}${showSun ? place(tSun, sunBody) : ''}</g>
<svg ${viewFrame} viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="${fitted ? 'none' : 'xMidYMax slice'}">${view.paths}${view.skyline ? `<rect width="${view.tower}" height="${VH}" fill="url(#cityhaze)" clip-path="url(#cityclip)"/>` : ''}${view.landmarks}
<rect width="${VW}" height="${VH}" fill="url(#dark)" opacity="${night.toFixed(2)}"/><path d="${towerShape}" fill="#0a0f26" opacity="${night.toFixed(2)}"/>
<rect width="${VW}" height="${VH}" fill="#f09a5c" opacity="${(warmth * 0.16).toFixed(2)}"/>
<rect width="${VW}" height="${VH}" fill="${mix('#1c2029', '#7d8590', day)}" opacity="${(Math.max(0, grey - 0.4) * 0.6).toFixed(2)}"/>
<rect width="${VW}" height="${VH}" fill="url(#cityglow)" opacity="${((1 - day) * 0.55).toFixed(2)}"/>
</svg>
<rect x="0" y="0" width="22" height="100" fill="url(#pane)"/>
${effects}
<svg x="0" y="20" width="24" height="79.5" viewBox="225 -130 625 1615" preserveAspectRatio="xMidYMax meet">${hero}</svg>
<svg x="88.25" y="17" width="9.5" height="82" viewBox="0 0 150 1200" preserveAspectRatio="xMidYMax meet">${gauge}</svg>
<svg x="86.6" y="3" width="12.8" height="11" viewBox="0 0 300 200" preserveAspectRatio="xMidYMin meet">
<rect x="0" y="0" width="300" height="200" rx="20" fill="url(#veil)"/>
<text x="150" y="50" text-anchor="middle" font-family="${SANS}" font-size="16" font-weight="500" letter-spacing="8" fill="#ffffff" fill-opacity="0.8">${p.name.toUpperCase()} · ${p.tz}</text>
<text x="150" y="118" text-anchor="middle" font-family="${SERIF}" font-size="60" fill="#ffffff">${time}</text>
<text x="150" y="162" text-anchor="middle" font-family="${SANS}" font-size="17" letter-spacing="1" fill="#ffffff" fill-opacity="0.85">${strip}</text>
</svg>
</svg>`
}

function statusLine(s: Sky | null, nowMs: number, p: Place, w: Weather | null): string {
  const time = `${clockLabel(nowMs, p)} ${p.tz}`
  const icon = sunUp(nowMs, p) ? '☀️' : '🌙'
  const weather = w ? ` · ${Math.round(w.temp)}°C ${describe(w.code).label.toLowerCase()}` : ''
  if (!s) return `🕰 ${time}${weather}`
  if (s.used === null) return `🕰 ${time}${weather} · ${icon} ${short(s.window)} context · ✨ ${starsLeft(s)} stars`
  return `🕰 ${time}${weather} · ${icon} ${short(s.used)} used · ${short(Math.max(0, s.window - s.used))} left · ✨ ${starsLeft(s)} stars`
}

/** Shows the clock, the weather and the context figures in the status line. */
async function status($: EngineInterface): Promise<void> {
  $.ui.status(statusLine(await read($, sky), (await read($, clock)) ?? (await $.clock.now()), (await read($, where)) ?? MUMBAI, await read($, conditions)))
}

type Found = { name: string; latitude: number; longitude: number; country?: string; admin1?: string; population?: number }

/**
 * Places matching what was typed: countries whose name starts with it first (each follows its
 * capital), then cities from Open-Meteo's free geocoder, most populous first. From three letters
 * the geocoder matches loosely.
 */
async function searchCities($: EngineInterface, query: string): Promise<City[]> {
  const countries: City[] = matchCountries(query).slice(0, 3).map(c => ({
    name: c.capital,
    label: `${c.name} · ${c.capital}`,
    lat: 0,
    lon: 0,
    capitalOf: { capital: c.capital, code: c.code },
  }))
  const r = await $.http.fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=20&language=en&format=json`)
  if (!r.ok) throw new Error(`the city search answered ${r.status}`)
  const found = ((JSON.parse(r.text) as { results?: Found[] }).results ?? []).sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
  const cities = found.map(c => ({
    name: c.name,
    label: [c.name, c.admin1 && c.admin1 !== c.name ? c.admin1 : '', c.country ?? ''].filter(Boolean).join(', ') + (sceneFor(c.name) ? '  · city view' : ''),
    lat: c.latitude,
    lon: c.longitude,
  }))
  return [...countries, ...cities].slice(0, 8)
}

/** A country picked in the search becomes its capital, looked up within that country. */
async function resolve($: EngineInterface, city: City): Promise<City | null> {
  if (!city.capitalOf) return city
  const { capital, code } = city.capitalOf
  const r = await $.http.fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(capital)}&count=1&language=en&format=json&countryCode=${code}`)
  const hit = r.ok ? ((JSON.parse(r.text) as { results?: Found[] }).results ?? [])[0] : undefined
  if (!hit) return null
  return { name: hit.name, label: [hit.name, hit.country ?? ''].filter(Boolean).join(', '), lat: hit.latitude, lon: hit.longitude }
}

/** The city chosen last, kept across sessions; Mumbai until one is chosen. */
async function chosenCity($: EngineInterface): Promise<City> {
  const kept = (await $.store.get('city')) as City | undefined
  return kept && typeof kept.lat === 'number' && typeof kept.lon === 'number' ? kept : MUMBAI_CITY
}

/** Reads the city's weather and puts the sky there. Offline, it leaves the sky as it was. */
async function follow($: EngineInterface, city: City): Promise<void> {
  try {
    const got = await readWeather($, city, await $.clock.now())
    if (!got) return
    await update($, where, () => got.place)
    await update($, conditions, () => got.weather)
    await status($)
  } catch (error) {
    $.ui.log(`day-at-office: weather not available (${String(error)})`)
  }
}

/** Runs the search for what is typed, once three letters are in; a reply to an older query is dropped. */
async function onType($: EngineInterface, value: string): Promise<void> {
  const query = value.trim()
  if (query.length < 3) {
    await update($, finder, () => ({ query, results: [], note: 'Type at least 3 letters' }))
    return
  }
  await update($, finder, now => ({ ...now, query, note: 'Searching…' }))
  try {
    const results = await searchCities($, query)
    await update($, finder, now => now.query !== query ? now : { query, results, note: results.length ? '' : `No city matches "${query}"` })
  } catch (error) {
    await update($, finder, now => now.query !== query ? now : { query, results: [], note: `Search not available (${String(error)})` })
  }
}

/** Keeps the weather mode for later sessions and redraws the sky with it. */
async function pickMode($: EngineInterface, mode: Mode): Promise<void> {
  await $.store.set('mode', mode)
  await update($, chosenMode, () => mode)
  await $.ui.close({ id: MODE_PANE })
  $.ui.toast(`Weather: ${MODES.find(m => m.mode === mode)?.label ?? mode}`)
}

/** Keeps the city for later sessions, moves the sky there and closes the search. */
async function choose($: EngineInterface, picked: City): Promise<void> {
  const city = await resolve($, picked).catch(() => null)
  if (!city) {
    await update($, finder, now => ({ ...now, note: `Couldn't find ${picked.name}; try typing the city instead` }))
    return
  }
  await $.store.set('city', city)
  await $.ui.close({ id: PANE })
  $.ui.toast(`Sky now follows ${city.label}`)
  await follow($, city)
}

/** The city's current weather, UTC offset and zone abbreviation from Open-Meteo's free forecast. */
async function readWeather($: EngineInterface, city: { name: string; lat: number; lon: number }, nowMs: number): Promise<{ place: Place; weather: Weather } | null> {
  const r = await $.http.fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code,cloud_cover&timezone=auto&forecast_days=1`)
  if (!r.ok) return null
  const j = JSON.parse(r.text) as { utc_offset_seconds?: number; timezone_abbreviation?: string; current?: { temperature_2m?: number; weather_code?: number; cloud_cover?: number } }
  if (!j.current || j.utc_offset_seconds === undefined) return null
  const off = j.utc_offset_seconds
  const tz = j.timezone_abbreviation && !/^GMT[+-]/.test(j.timezone_abbreviation) ? j.timezone_abbreviation : `UTC${off >= 0 ? '+' : '-'}${Math.floor(Math.abs(off) / 3600)}${Math.abs(off) % 3600 ? `:${String(Math.abs(off) % 3600 / 60).padStart(2, '0')}` : ''}`
  return {
    place: { name: city.name, lat: city.lat, lon: city.lon, offsetSec: off, tz },
    weather: { code: j.current.weather_code ?? 0, temp: j.current.temperature_2m ?? 0, cloud: j.current.cloud_cover ?? 0, at: nowMs },
  }
}

export const register: Register = on => {

  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) $.ui.toast(unpainted)

    try {
      await $.theme.set(LOOK)
    } catch (error) {
      $.ui.log(`day-at-office: message cards not supported here, using a frosted column (${String(error)})`)
      await $.theme.set(FALLBACK)
    }

    const [{ context }, now] = await Promise.all([$.session.usage(), $.clock.now()])
    const measured = toSky(context)
    await update($, sky, () => measured)
    await update($, clock, () => now)
    await status($)

    // Follow the chosen city's weather now and every twenty minutes. Offline, the sky stays on
    // Mumbai's time with fair weather.
    void chosenCity($).then(city => follow($, city))
    $.clock.every(20 * 60_000, () => { void chosenCity($).then(city => follow($, city)) })

    const keptMode = asMode(await $.store.get('mode'))
    await update($, chosenMode, () => keptMode)
    await $.command.register({ name: 'weather', description: 'Choose the weather the sky shows: live, hot, cold, rainy, snowy, foggy, cloudy or windy' })
    await $.command.register({ name: 'city', description: 'Search for the city whose time, sun, season and weather the sky follows' })

    // Move the clock, the sun and the moon along every half minute.
    $.clock.every(30_000, () => {
      void (async () => {
        const t = await $.clock.now()
        await update($, clock, () => t)
        await status($)
      })()
    })

    return next(e)
  })

  on('command.run', { command: 'city' }, async $ => {
    const current = await chosenCity($)
    await update($, finder, () => ({ query: '', results: [], note: `Now following ${current.label}` }))
    await $.ui.open({ id: PANE, title: 'Choose a city', focus: true, closeOnEscape: true, holdToasts: true, rows: 14 })

    return { text: 'Type the first three letters of a city, then pick it from the list.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Input, Text } = $.ui.resolve(e)
    const found = await read($, finder)

    return (
      <Box flexDirection="column" gap={1}>
        <Input
          key="query"
          label="City"
          placeholder="First 3 letters of a city or country, e.g. Fra"
          autoFocus
          submitLabel="Pick first"
          onInput={value => { void onType($, value) }}
          onSubmit={() => {
            const first = found.results[0]
            if (first) void choose($, first)
          }}
        />
        {found.note !== '' && <Text dimColor>{found.note}</Text>}
        <Box flexDirection="column">
          {found.results.map((city, n) => (
            <Button key={`city-${n}`} hotkey={String(n + 1)} onPress={() => { void choose($, city) }}>
              {`${n + 1}  ${city.label}`}
            </Button>
          ))}
        </Box>
      </Box>
    )
  })

  on('command.run', { command: 'weather' }, async $ => {
    await $.ui.open({ id: MODE_PANE, title: 'Choose the weather', focus: true, closeOnEscape: true, holdToasts: true, rows: 12 })

    return { text: 'Pick the weather the sky shows. It grows stronger as the context window fills.' }
  })

  on('ui.render', { component: 'Pane', requestId: MODE_PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const current = asMode(await read($, chosenMode))

    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>The effect grows stronger, and the character sadder, as the context window fills.</Text>
        <Box flexDirection="column">
          {MODES.map((m, n) => (
            <Button key={`mode-${m.mode}`} hotkey={String(n + 1)} onPress={() => { void pickMode($, m.mode) }}>
              {`${n + 1}  ${m.label}${m.mode === current ? '  ✓' : ''}`}
            </Button>
          ))}
        </Box>
      </Box>
    )
  })

  on('session.measure', async ($, e, next) => {
    const measured = toSky(e.context)
    await update($, sky, () => measured)
    await status($)

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.scene !== SCENE) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)
    const s = await read($, sky)
    const now = (await read($, clock)) ?? (await $.clock.now())
    const p = (await read($, where)) ?? MUMBAI
    const w = await read($, conditions)
    const mode = asMode(await read($, chosenMode))
    const told = `${clockLabel(now, p)} in ${p.name}${w ? `, ${describe(w.code).label.toLowerCase()} and ${Math.round(w.temp)}°C` : ''}`
    const alt = s && s.used !== null
      ? `A Mumbai skyline seen from an office window, the sky set to ${told}. A gauge on the right reads ${short(s.used)} tokens used and ${short(Math.max(0, s.window - s.used))} left; ${starsLeft(s)} of ${TOTAL_STARS} stars remain.`
      : `A Mumbai skyline seen from an office window, the sky set to ${told}, with a gauge on the right showing the context window.`

    return <Svg source={scene(s, now, p, w, mode)} alt={alt} isInteractive />
  })
}
