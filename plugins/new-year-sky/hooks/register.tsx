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

const LOOK: ThemeSetArgs = {
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
  burst(240, 330, 110, '#ffd166', 0.5),
  burst(1380, 300, 95, '#ef476f', 3.2),
  burst(420, 520, 80, '#06d6a0', 6.1),
  burst(1210, 520, 90, '#ffd166', 8.4),
  burst(800, 230, 70, '#c77dff', 10.6),
].join('')

/** Slow confetti drifting down the whole sky. */
const CONFETTI = (() => {
  const rand = seeded(1231)
  const colors = ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#f8f9fa', '#c77dff']
  return Array.from({ length: 46 }, (_, i) => {
    const x = Math.round(rand() * 1600)
    const w = (4 + rand() * 5).toFixed(1), h = (8 + rand() * 7).toFixed(1)
    const dur = (16 + rand() * 18).toFixed(1), delay = (rand() * 30).toFixed(1)
    const rot = Math.round(rand() * 180)
    const color = colors[i % colors.length] ?? '#ffd166'
    return `<rect class="cf" x="${x}" y="-30" width="${w}" height="${h}" fill="${color}" transform="rotate(${rot} ${x} -30)" style="animation-duration:${dur}s;animation-delay:-${delay}s"/>`
  }).join('')
})()

/** A fluffy cloud of overlapping puffs, centred on (cx, cy). */
function cloud(cx: number, cy: number, scale: number, opacity: number): string {
  const puffs = [[-70, 8, 46], [-28, -14, 60], [26, -22, 70], [78, -4, 52], [112, 12, 36], [-110, 18, 32]]
  const body = puffs.map(([dx, dy, r]) => `<circle cx="${cx + (dx ?? 0) * scale}" cy="${cy + (dy ?? 0) * scale}" r="${(r ?? 0) * scale}"/>`).join('')
  return `<g opacity="${opacity}">${body}<rect x="${cx - 120 * scale}" y="${cy + 4 * scale}" width="${250 * scale}" height="${44 * scale}" rx="${22 * scale}"/></g>`
}
const CLOUDS = [
  cloud(230, 170, 1.15, 0.95), cloud(1330, 140, 1.0, 0.9), cloud(760, 110, 0.8, 0.75),
  cloud(520, 330, 0.9, 0.8), cloud(1110, 330, 1.2, 0.85), cloud(110, 430, 0.7, 0.7), cloud(1480, 450, 0.75, 0.7),
].join('')

