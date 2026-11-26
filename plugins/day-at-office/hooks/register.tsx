import { atom, read, update } from 'claude-code'
import type { Register, SessionContextUsage, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { PHOTO_HEIGHT, PHOTO_PATHS, PHOTO_WIDTH } from './photo'
import type { Sky } from '../types'

// An office-window sky that follows the time of day in India (IST). By night the
// moon is up and the stars go out one by one as the context window fills; by
// day the sun crosses a blue sky of clouds. A gauge on the right carries the
// token figures, and a clock at the top shows the time in IST.

const SCENE = 'day-at-office'
const TOTAL_STARS = 160
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const sky = atom({ plugin: 'day-at-office', key: 'sky' } as const, null)
const clock = atom({ plugin: 'day-at-office', key: 'now' } as const, null)

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

/**
 * Where the sun or moon sits, as percentages of the backdrop, t from 0 (rising) to 1 (setting).
 * The chat runs down the middle and the glass tower stands on the right, so the body rises above
 * the skyline in the open left margin, peaks at noon or midnight, and sinks back.
 */
function arc(t: number): { x: number; y: number } {
  const lift = Math.sin(Math.PI * t)
  return { x: 13.8 + 0.6 * lift, y: 42 - 24 * lift }
}

export function scene(s: Sky | null, nowMs: number): string {
  const minutes = istMinutes(nowMs)
  const hours = minutes / 60
  const day = daylight(hours)
  const warmth = Math.max(0, 1 - Math.abs(day - 0.5) * 2)
  const percent = s?.percent ?? 0

  // The photo's sky: blue overhead, paling to a grey haze at the horizon.
  const top = mix('#06103a', '#1668cf', day)
  const middle = mix(mix('#0d2a6c', '#3f93e6', day), '#d88a6a', warmth * 0.35)
  const bottom = mix(mix('#2a5ea8', '#a8d2f4', day), '#f0a066', warmth * 0.6)

  const visible = starsLeft(s)
  const keep = new Set(ORDER.slice(0, visible))
  const lit = STARS.map((st, i) => keep.has(i)
    ? `<circle cx="${st.x}" cy="${st.y}" r="${(st.r * 0.8).toFixed(2)}" opacity="${(st.base * 0.85).toFixed(2)}"/>`
    : '').join('')

  const left = s && s.used !== null ? Math.max(0, s.window - s.used) : null
  const usedLabel = s && s.used !== null ? `${short(s.used)} used` : 'no tokens yet'
  const leftLabel = left !== null ? `${short(left)} left` : s ? `${short(s.window)} window` : ''

  const isSun = hours >= 6 && hours < 18
  const t = isSun ? (hours - 6) / 12 : (((hours - 18) + 24) % 24) / 12
  const { x, y } = arc(t)
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
  const body = isSun
    ? `<circle r="290" fill="url(#glare)"/><path d="${rays}" fill="url(#ray)"/><circle r="74" fill="url(#core)"/><circle r="30" fill="#ffffff"/>
<circle cx="-62" cy="-118" r="20" fill="#ffc46b" opacity="0.4"/><circle cx="-30" cy="-190" r="24" fill="#b9a4f0" opacity="0.22"/><circle cx="2" cy="-150" r="12" fill="#ffd9a0" opacity="0.3"/>
<circle cx="50" cy="96" r="26" fill="#bfe0ff" opacity="0.2"/><circle cx="-34" cy="66" r="15" fill="#ffe6b0" opacity="0.25"/><circle cx="104" cy="200" r="38" fill="#cfe6ff" opacity="0.12" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>`
    : `<circle class="halo" r="290" fill="url(#halo)"/><circle r="124" fill="#cfe4fb" opacity="0.5"/><circle r="118" fill="url(#moon)"/>
${sea(-34, -52, 46, 34, 0.75)}${sea(22, -66, 34, 24, 0.6)}${sea(38, -22, 40, 30, 0.7)}${sea(-62, -6, 30, 40, 0.6)}${sea(-20, 6, 34, 22, 0.45)}${sea(60, 22, 24, 30, 0.45)}${sea(-40, 60, 30, 20, 0.35)}${sea(12, 44, 20, 14, 0.3)}
<circle cx="-22" cy="84" r="7" fill="#ffffff" opacity="0.8"/><circle cx="-22" cy="84" r="20" fill="url(#bright)"/><circle cx="-84" cy="-34" r="5" fill="#ffffff" opacity="0.7"/><circle cx="52" cy="70" r="16" fill="url(#bright)"/><circle cx="-70" cy="44" r="18" fill="url(#bright)"/>
<circle r="118" fill="url(#limb)"/>`

  // Clouds: heaps of soft puffs. The low ones stay through the night, lit blue by the moon; the high ones come with the day.
  const puffs: [number, number, number, number][] = [[-0.38, 0.08, 0.3, 0.19], [-0.16, -0.08, 0.33, 0.25], [0.1, -0.13, 0.36, 0.28], [0.36, 0.05, 0.3, 0.2], [0, 0.13, 0.52, 0.16]]
  const cloud = (cx: number, cy: number, w: number, o: number) => `<g opacity="${o.toFixed(2)}"><ellipse cx="${cx}" cy="${cy + w * 0.2}" rx="${w * 0.5}" ry="${w * 0.1}" fill="url(#shade)"/>${puffs.map(([dx, dy, rx, ry]) =>
    `<ellipse cx="${(cx + dx * w).toFixed(0)}" cy="${(cy + dy * w).toFixed(0)}" rx="${(rx * w).toFixed(0)}" ry="${(ry * w).toFixed(0)}" fill="url(#puff)"/>`).join('')}</g>`
  const low = 0.7 + day * 0.25
  const clouds = cloud(250, 520, 330, low) + cloud(640, 560, 420, low) + cloud(1050, 530, 360, low) + cloud(1420, 560, 380, low) + cloud(860, 585, 300, low)
    + (day > 0.05 ? cloud(520, 330, 230, day * 0.95) + cloud(1180, 250, 260, day * 0.95) + cloud(1480, 120, 200, day * 0.9) + cloud(820, 110, 170, day * 0.85) + cloud(90, 300, 200, day * 0.9) : '')
  const puffTone = mix('#a9c8ee', '#ffffff', day)
  const shadeTone = mix('#3a5f9c', '#9fb8d4', day)

  const floors = 20
  const litFloors = percent > 0 ? Math.max(1, Math.round((percent / 100) * floors)) : 0
  const gaugeColor = percent >= 85 ? '#f1603f' : percent >= 65 ? '#ff9a52' : '#ffb347'
  const floorRects = Array.from({ length: floors }, (_, k) => {
    const isLit = k < litFloors
    const fy = 970 - (k + 1) * 45
    return `<rect x="18" y="${fy + 3}" width="36" height="39" rx="2" fill="${isLit ? gaugeColor : '#ffffff'}" opacity="${isLit ? 0.95 : 0.12}"/>`
  }).join('')
  const markY = 970 - (percent / 100) * 900
  const gauge = `<rect x="2" y="2" width="146" height="1196" rx="12" fill="#070b16" opacity="0.55"/>
<text x="75" y="44" text-anchor="middle" font-family="ui-monospace, monospace" font-size="17" letter-spacing="4" fill="#c6cbe4">CONTEXT</text>
<rect x="12" y="66" width="48" height="908" rx="4" fill="#070b16" opacity="0.7" stroke="#3a4a63" stroke-width="2"/>
${floorRects}
<path d="M64 ${markY.toFixed(0)}l10 -7v14z" fill="${gaugeColor}"/>
<text x="80" y="${(markY + 10).toFixed(0)}" font-family="ui-sans-serif, sans-serif" font-size="28" font-weight="800" fill="#fdf6e3">${percent}%</text>
<text x="66" y="84" font-family="ui-monospace, monospace" font-size="13" fill="#7f8fa8">full</text>
<text x="66" y="968" font-family="ui-monospace, monospace" font-size="13" fill="#7f8fa8">${percent < 8 ? '' : 'empty'}</text>
<text x="75" y="1030" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="24" font-weight="700" fill="#fdf6e3">${usedLabel}</text>
<text x="75" y="1072" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="22" fill="#c6cbe4">${leftLabel}</text>
<text x="75" y="1122" text-anchor="middle" font-family="ui-monospace, monospace" font-size="16" fill="#7f8fa8">${visible} stars</text>
<text x="75" y="1166" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" letter-spacing="2" fill="#7f8fa8">${short(s?.window ?? 0)} WINDOW</text>`

  const time = istLabel(nowMs)
  const strip = left !== null && s && s.used !== null ? `${short(s.used)} used · ${short(left)} left` : `${short(s?.window ?? 0)} window`
  const night = (1 - day) * 0.6

  // The root maps its units to percentages of the backdrop; each nested drawing keeps its own shape.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
<style>
.stars circle { fill: #f4f1e8; }
.halo { animation: breathe 10s ease-in-out infinite alternate; }
@keyframes breathe { from { opacity: 0.6; } to { opacity: 0.9; } }
.led { animation: led 6s ease-in-out infinite alternate; }

@keyframes led { from { opacity: 0.85; } to { opacity: 1; } }
</style>
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${top}"/><stop offset="0.5" stop-color="${middle}"/><stop offset="1" stop-color="${bottom}"/>
</linearGradient>
<linearGradient id="pane" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#173c44" stop-opacity="${(0.25 + day * 0.4).toFixed(2)}"/><stop offset="1" stop-color="#173c44" stop-opacity="0"/>
</linearGradient>
<linearGradient id="dark" x1="0" y1="0" x2="0" y2="1">
<stop offset="0.3" stop-color="#0a0f26" stop-opacity="0"/><stop offset="0.43" stop-color="#0a0f26" stop-opacity="1"/>
</linearGradient>
<linearGradient id="cityglow" x1="0" y1="0" x2="0" y2="1">
<stop offset="0.3" stop-color="#ff9e4a" stop-opacity="0"/><stop offset="0.5" stop-color="#ff9e4a" stop-opacity="0.35"/><stop offset="1" stop-color="#ffb870" stop-opacity="0.15"/>
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
<radialGradient id="shade" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="${shadeTone}" stop-opacity="0.6"/><stop offset="1" stop-color="${shadeTone}" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="100" height="100" fill="url(#sky)"/>
<svg x="0" y="0" width="84" height="38" viewBox="0 0 1400 600" preserveAspectRatio="xMidYMid slice"><g class="stars" opacity="${(1 - day).toFixed(2)}">${lit}</g></svg>
<svg x="0" y="0" width="100" height="62" viewBox="0 0 1600 640" preserveAspectRatio="xMidYMax slice">${clouds}</svg>
<svg x="0" y="0" width="100" height="100" viewBox="0 0 ${PHOTO_WIDTH} ${PHOTO_HEIGHT}" preserveAspectRatio="xMidYMax slice">${PHOTO_PATHS}
<rect width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}" fill="url(#dark)" opacity="${night.toFixed(2)}"/><path d="M477 0H560V504H486Z" fill="#0a0f26" opacity="${night.toFixed(2)}"/>
<rect width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}" fill="#f09a5c" opacity="${(warmth * 0.16).toFixed(2)}"/>
<rect width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}" fill="url(#cityglow)" opacity="${((1 - day) * 0.55).toFixed(2)}"/>
</svg>
<rect x="0" y="0" width="22" height="100" fill="url(#pane)"/>
<svg x="${(x - 11.25).toFixed(2)}" y="${(y - 18).toFixed(2)}" width="22.5" height="36" viewBox="-300 -300 600 600" preserveAspectRatio="none">${body}</svg>
<svg x="89.25" y="17" width="7.5" height="76" viewBox="0 0 150 1200" preserveAspectRatio="xMidYMin meet">${gauge}</svg>
<svg x="86.6" y="3" width="12.8" height="11" viewBox="0 0 300 200" preserveAspectRatio="xMidYMin meet">
<rect x="4" y="4" width="292" height="192" rx="8" fill="#070b16" fill-opacity="0.92" stroke="#3a4a63" stroke-width="3"/>
<text x="150" y="58" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" letter-spacing="6" fill="#7f8fa8">IST</text>
<text class="led" x="150" y="118" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="50" fill="#ffb347">${time.replace(' IST', '')}</text>
<text x="150" y="164" text-anchor="middle" font-family="ui-monospace, monospace" font-size="18" fill="#c6cbe4">${strip}</text>
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
      $.ui.log(`day-at-office: message cards not supported here, using a frosted column (${String(error)})`)
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
      ? `A Mumbai skyline seen from an office window at ${istLabel(now)}. A gauge on the right reads ${short(s.used)} tokens used and ${short(Math.max(0, s.window - s.used))} left; ${starsLeft(s)} of ${TOTAL_STARS} stars remain.`
      : `A Mumbai skyline seen from an office window at ${istLabel(now)}, with a gauge on the right showing the context window.`

    return <Svg source={scene(s, now)} alt={alt} isInteractive />
  })
}
