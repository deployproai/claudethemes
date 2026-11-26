import { atom, read, update } from 'claude-code'
import type { Register, SessionContextUsage, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { PHOTO_HEIGHT, PHOTO_PATHS, PHOTO_WIDTH } from './photo'
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

/** Twinkle timing by class, so each star's markup stays short. */
const TWINKLE = Array.from({ length: 12 }, (_, k) =>
  `.t${k} { animation-duration: ${(4 + (k % 4) * 1.4).toFixed(1)}s; animation-delay: -${(k * 0.5).toFixed(1)}s; }`).join('\n')

/** Lit windows and street lights across the city in the traced photo, as one path of tiny squares. */
const CITY_LIGHTS = (() => {
  let seed = 9031
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  return Array.from({ length: 260 }, () => {
    const x = Math.round(rand() * 450)
    const y = Math.round(210 + rand() * 265)
    return `M${x} ${y}h2v2h-2z`
  }).join('')
})()

/** Stars go out from the faintest first, so the bright ones are the last to leave. */
const ORDER = STARS.map((s, i) => ({ i, weight: s.r * s.base })).sort((a, b) => b.weight - a.weight).map(s => s.i)

const starsLeft = (s: Sky | null) => Math.round(TOTAL_STARS * (1 - (s?.percent ?? 0) / 100))

/** A firework burst in a 1600 x 1000 box; night only, and it rests faintly visible when motion is reduced. */
function burst(cx: number, cy: number, r: number, color: string, delay: number): string {
  const rays = Array.from({ length: 18 }, (_, k) => {
    const a = (k / 18) * Math.PI * 2
    const x1 = (cx + Math.cos(a) * r * 0.25).toFixed(1), y1 = (cy + Math.sin(a) * r * 0.25).toFixed(1)
    const x2 = (cx + Math.cos(a) * r).toFixed(1), y2 = (cy + Math.sin(a) * r).toFixed(1)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle cx="${x2}" cy="${y2}" r="2"/>`
  }).join('')
  return `<g class="fw" opacity="0.25" stroke="${color}" fill="${color}" stroke-width="1.4" stroke-linecap="round" style="animation-delay:${delay}s">${rays}</g>`
}
const FIREWORKS = [
  burst(620, 330, 90, '#ffd9a0', 0.5),
  burst(1050, 260, 80, '#ffb3b3', 4.4),
  burst(820, 420, 60, '#fff1c9', 8.6),
].join('')

/**
 * Where the sun or moon sits, as percentages of the backdrop, t from 0 (rising) to 1 (setting).
 * The chat runs down the middle and the glass tower stands on the right, so the body rises above
 * the skyline in the open left margin, peaks at noon or midnight, and sinks back.
 */
function arc(t: number): { x: number; y: number } {
  const lift = Math.sin(Math.PI * t)
  return { x: 10 + 2 * lift, y: 40 - 26 * lift }
}

export function scene(s: Sky | null, nowMs: number): string {
  const minutes = istMinutes(nowMs)
  const hours = minutes / 60
  const day = daylight(hours)
  const warmth = Math.max(0, 1 - Math.abs(day - 0.5) * 2)
  const percent = s?.percent ?? 0

  // The photo's sky: blue overhead, paling to a grey haze at the horizon.
  const top = mix('#060a1c', '#6d97d8', day)
  const middle = mix(mix('#10163a', '#9bb7da', day), '#d88a6a', warmth * 0.35)
  const bottom = mix(mix('#2b2650', '#c3ccd1', day), '#f0a066', warmth * 0.6)

  const visible = starsLeft(s)
  const keep = new Set(ORDER.slice(0, visible))
  const lit = STARS.map((st, i) => keep.has(i)
    ? `<circle cx="${st.x}" cy="${st.y}" r="${st.r}" opacity="${st.base}" class="t${i % 12}"/>`
    : '').join('')

  const left = s && s.used !== null ? Math.max(0, s.window - s.used) : null
  const usedLabel = s && s.used !== null ? `${short(s.used)} used` : 'no tokens yet'
  const leftLabel = left !== null ? `${short(left)} left` : s ? `${short(s.window)} window` : ''

  const isSun = hours >= 6 && hours < 18
  const t = isSun ? (hours - 6) / 12 : (((hours - 18) + 24) % 24) / 12
  const { x, y } = arc(t)
  const warn = percent >= 85 ? '#f1a070' : percent >= 65 ? '#f3d59a' : '#f2ecdc'
  const ink = '#1a2140'

  // The sun is a soft glare in the haze; the moon is a shaded disc carrying the context figures.
  const body = isSun
    ? `<circle r="150" fill="url(#glare)"/><circle r="46" fill="#fffbe9"/><circle r="70" fill="#fff4cc" opacity="0.35"/>`
    : `<circle class="halo" r="150" fill="url(#halo)"/><circle r="104" fill="url(#moon)"/>
<circle cx="-40" cy="-38" r="15" fill="${ink}" opacity="0.06"/><circle cx="38" cy="44" r="20" fill="${ink}" opacity="0.05"/><circle cx="30" cy="-54" r="9" fill="${ink}" opacity="0.06"/>
<text y="-30" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" letter-spacing="3" fill="${ink}" opacity="0.65">CONTEXT</text>
<text y="6" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="26" font-weight="700" fill="${ink}">${usedLabel}</text>
<text y="38" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="20" fill="${ink}" opacity="0.85">${leftLabel}</text>
<text y="64" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" fill="${ink}" opacity="0.6">${visible} stars left</text>`

  const time = istLabel(nowMs)
  const strip = left !== null && s && s.used !== null ? `${short(s.used)} used · ${short(left)} left` : `${short(s?.window ?? 0)} window`
  const night = (1 - day) * 0.6

  // The root maps its units to percentages of the backdrop; each nested drawing keeps its own shape.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
<style>
.stars circle { fill: #fff7e0; animation-name: twinkle; animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-direction: alternate; }
@keyframes twinkle { from { opacity: 0.3; } to { opacity: 0.95; } }
${TWINKLE}
.fw { transform-box: fill-box; transform-origin: center; animation: burst 16s ease-out infinite; }
@keyframes burst { 0% { transform: scale(0.2); opacity: 0; } 3% { opacity: 0.7; } 20% { transform: scale(1); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }
.halo { animation: breathe 10s ease-in-out infinite alternate; }
@keyframes breathe { from { opacity: 0.6; } to { opacity: 0.9; } }
.led { animation: led 6s ease-in-out infinite alternate; }
.lights { animation: hum 7s ease-in-out infinite alternate; }
@keyframes hum { from { fill-opacity: 0.75; } to { fill-opacity: 1; } }
@keyframes led { from { opacity: 0.85; } to { opacity: 1; } }
</style>
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${top}"/><stop offset="0.5" stop-color="${middle}"/><stop offset="1" stop-color="${bottom}"/>
</linearGradient>
<linearGradient id="pane" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#173c44" stop-opacity="${(0.25 + day * 0.4).toFixed(2)}"/><stop offset="1" stop-color="#173c44" stop-opacity="0"/>
</linearGradient>
<radialGradient id="glare" cx="0.5" cy="0.5" r="0.5">
<stop offset="0.2" stop-color="#fff6d8" stop-opacity="0.9"/><stop offset="0.55" stop-color="#ffe9b0" stop-opacity="0.3"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/>
</radialGradient>
<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
<stop offset="0.45" stop-color="${warn}" stop-opacity="0.35"/><stop offset="1" stop-color="${warn}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="moon" cx="0.4" cy="0.35" r="0.75">
<stop offset="0" stop-color="#fffdf6"/><stop offset="0.7" stop-color="${warn}"/><stop offset="1" stop-color="${mix(warn, '#8d8a80', 0.35)}"/>
</radialGradient>
</defs>
<rect width="100" height="100" fill="url(#sky)"/>
<svg x="0" y="0" width="84" height="45" viewBox="0 0 1400 600" preserveAspectRatio="xMidYMid slice"><g class="stars" opacity="${(1 - day).toFixed(2)}">${lit}</g></svg>
${day < 0.5 ? `<svg x="0" y="0" width="84" height="55" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><g opacity="${(1 - day * 2).toFixed(2)}">${FIREWORKS}</g></svg>` : ''}
<svg x="0" y="0" width="100" height="100" viewBox="0 0 ${PHOTO_WIDTH} ${PHOTO_HEIGHT}" preserveAspectRatio="xMidYMax slice">${PHOTO_PATHS}
<rect width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}" fill="#0a0f26" opacity="${night.toFixed(2)}"/>
<rect width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}" fill="#f09a5c" opacity="${(warmth * 0.16).toFixed(2)}"/>
${day < 0.7 ? `<path class="lights" d="${CITY_LIGHTS}" fill="#ffcf7a" opacity="${Math.min(1, (0.7 - day) * 2).toFixed(2)}"/>` : ''}
</svg>
<rect x="0" y="0" width="22" height="100" fill="url(#pane)"/>
<svg x="${(x - 8).toFixed(2)}" y="${(y - 11.5).toFixed(2)}" width="16" height="23" viewBox="-160 -160 320 320" preserveAspectRatio="xMidYMid meet">${body}</svg>
<svg x="86.6" y="3" width="12.8" height="11" viewBox="0 0 300 200" preserveAspectRatio="xMidYMin meet">
<rect x="4" y="4" width="292" height="192" rx="8" fill="#070b16" fill-opacity="0.92" stroke="#3a4a63" stroke-width="3"/>
<text x="150" y="58" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" letter-spacing="6" fill="#7f8fa8">IST</text>
<text class="led" x="150" y="118" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="50" fill="#ffb347">${time.replace(' IST', '')}</text>
<text x="150" y="164" text-anchor="middle" font-family="ui-monospace, monospace" font-size="18" fill="#c6cbe4">${strip}</text>
</svg>
<svg x="86.6" y="30" width="12.8" height="18" viewBox="0 0 300 420" preserveAspectRatio="xMidYMid meet">
<rect x="4" y="4" width="292" height="412" rx="8" fill="#070b16" fill-opacity="0.92" stroke="#3a4a63" stroke-width="3"/>
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
