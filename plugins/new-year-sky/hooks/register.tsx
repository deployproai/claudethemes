import { atom, read, update } from 'claude-code'
import type { Register, SessionContextUsage, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import type { Sky } from '../types'

// A New Year sky that follows the time of day in India (IST). By night the
// moon is up and the stars go out one by one as the context window fills; by
// day the sun crosses the sky. Whichever is up carries the token figures, and
// a clock at the top shows the time in IST.

const SCENE = 'new-year-sky'
const TOTAL_STARS = 160
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const sky = atom({ plugin: 'new-year-sky', key: 'sky' } as const, null)
const clock = atom({ plugin: 'new-year-sky', key: 'now' } as const, null)

const { theme, problems } = makeColors({
  label: 'New Year night',
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

/** Minutes past midnight in IST (UTC+5:30, no daylight saving). */
function istMinutes(epochMs: number): number {
  const d = new Date(epochMs + IST_OFFSET_MS)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** "10:42 AM IST". */
function istLabel(epochMs: number): string {
  const m = istMinutes(epochMs)
  const h24 = Math.floor(m / 60)
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'} IST`
}

/** How much daylight there is, 0 (night) to 1 (day): dawn 5:00 to 7:00, dusk 17:30 to 19:30. */
function daylight(hours: number): number {
  const ramp = (x: number) => Math.max(0, Math.min(1, x))
  if (hours < 12) return ramp((hours - 5) / 2)
  return ramp((19.5 - hours) / 2)
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

/** Same layout every time: a small seeded generator. */
function seeded(seed: number): () => number {
  let x = seed
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296
    return x / 4294967296
  }
}

/** A firework burst in a 1600 x 1000 box; it rests faintly visible when motion is reduced. */
function burst(cx: number, cy: number, r: number, color: string, delay: number): string {
  const rays = Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2
    const x1 = (cx + Math.cos(a) * r * 0.3).toFixed(1), y1 = (cy + Math.sin(a) * r * 0.3).toFixed(1)
    const x2 = (cx + Math.cos(a) * r).toFixed(1), y2 = (cy + Math.sin(a) * r).toFixed(1)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle cx="${x2}" cy="${y2}" r="3"/>`
  }).join('')
  return `<g class="fw" opacity="0.35" stroke="${color}" fill="${color}" stroke-width="2.2" stroke-linecap="round" style="animation-delay:${delay}s">${rays}</g>`
}
const FIREWORKS = [
  burst(470, 360, 100, '#ffd166', 0.5),
  burst(1080, 300, 90, '#ef476f', 3.6),
  burst(760, 470, 70, '#06d6a0', 6.4),
  burst(1260, 470, 80, '#ffd166', 9.1),
  burst(600, 230, 64, '#c77dff', 11.2),
].join('')

/**
 * The city below the window, in a 1400 x 520 box: a hazy far skyline, cream residential towers
 * (one with a crane), a glass-faced block, trees, blue shed roofs, a construction plot, low-rise
 * rooftops, and the elevated metro line with the road and traffic beneath it.
 */
function city(day: number): string {
  const haze = mix('#1b2044', '#b9c5d1', day)
  const far = mix('#171c3c', '#a8b6c5', day)
  const wall = mix('#161c3a', '#ece6d9', day)
  const shade = mix('#10152f', '#c9c1b2', day)
  const glassFace = mix('#0e1a30', '#4f8096', day)
  const green = mix('#0a1913', '#3d6a38', day)
  const green2 = mix('#0d1f17', '#567f44', day)
  const shed = mix('#15233a', '#83a9cb', day)
  const shedLine = mix('#0e1a2c', '#5c86ac', day)
  const sand = mix('#2a231f', '#d9b98a', day)
  const roof = mix('#13182a', '#9aa2a8', day)
  const road = mix('#0f121c', '#5d6065', day)
  const viaduct = mix('#1b1f2b', '#bdbcb6', day)
  const rand = seeded(42)

  let farRow = ''
  for (let x = 0; x < 1400; ) {
    const w = 18 + Math.round(rand() * 34), h = 70 + Math.round(rand() * 120)
    farRow += `<rect x="${x}" y="${300 - h}" width="${w}" height="${h + 40}"/>`
    x += w + Math.round(rand() * 10)
  }

  const towers = [
    { x: 170, w: 58, h: 300 }, { x: 236, w: 40, h: 250 }, { x: 330, w: 66, h: 210 }, { x: 405, w: 44, h: 270 },
    { x: 520, w: 96, h: 250 }, { x: 622, w: 60, h: 220 }, { x: 860, w: 120, h: 210 }, { x: 990, w: 70, h: 250 },
    { x: 1068, w: 104, h: 200 }, { x: 1180, w: 64, h: 270 }, { x: 1250, w: 96, h: 220 }, { x: 40, w: 70, h: 200 },
  ]
  const mid = towers.map(t => {
    const y = 420 - t.h
    return `<rect x="${t.x}" y="${y}" width="${t.w}" height="${t.h}" fill="${wall}"/><rect x="${t.x + t.w * 0.62}" y="${y}" width="${t.w * 0.38}" height="${t.h}" fill="${shade}"/><rect x="${t.x + 5}" y="${y + 8}" width="${t.w - 10}" height="${t.h - 8}" fill="url(#flats)"/>`
  }).join('')

  // The tall white tower with a crane, and a glass-faced block in front of it.
  const tall = `<rect x="740" y="60" width="74" height="360" fill="${wall}"/><rect x="790" y="60" width="24" height="360" fill="${shade}"/><rect x="746" y="70" width="62" height="350" fill="url(#flats)"/>
<rect x="752" y="40" width="40" height="22" fill="${shade}"/><path d="M770 40V-10M770 -6H850M770 -6L740 6M850 -6V10" fill="none" stroke="${mix('#2a2f45', '#8d8f8a', day)}" stroke-width="3"/>
<rect x="680" y="190" width="66" height="230" fill="${glassFace}"/><rect x="684" y="196" width="58" height="224" fill="url(#panes)"/><rect x="746" y="230" width="90" height="190" fill="${wall}"/><rect x="752" y="238" width="78" height="182" fill="url(#flats)"/>`

  const trees = Array.from({ length: 34 }, () => {
    const x = Math.round(rand() * 1400), y = 400 + Math.round(rand() * 44), r = 14 + Math.round(rand() * 18)
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${rand() > 0.5 ? green : green2}"/>`
  }).join('')

  const lows = Array.from({ length: 26 }, () => {
    const x = 980 + Math.round(rand() * 420), y = 430 + Math.round(rand() * 40), w = 20 + Math.round(rand() * 30)
    return `<rect x="${x}" y="${y}" width="${w}" height="${14 + Math.round(rand() * 10)}" fill="${rand() > 0.7 ? shed : roof}"/>`
  }).join('')

  const sheds = `<path d="M0 452L300 440L470 520H0Z" fill="${shed}"/>
${Array.from({ length: 9 }, (_, k) => `<path d="M${k * 34} ${451 - k * 1.3}L${170 + k * 34} 520" stroke="${shedLine}" stroke-width="2"/>`).join('')}
<path d="M90 420L300 412L330 440L120 448Z" fill="${mix('#1c2236', '#e4e6e3', day)}"/>
${Array.from({ length: 12 }, (_, k) => `<path d="M${96 + k * 18} ${446 - k * 0.7}L${104 + k * 18} ${420 - k * 0.7}" stroke="${shedLine}" stroke-width="1.5"/>`).join('')}
<rect x="430" y="370" width="150" height="80" fill="${wall}"/><rect x="436" y="378" width="138" height="72" fill="url(#flats)"/>
<rect x="600" y="390" width="160" height="70" fill="${mix('#171c34', '#dcdcd8', day)}"/><rect x="606" y="398" width="148" height="62" fill="url(#flats)"/>`

  const plot = `<path d="M790 450L1050 440L1080 500L800 512Z" fill="${sand}"/><path d="M790 450L1050 440L1080 500" fill="none" stroke="${mix('#2c3346', '#9fb3c4', day)}" stroke-width="4"/>`

  // The metro viaduct climbing to the right, its pillars, and the road with traffic beneath.
  const pillars = [560, 700, 840, 980, 1120, 1260].map(x => {
    const top = 516 - (x - 500) * 0.085
    return `<rect x="${x}" y="${top}" width="9" height="${540 - top}" fill="${viaduct}"/>`
  }).join('')
  const lights = day > 0.5 ? '#ffffff' : '#fff2c4'
  const cars = Array.from({ length: 16 }, (_, k) => {
    const x = 560 + k * 52 + Math.round(rand() * 20)
    const y = 522 - (x - 500) * 0.085 + 8
    const color = ['#f2f2f2', '#f4c24f', '#d9534f', '#3a3f4a'][k % 4] ?? '#f2f2f2'
    return `<rect x="${x}" y="${y}" width="16" height="7" rx="2" fill="${day > 0.5 ? color : '#1a1d27'}"/>${day <= 0.5 ? `<circle cx="${x + 1}" cy="${y + 4}" r="2.2" fill="${k % 2 ? '#ff5d5d' : lights}"/>` : ''}`
  }).join('')
  const metro = `<path d="M500 528L1400 452L1400 470L500 546Z" fill="${road}"/>
<g class="traffic">${cars}</g>
${pillars}
<path d="M480 512L1400 434L1400 448L480 526Z" fill="${viaduct}"/>
<path d="M480 512L1400 434" stroke="${mix('#2b3042', '#e6e5df', day)}" stroke-width="2"/>`

  return `<g fill="${haze}" opacity="0.9">${farRow}</g><g fill="${far}" opacity="0.6">${farRow}</g>${mid}${tall}${trees}${lows}${sheds}${plot}${metro}`
}

/**
 * Where the sun or moon sits, as percentages of the backdrop, t from 0 (rising) to 1 (setting).
 * The desktop app keeps the chat down the middle and the glass tower stands on the right, so the
 * body rises out of the city in the open left margin, peaks at noon or midnight, and sinks back.
 */
function arc(t: number): { x: number; y: number } {
  const lift = Math.sin(Math.PI * t)
  return { x: 10 + 3 * lift, y: 62 - 44 * lift }
}

export function scene(s: Sky | null, nowMs: number): string {
  const minutes = istMinutes(nowMs)
  const hours = minutes / 60
  const day = daylight(hours)
  const warmth = Math.max(0, 1 - Math.abs(day - 0.5) * 2)
  const percent = s?.percent ?? 0

  // The photo's sky: deep blue overhead, paling to a warm grey haze over the city.
  const top = mix('#060a1c', '#3f78cf', day)
  const middle = mix(mix('#10163a', '#86afe2', day), '#c46a6a', warmth * 0.4)
  const bottom = mix(mix('#2b2650', '#d6dcdf', day), '#f0a066', warmth * 0.75)

  const visible = starsLeft(s)
  const keep = new Set(ORDER.slice(0, visible))
  const lit = STARS.map((st, i) => keep.has(i)
    ? `<circle cx="${st.x}" cy="${st.y}" r="${st.r}" opacity="${st.base}" style="animation-duration:${st.dur}s;animation-delay:-${st.delay}s"/>`
    : '').join('')

  const left = s && s.used !== null ? Math.max(0, s.window - s.used) : null
  const usedLabel = s && s.used !== null ? `${short(s.used)} used` : 'no tokens yet'
  const leftLabel = left !== null ? `${short(left)} left` : s ? `${short(s.window)} window` : ''

  const isSun = hours >= 6 && hours < 18
  const t = isSun ? (hours - 6) / 12 : (((hours - 18) + 24) % 24) / 12
  const { x, y } = arc(t)
  const disc = isSun
    ? (percent >= 85 ? '#ff9a52' : percent >= 65 ? '#ffc35c' : '#ffe08a')
    : (percent >= 85 ? '#f1b48a' : percent >= 65 ? '#f3d59a' : '#f4ecd2')
  const ink = '#1a2140'
  const sunRays = isSun ? `<g class="rays" stroke="${disc}" stroke-width="7" stroke-linecap="round">${Array.from({ length: 12 }, (_, k) => {
    const a = (k / 12) * Math.PI * 2
    return `<line x1="${(Math.cos(a) * 122).toFixed(1)}" y1="${(Math.sin(a) * 122).toFixed(1)}" x2="${(Math.cos(a) * 146).toFixed(1)}" y2="${(Math.sin(a) * 146).toFixed(1)}"/>`
  }).join('')}</g>` : ''
  const craters = isSun ? '' : `<circle cx="-42" cy="-40" r="14" fill="${ink}" opacity="0.07"/><circle cx="42" cy="46" r="19" fill="${ink}" opacity="0.06"/><circle cx="32" cy="-52" r="8" fill="${ink}" opacity="0.07"/>`

  const time = istLabel(nowMs)
  const strip = left !== null && s && s.used !== null ? `${short(s.used)} used · ${short(left)} left` : `${short(s?.window ?? 0)} window`
  const glow = day > 0.5 ? 0.35 : 0.9
  const towerTop = mix('#0b1328', '#2d527c', day)
  const towerBottom = mix('#18264a', '#9cbfe0', day)

  // The root maps its units to percentages of the backdrop; each nested drawing keeps its own shape.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
<style>
.stars circle { fill: #fff7e0; animation-name: twinkle; animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-direction: alternate; }
@keyframes twinkle { from { opacity: 0.25; } to { opacity: 1; } }
.fw { transform-box: fill-box; transform-origin: center; animation: burst 13s ease-out infinite; }
@keyframes burst { 0% { transform: scale(0.15); opacity: 0; } 3% { opacity: 0.9; } 22% { transform: scale(1); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }
.rays { animation: spin 140s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.halo { animation: breathe 9s ease-in-out infinite alternate; }
@keyframes breathe { from { opacity: 0.6; } to { opacity: 0.95; } }
.traffic { animation: roll 26s ease-in-out infinite alternate; }
@keyframes roll { from { transform: translate(0, 0); } to { transform: translate(-90px, 7.6px); } }
.led { animation: led 5s ease-in-out infinite alternate; }
@keyframes led { from { opacity: 0.82; } to { opacity: 1; } }
.bokeh { animation: shimmer 12s ease-in-out infinite alternate; }
@keyframes shimmer { from { opacity: 0.75; } to { opacity: 1; } }
</style>
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${top}"/><stop offset="0.55" stop-color="${middle}"/><stop offset="1" stop-color="${bottom}"/>
</linearGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${bottom}" stop-opacity="0"/><stop offset="1" stop-color="${bottom}" stop-opacity="${(0.25 + day * 0.45).toFixed(2)}"/>
</linearGradient>
<linearGradient id="frame" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#0f2a2c" stop-opacity="0.85"/><stop offset="1" stop-color="#2e5a5c" stop-opacity="0"/>
</linearGradient>
<linearGradient id="tower" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${towerTop}"/><stop offset="1" stop-color="${towerBottom}"/>
</linearGradient>
<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
<stop offset="0.4" stop-color="${disc}" stop-opacity="${isSun ? 0.55 : 0.4}"/><stop offset="1" stop-color="${disc}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="bokeh" cx="0.5" cy="0.5" r="0.5">
<stop offset="0.75" stop-color="${day > 0.5 ? '#f6cdbd' : '#ffcf9a'}" stop-opacity="0.9"/><stop offset="1" stop-color="${day > 0.5 ? '#f6cdbd' : '#ffcf9a'}" stop-opacity="0"/>
</radialGradient>
<pattern id="flats" width="11" height="13" patternUnits="userSpaceOnUse">
<rect x="2" y="3" width="6" height="6" fill="${day > 0.5 ? '#7c8790' : '#ffd27a'}" opacity="${day > 0.5 ? 0.5 : 0.8}"/>
</pattern>
<pattern id="panes" width="10" height="12" patternUnits="userSpaceOnUse">
<rect width="10" height="12" fill="none" stroke="${day > 0.5 ? '#2f5868' : '#ffcf7a'}" stroke-width="1" opacity="${day > 0.5 ? 0.6 : 0.5}"/>
</pattern>
<pattern id="curtain" width="20" height="28" patternUnits="userSpaceOnUse">
<rect width="20" height="28" fill="none" stroke="${day > 0.5 ? '#1d3348' : '#0a1020'}" stroke-width="1.4"/>
<rect x="2" y="3" width="16" height="10" fill="${day > 0.5 ? '#c9dcef' : '#ffd27a'}" opacity="${day > 0.5 ? 0.18 : 0.22}"/>
</pattern>
</defs>
<rect width="100" height="100" fill="url(#sky)"/>
<svg x="0" y="0" width="86" height="60" viewBox="0 0 1400 600" preserveAspectRatio="xMidYMid slice"><g class="stars" opacity="${(1 - day).toFixed(2)}">${lit}</g></svg>
<svg x="0" y="0" width="86" height="70" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><g opacity="${(day > 0.5 ? 0.5 : 1).toFixed(2)}">${FIREWORKS}</g></svg>
<svg x="${(x - 8).toFixed(2)}" y="${(y - 11.5).toFixed(2)}" width="16" height="23" viewBox="-160 -160 320 320" preserveAspectRatio="xMidYMid meet">
<circle class="halo" r="160" fill="url(#halo)"/>${sunRays}
<circle r="104" fill="${disc}"/>${craters}
<text y="-30" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" letter-spacing="3" fill="${ink}" opacity="0.7">CONTEXT</text>
<text y="6" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="26" font-weight="700" fill="${ink}">${usedLabel}</text>
<text y="38" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="20" fill="${ink}" opacity="0.85">${leftLabel}</text>
<text y="64" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" fill="${ink}" opacity="0.6">${visible} stars left</text>
</svg>
<rect x="0" y="40" width="100" height="22" fill="url(#haze)"/>
<svg x="0" y="50" width="86" height="50" viewBox="0 0 1400 520" preserveAspectRatio="xMidYMax slice">${city(day)}</svg>
<svg x="0" y="0" width="86" height="100" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<g class="bokeh"><circle cx="560" cy="360" r="62" fill="url(#bokeh)" opacity="${glow}"/><circle cx="300" cy="460" r="40" fill="url(#bokeh)" opacity="${glow}"/><circle cx="600" cy="510" r="26" fill="url(#bokeh)" opacity="${glow}"/></g>
</svg>
<rect x="0" y="0" width="5" height="100" fill="url(#frame)"/>
<path d="M5 0L18 0L5 38Z" fill="#ffffff" opacity="0.05"/>
<svg x="86" y="0" width="14" height="100" viewBox="0 0 140 1000" preserveAspectRatio="none">
<rect width="140" height="1000" fill="url(#tower)"/>
<rect width="140" height="1000" fill="url(#curtain)"/>
<path d="M0 0L140 0L140 1000L0 1000" fill="none" stroke="#0a1222" stroke-width="3"/>
<path d="M0 0L60 0L0 300Z" fill="#ffffff" opacity="${(0.04 + day * 0.08).toFixed(2)}"/>
</svg>
<svg x="86.6" y="3" width="12.8" height="11" viewBox="0 0 300 200" preserveAspectRatio="xMidYMin meet">
<rect x="4" y="4" width="292" height="192" rx="10" fill="#070b16" stroke="#3a4a63" stroke-width="3"/>
<text x="150" y="58" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" letter-spacing="6" fill="#7f8fa8">IST</text>
<text class="led" x="150" y="118" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="50" fill="#ffb347">${time.replace(' IST', '')}</text>
<text x="150" y="164" text-anchor="middle" font-family="ui-monospace, monospace" font-size="18" fill="#c6cbe4">${strip}</text>
</svg>
<svg x="86.6" y="30" width="12.8" height="18" viewBox="0 0 300 420" preserveAspectRatio="xMidYMid meet">
<rect x="4" y="4" width="292" height="412" rx="10" fill="#070b16" stroke="#3a4a63" stroke-width="3"/>
<text class="led" x="150" y="110" text-anchor="middle" font-family="ui-serif, serif" font-style="italic" font-weight="700" font-size="56" fill="#ffd166">Happy</text>
<text class="led" x="150" y="190" text-anchor="middle" font-family="ui-serif, serif" font-style="italic" font-weight="700" font-size="56" fill="#ffd166">New Year</text>
<text class="led" x="150" y="300" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-weight="800" font-size="84" fill="#ffffff">2027</text>
<text x="150" y="370" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" letter-spacing="5" fill="#7f8fa8">MUMBAI</text>
</svg>
</svg>`
}

function statusLine(s: Sky | null, nowMs: number): string {
  const time = istLabel(nowMs)
  if (!s) return `🕰 ${time}`
  const icon = (() => { const h = istMinutes(nowMs) / 60; return h >= 6 && h < 18 ? '☀️' : '🌙' })()
  if (s.used === null) return `🕰 ${time} · ${icon} ${short(s.window)} context · ✨ ${starsLeft(s)} stars`
  return `🕰 ${time} · ${icon} ${short(s.used)} used · ${short(Math.max(0, s.window - s.used))} left · ✨ ${starsLeft(s)} stars`
}


export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) $.ui.toast(unpainted)

    try {
      await $.theme.set(LOOK)
    } catch (error) {
      $.ui.log(`new-year-sky: message cards not supported here, using a frosted column (${String(error)})`)
      await $.theme.set(FALLBACK)
    }

    const [{ context }, now] = await Promise.all([$.session.usage(), $.clock.now()])
    const measured = toSky(context)
    await update($, sky, () => measured)
    await update($, clock, () => now)
    $.ui.status(statusLine(measured, now))

    // Move the clock, the sun and the moon along every half minute.
    $.clock.every(30_000, () => {
      void (async () => {
        const t = await $.clock.now()
        await update($, clock, () => t)
        $.ui.status(statusLine(await read($, sky), t))
      })()
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const measured = toSky(e.context)
    await update($, sky, () => measured)
    $.ui.status(statusLine(measured, (await read($, clock)) ?? (await $.clock.now())))

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.scene !== SCENE) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)
    const s = await read($, sky)
    const now = (await read($, clock)) ?? (await $.clock.now())
    const body = istMinutes(now) / 60 >= 6 && istMinutes(now) / 60 < 18 ? 'sun' : 'moon'
    const alt = s && s.used !== null
      ? `A Mumbai skyline seen from an office window at ${istLabel(now)}. The ${body} reads ${short(s.used)} tokens used and ${short(Math.max(0, s.window - s.used))} left; ${starsLeft(s)} of ${TOTAL_STARS} stars remain.`
      : `A Mumbai skyline seen from an office window at ${istLabel(now)}, with the ${body} showing the context window.`

    return <Svg source={scene(s, now)} alt={alt} isInteractive />
  })
}