/** A Manhattan-style skyline in a 1600 x 360 box, the ball-drop tower and its 2027 sign at the left. */
function skyline(day: number): string {
  const body = mix('#0d1330', '#5f7190', day)
  const far = mix('#151c40', '#8394b0', day)
  const lit = day > 0.5 ? '#c9d6ea' : '#ffd27a'
  const rand = seeded(7)
  // Far row: plain blocks for depth.
  let farRow = ''
  for (let x = 0; x < 1600; ) {
    const w = 40 + Math.round(rand() * 60), h = 90 + Math.round(rand() * 110)
    farRow += `<rect x="${x}" y="${360 - h}" width="${w}" height="${h}"/>`
    x += w + 2
  }
  // Near row: towers with lit windows.
  const towers: { x: number; w: number; h: number; top?: string }[] = [
    { x: 300, w: 70, h: 210 }, { x: 372, w: 90, h: 160 },
    { x: 470, w: 64, h: 250, top: 'deco' }, { x: 540, w: 100, h: 190 },
    { x: 650, w: 80, h: 140 }, { x: 735, w: 72, h: 300, top: 'mast' },
    { x: 815, w: 110, h: 170 }, { x: 930, w: 60, h: 230 },
    { x: 995, w: 95, h: 150 }, { x: 1095, w: 58, h: 280, top: 'glass' }, { x: 1155, w: 58, h: 280, top: 'glass' },
    { x: 1220, w: 100, h: 180 }, { x: 1325, w: 70, h: 240, top: 'deco' }, { x: 1400, w: 110, h: 160 }, { x: 1515, w: 85, h: 200 },
    { x: 0, w: 70, h: 170 }, { x: 72, w: 60, h: 130 },
  ]
  const near = towers.map(t => {
    const y = 360 - t.h
    let crown = ''
    if (t.top === 'deco') {
      const cx = t.x + t.w / 2
      crown = `<path d="M${t.x + 6} ${y} L${cx} ${y - 70} L${t.x + t.w - 6} ${y} Z"/><rect x="${cx - 2}" y="${y - 110}" width="4" height="44"/>` +
        [0.25, 0.45, 0.65].map(f => `<path d="M${t.x + 12 + f * 10} ${y - 70 * f + 6} Q${cx} ${y - 70 * f - 14} ${t.x + t.w - 12 - f * 10} ${y - 70 * f + 6}" fill="none" stroke="${lit}" stroke-width="2" opacity="0.7"/>`).join('')
    } else if (t.top === 'mast') {
      const cx = t.x + t.w / 2
      crown = `<rect x="${t.x + 10}" y="${y - 30}" width="${t.w - 20}" height="30"/><rect x="${t.x + 22}" y="${y - 54}" width="${t.w - 44}" height="24"/><rect x="${cx - 3}" y="${y - 120}" width="6" height="66"/><circle cx="${cx}" cy="${y - 122}" r="4" fill="#ff5d5d" class="beacon"/>`
    } else if (t.top === 'glass') {
      crown = `<path d="M${t.x} ${y} L${t.x + t.w} ${y - 26} L${t.x + t.w} ${y} Z"/>`
    }
    return `<g>${crown}<rect x="${t.x}" y="${y}" width="${t.w}" height="${t.h}"/><rect x="${t.x + 6}" y="${y + 8}" width="${t.w - 12}" height="${t.h - 8}" fill="url(#windows)"/></g>`
  }).join('')
  // The ball-drop tower, with its numerals and the ball on the mast.
  const bx = 150, bw = 120, bh = 230, by = 360 - bh
  const tower = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}"/>
<rect x="${bx + 8}" y="${by + 70}" width="${bw - 16}" height="${bh - 70}" fill="url(#windows)"/>
<rect x="${bx + 6}" y="${by + 6}" width="${bw - 12}" height="54" rx="4" fill="#120c02"/>
<text x="${bx + bw / 2}" y="${by + 48}" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-weight="800" font-size="44" letter-spacing="2" fill="#ffd166" class="sign">2027</text>
<rect x="${bx + bw / 2 - 3}" y="${by - 120}" width="6" height="120"/>
<g class="ball"><circle cx="${bx + bw / 2}" cy="${by - 112}" r="20" fill="url(#ball)"/><circle cx="${bx + bw / 2}" cy="${by - 112}" r="34" fill="#ffe7a3" opacity="0.25"/></g>`
  return `<g fill="${far}">${farRow}</g><g fill="${body}">${near}${tower}</g>
