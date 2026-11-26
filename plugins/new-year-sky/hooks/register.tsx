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
  backdrop: { scene: SCENE, glass: { blur: 10, tint: '#0b1026', opacity: 0.55 } },
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

/** Slow golden bursts, one at a time, low on the night sky; each rests faintly visible when motion is reduced. */
function burst(cx: number, cy: number, r: number, color: string, delay: number): string {
  const rays = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2
    const x1 = (cx + Math.cos(a) * r * 0.35).toFixed(1), y1 = (cy + Math.sin(a) * r * 0.35).toFixed(1)
    const x2 = (cx + Math.cos(a) * r).toFixed(1), y2 = (cy + Math.sin(a) * r).toFixed(1)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle cx="${x2}" cy="${y2}" r="2.2"/>`
  }).join('')
  return `<g class="fw" opacity="0.3" stroke="${color}" fill="${color}" stroke-width="1.6" stroke-linecap="round" style="animation-delay:${delay}s">${rays}</g>`
}
const FIREWORKS = [
  burst(1040, 470, 70, '#e6b84a', 1),
  burst(1260, 600, 56, '#f2d27a', 4.7),
  burst(420, 560, 48, '#e8a33d', 8.2),
].join('')

const CLOUDS = `<g class="clouds" fill="#ffffff">
<g opacity="0.85"><ellipse cx="300" cy="300" rx="120" ry="34"/><ellipse cx="360" cy="280" rx="80" ry="40"/><ellipse cx="250" cy="288" rx="60" ry="28"/></g>
<g opacity="0.7"><ellipse cx="1180" cy="420" rx="140" ry="36"/><ellipse cx="1240" cy="398" rx="86" ry="42"/><ellipse cx="1120" cy="408" rx="64" ry="30"/></g>
<g opacity="0.6"><ellipse cx="760" cy="560" rx="100" ry="26"/><ellipse cx="810" cy="544" rx="64" ry="30"/></g>
</g>`

/** Where the sun or moon sits along its arc, t from 0 (rising, left) to 1 (setting, right). */
function arc(t: number): { x: number; y: number } {
  return { x: Math.round(200 + 1200 * t), y: Math.round(880 - 640 * Math.sin(Math.PI * t)) }
}

export function scene(s: Sky | null, nowMs: number): string {
  const minutes = istMinutes(nowMs)
  const hours = minutes / 60
  const day = daylight(hours)
  const warmth = Math.max(0, 1 - Math.abs(day - 0.5) * 2) // strongest halfway through dawn or dusk
  const percent = s?.percent ?? 0

  const top = mix('#060a1c', '#3a7bd5', day)
  const middle = mix(mix('#0b1026', '#7db1ea', day), '#c46a6a', warmth * 0.45)
  const bottom = mix(mix('#1b1f45', '#d4ebf8', day), '#f39a5c', warmth * 0.8)
  const ground = mix('#070b1d', '#22402c', day)

  const visible = starsLeft(s)
  const keep = new Set(ORDER.slice(0, visible))
  const lit = STARS.map((st, i) => {
    if (!keep.has(i)) return ''
    return `<circle cx="${st.x}" cy="${st.y}" r="${st.r}" opacity="${st.base}" style="animation-duration:${st.dur}s;animation-delay:-${st.delay}s"/>`
  }).join('')

  const left = s && s.used !== null ? Math.max(0, s.window - s.used) : null
  const usedLabel = s && s.used !== null ? `${short(s.used)} used` : 'no tokens yet'
  const leftLabel = left !== null ? `${short(left)} left` : s ? `${short(s.window)} window` : ''

  // The sun is up 6 AM to 6 PM IST and the moon 6 PM to 6 AM; each rises on the left and sets on the right.
  const isSun = hours >= 6 && hours < 18
  const t = isSun ? (hours - 6) / 12 : (((hours - 18) + 24) % 24) / 12
  const { x, y } = arc(t)
  const disc = isSun
    ? (percent >= 85 ? '#ff9a52' : percent >= 65 ? '#ffc35c' : '#ffd96a')
    : (percent >= 85 ? '#f1b48a' : percent >= 65 ? '#f3d59a' : '#f4ecd2')
  const ink = '#1a2140'
  const craters = isSun ? '' : `<circle cx="${x - 42}" cy="${y - 40}" r="14" fill="${ink}" opacity="0.06"/><circle cx="${x + 42}" cy="${y + 46}" r="19" fill="${ink}" opacity="0.05"/><circle cx="${x + 32}" cy="${y - 50}" r="8" fill="${ink}" opacity="0.06"/>`
  const rays = isSun ? `<g class="rays" stroke="${disc}" stroke-width="5" stroke-linecap="round" opacity="0.55">${Array.from({ length: 12 }, (_, k) => {
    const a = (k / 12) * Math.PI * 2
    return `<line x1="${(x + Math.cos(a) * 122).toFixed(1)}" y1="${(y + Math.sin(a) * 122).toFixed(1)}" x2="${(x + Math.cos(a) * 146).toFixed(1)}" y2="${(y + Math.sin(a) * 146).toFixed(1)}"/>`
  }).join('')}</g>` : ''

  const time = istLabel(nowMs)
  const strip = left !== null && s && s.used !== null ? `${short(s.used)} used · ${short(left)} left · ${visible} stars` : `${visible} stars tonight`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMin slice">
<style>
.stars circle { fill: #fff7e0; animation-name: twinkle; animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-direction: alternate; }
@keyframes twinkle { from { opacity: 0.25; } to { opacity: 1; } }
.shoot { opacity: 0; animation: shoot 14s linear infinite; }
@keyframes shoot { 0% { opacity: 0; transform: translate(0, 0); } 2% { opacity: 0.9; } 7% { opacity: 0; transform: translate(-420px, 210px); } 100% { opacity: 0; transform: translate(-420px, 210px); } }
.glow { animation: breathe 9s ease-in-out infinite alternate; }
@keyframes breathe { from { opacity: 0.55; } to { opacity: 0.85; } }
.fw { transform-box: fill-box; transform-origin: center; animation: burst 11s ease-out infinite; }
@keyframes burst { 0% { transform: scale(0.15); opacity: 0; } 3% { opacity: 0.8; } 24% { transform: scale(1); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }
.clouds { animation: drift 160s linear infinite alternate; }
@keyframes drift { from { transform: translateX(-60px); } to { transform: translateX(60px); } }
.rays { transform-box: fill-box; transform-origin: center; animation: spin 120s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${top}"/><stop offset="0.55" stop-color="${middle}"/><stop offset="1" stop-color="${bottom}"/>
</linearGradient>
<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
<stop offset="0.45" stop-color="${disc}" stop-opacity="${isSun ? 0.5 : 0.35}"/><stop offset="1" stop-color="${disc}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#fff7e0" stop-opacity="0"/><stop offset="1" stop-color="#fff7e0" stop-opacity="0.9"/>
</linearGradient>
</defs>
<rect width="1600" height="1000" fill="url(#sky)"/>
<g class="stars" opacity="${(1 - day).toFixed(2)}">${lit}</g>
${day < 0.5 ? `<g class="shoot"><line x1="1180" y1="120" x2="1300" y2="60" stroke="url(#trail)" stroke-width="2" stroke-linecap="round"/></g>${FIREWORKS}` : ''}
${day > 0.05 ? `<g opacity="${day.toFixed(2)}">${CLOUDS}</g>` : ''}
<circle class="glow" cx="${x}" cy="${y}" r="${isSun ? 190 : 170}" fill="url(#halo)"/>
${rays}
<circle cx="${x}" cy="${y}" r="104" fill="${disc}"/>
${craters}
<text x="${x}" y="${y - 30}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" letter-spacing="3" fill="${ink}" opacity="0.7">CONTEXT</text>
<text x="${x}" y="${y + 6}" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="26" font-weight="700" fill="${ink}">${usedLabel}</text>
<text x="${x}" y="${y + 38}" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="20" fill="${ink}" opacity="0.85">${leftLabel}</text>
<text x="${x}" y="${y + 64}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" fill="${ink}" opacity="0.6">${percent}% of the window</text>
<path d="M0 930 C 260 880 520 905 800 890 C 1080 875 1340 900 1600 880 L1600 1000 L0 1000 Z" fill="${ground}"/>
<rect x="590" y="22" width="420" height="104" rx="52" fill="#0b1026" fill-opacity="0.62" stroke="#e6b84a" stroke-opacity="0.55" stroke-width="1.5"/>
<text x="800" y="70" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="36" font-weight="700" fill="#fdf6e3">${time}</text>
<text x="800" y="96" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" letter-spacing="1" fill="#c6cbe4">${strip}</text>
<text x="800" y="116" text-anchor="middle" font-family="ui-serif, serif" font-style="italic" font-size="14" fill="#e6b84a">Happy New Year 2027</text>
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
    if (!set.isDrawn) $.ui.log(`new-year-sky: no look drawn here (${set.reason})`)

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