<rect x="0" y="350" width="1600" height="10" fill="${mix('#05081a', '#3b4a63', day)}"/>
<g opacity="${(1 - day * 0.7).toFixed(2)}" fill="${lit}"></g>`
}

/**
 * Where the sun or moon sits, as percentages of the backdrop, t from 0 (rising) to 1 (setting).
 * The desktop app frosts a chat column down the middle, so the body climbs the open left margin,
 * crosses the middle quickly around noon or midnight, and sets down the right margin.
 */
function arc(t: number): { x: number; y: number } {
  const across = Math.max(0, Math.min(1, (t - 0.47) / 0.06))
  const eased = across * across * (3 - 2 * across)
  return { x: 10 + 80 * eased, y: 74 - 38 * Math.sin(Math.PI * t) }
}

export function scene(s: Sky | null, nowMs: number): string {
  const minutes = istMinutes(nowMs)
  const hours = minutes / 60
  const day = daylight(hours)
  const warmth = Math.max(0, 1 - Math.abs(day - 0.5) * 2)
  const percent = s?.percent ?? 0

  const top = mix('#050816', '#2f6fd0', day)
  const middle = mix(mix('#0b1026', '#69a6ea', day), '#c46a6a', warmth * 0.45)
  const bottom = mix(mix('#1f2350', '#cfe7f8', day), '#f39a5c', warmth * 0.8)

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
    ? (percent >= 85 ? '#ff9a52' : percent >= 65 ? '#ffc35c' : '#ffd96a')
    : (percent >= 85 ? '#f1b48a' : percent >= 65 ? '#f3d59a' : '#f4ecd2')
  const ink = '#1a2140'
  const sunRays = isSun ? `<g class="rays" stroke="${disc}" stroke-width="7" stroke-linecap="round">${Array.from({ length: 12 }, (_, k) => {
    const a = (k / 12) * Math.PI * 2
    return `<line x1="${(Math.cos(a) * 122).toFixed(1)}" y1="${(Math.sin(a) * 122).toFixed(1)}" x2="${(Math.cos(a) * 146).toFixed(1)}" y2="${(Math.sin(a) * 146).toFixed(1)}"/>`
  }).join('')}</g>` : ''
  const craters = isSun ? '' : `<circle cx="-42" cy="-40" r="14" fill="${ink}" opacity="0.07"/><circle cx="42" cy="46" r="19" fill="${ink}" opacity="0.06"/><circle cx="32" cy="-52" r="8" fill="${ink}" opacity="0.07"/>`

  const time = istLabel(nowMs)
  const strip = left !== null && s && s.used !== null ? `${short(s.used)} used · ${short(left)} left · ${visible} stars` : `${visible} stars tonight`

  // The root maps its units to percentages of the backdrop; each nested drawing keeps its own shape.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
<style>
.stars circle { fill: #fff7e0; animation-name: twinkle; animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-direction: alternate; }
@keyframes twinkle { from { opacity: 0.25; } to { opacity: 1; } }
.fw { transform-box: fill-box; transform-origin: center; animation: burst 13s ease-out infinite; }
@keyframes burst { 0% { transform: scale(0.15); opacity: 0; } 3% { opacity: 0.9; } 22% { transform: scale(1); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }
.cf { animation-name: fall; animation-timing-function: linear; animation-iteration-count: infinite; }
@keyframes fall { from { transform: translate(0, 0) rotate(0deg); } to { transform: translate(60px, 1060px) rotate(220deg); } }
.clouds { animation: drift 180s linear infinite alternate; }
@keyframes drift { from { transform: translateX(-70px); } to { transform: translateX(70px); } }
.rays { animation: spin 140s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.halo { animation: breathe 9s ease-in-out infinite alternate; }
@keyframes breathe { from { opacity: 0.6; } to { opacity: 0.95; } }
.ball { animation: drop 18s ease-in-out infinite alternate; }
@keyframes drop { from { transform: translateY(0); } to { transform: translateY(92px); } }
.sign { animation: glow 6s ease-in-out infinite alternate; }
@keyframes glow { from { opacity: 0.8; } to { opacity: 1; } }
</style>
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${top}"/><stop offset="0.6" stop-color="${middle}"/><stop offset="1" stop-color="${bottom}"/>
</linearGradient>
<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
<stop offset="0.4" stop-color="${disc}" stop-opacity="${isSun ? 0.6 : 0.4}"/><stop offset="1" stop-color="${disc}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="ball" cx="0.35" cy="0.35" r="0.7">
<stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#ffe08a"/><stop offset="1" stop-color="#e09b2d"/>
</radialGradient>
<pattern id="windows" width="14" height="18" patternUnits="userSpaceOnUse">
<rect x="2" y="3" width="6" height="8" fill="${day > 0.5 ? '#c9d6ea' : '#ffd27a'}" opacity="${day > 0.5 ? 0.35 : 0.85}"/>
<rect x="9" y="3" width="3" height="8" fill="${day > 0.5 ? '#c9d6ea' : '#ffb84d'}" opacity="${day > 0.5 ? 0.2 : 0.4}"/>
</pattern>
</defs>
<rect width="100" height="100" fill="url(#sky)"/>
<svg x="0" y="0" width="100" height="78" viewBox="0 0 1600 760" preserveAspectRatio="xMidYMid slice"><g class="stars" opacity="${(1 - day).toFixed(2)}">${lit}</g></svg>
${day > 0.05 ? `<svg x="0" y="4" width="100" height="62" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice"><g class="clouds" fill="#ffffff" opacity="${Math.min(1, day * 1.1).toFixed(2)}">${CLOUDS}</g></svg>` : ''}
<svg x="0" y="0" width="100" height="80" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><g opacity="${(day > 0.5 ? 0.55 : 1).toFixed(2)}">${FIREWORKS}</g></svg>
<svg x="${(x - 9).toFixed(2)}" y="${(y - 13).toFixed(2)}" width="18" height="26" viewBox="-160 -160 320 320" preserveAspectRatio="xMidYMid meet">
<circle class="halo" r="160" fill="url(#halo)"/>${sunRays}
<circle r="104" fill="${disc}"/>${craters}
<text y="-30" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" letter-spacing="3" fill="${ink}" opacity="0.7">CONTEXT</text>
<text y="6" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="26" font-weight="700" fill="${ink}">${usedLabel}</text>
<text y="38" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="20" fill="${ink}" opacity="0.85">${leftLabel}</text>
<text y="64" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" fill="${ink}" opacity="0.6">${percent}% of the window</text>
</svg>
<svg x="0" y="0" width="100" height="100" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><g>${CONFETTI}</g></svg>
<svg x="0" y="62" width="100" height="38" viewBox="0 0 1600 360" preserveAspectRatio="xMinYMax slice">${skyline(day)}</svg>
<svg x="1.5" y="3" width="17" height="24" viewBox="0 0 340 300" preserveAspectRatio="xMinYMin meet">
<text x="0" y="70" font-family="ui-serif, serif" font-style="italic" font-weight="700" font-size="62" fill="#ffd166">Happy</text>
<text x="0" y="140" font-family="ui-serif, serif" font-style="italic" font-weight="700" font-size="62" fill="#ffd166">New Year</text>
<text x="0" y="228" font-family="ui-sans-serif, sans-serif" font-weight="800" font-size="84" letter-spacing="4" fill="#ffffff">2027</text>
<text x="2" y="268" font-family="ui-monospace, monospace" font-size="20" letter-spacing="5" fill="#ffffff" opacity="0.85">NEW YORK · ${isSun ? 'DAY' : 'NIGHT'}</text>
</svg>
<svg x="80.5" y="3" width="18" height="12" viewBox="0 0 420 170" preserveAspectRatio="xMaxYMin meet">
<rect x="4" y="4" width="412" height="162" rx="30" fill="#0b1026" fill-opacity="0.78" stroke="#ffd166" stroke-opacity="0.8" stroke-width="3"/>
<text x="210" y="80" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="58" font-weight="800" fill="#fdf6e3">${time}</text>
<text x="210" y="128" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" fill="#c6cbe4">${strip}</text>
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

    const set = await $.theme.set(LOOK)

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
      ? `A New Year sky at ${istLabel(now)}. The ${body} reads ${short(s.used)} tokens used and ${short(Math.max(0, s.window - s.used))} left; ${starsLeft(s)} of ${TOTAL_STARS} stars remain.`
      : `A New Year sky at ${istLabel(now)}, with the ${body} showing the context window.`

    return <Svg source={scene(s, now)} alt={alt} isInteractive />
  })
}
