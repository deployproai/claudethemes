import { HERO } from './hero'

// The weather the sky shows, and the character standing at the window. `live` follows the chosen
// city's real weather; the rest are set by hand with /weather. Whichever it is, the effect grows
// stronger as the context window fills, and the character's face goes from a smile to sorrow.

export type Mode = 'live' | 'hot' | 'cold' | 'rain' | 'snow' | 'fog' | 'cloudy' | 'windy'

export const MODES: { mode: Mode; label: string }[] = [
  { mode: 'live', label: 'Live weather of your city' },
  { mode: 'hot', label: 'Hot summer' },
  { mode: 'cold', label: 'Cold winter' },
  { mode: 'rain', label: 'Rainy' },
  { mode: 'snow', label: 'Snowy' },
  { mode: 'fog', label: 'Foggy' },
  { mode: 'cloudy', label: 'Cloudy' },
  { mode: 'windy', label: 'Windy' },
]

export type Kind = 'clear' | 'cloudy' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm' | 'hot' | 'cold' | 'windy'
type Outfit = keyof typeof HERO

/** WMO weather codes, as Open-Meteo reports them, to a kind of sky and a word for the clock. */
export function describe(code: number): { kind: Kind; label: string } {
  if (code <= 1) return { kind: 'clear', label: code === 0 ? 'Clear' : 'Mostly clear' }
  if (code === 2) return { kind: 'cloudy', label: 'Partly cloudy' }
  if (code === 3) return { kind: 'overcast', label: 'Overcast' }
  if (code === 45 || code === 48) return { kind: 'fog', label: 'Fog' }
  if (code >= 51 && code <= 57) return { kind: 'drizzle', label: 'Drizzle' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { kind: 'rain', label: code >= 80 ? 'Showers' : 'Rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'snow', label: 'Snow' }
  if (code >= 95) return { kind: 'storm', label: 'Thunderstorm' }
  return { kind: 'cloudy', label: 'Cloudy' }
}

export type Conditions = {
  kind: Kind
  label: string
  /** Cloud cover, 0 to 100. */
  cover: number
  /** How far the sky's colour is drained to grey, 0 to 1. */
  grey: number
  /** How visible the sun and moon are, 0 to 1. */
  veiled: number
  /** A tint mixed into the sky, and how much of it. */
  tint: [string, number]
  outfit: Outfit
}

/**
 * What to draw, from the mode, the city's live weather (for `live`) and the intensity `k`
 * (0.2 with an empty context window, 1 when it is full).
 */
export function conditionsFor(mode: Mode, w: { code: number; temp: number; cloud: number } | null, k: number): Conditions {
  const kind: Kind = mode === 'live' ? (w ? describe(w.code).kind : 'clear') : mode === 'rain' ? 'rain' : mode === 'cloudy' ? 'overcast' : mode
  const label = mode === 'live' ? (w ? describe(w.code).label : 'Clear') : (MODES.find(m => m.mode === mode)?.label ?? '')
  const temp = mode === 'live' && w ? w.temp : mode === 'hot' ? 38 : mode === 'cold' || mode === 'snow' ? -2 : 16
  const wet = kind === 'rain' || kind === 'drizzle' || kind === 'storm'
  const outfit: Outfit = wet ? 'rain' : kind === 'snow' ? 'snow' : kind === 'hot' ? 'summer' : kind === 'cold' ? 'winter'
    : kind === 'fog' || kind === 'overcast' || kind === 'windy' ? 'jacket' : temp >= 24 ? 'summer' : temp >= 12 ? 'jacket' : 'winter'
  const base = mode === 'live' && w ? w.cloud : 20
  const cover = kind === 'storm' ? 100 : wet || kind === 'snow' ? 80 + 20 * k : kind === 'overcast' ? 30 + 70 * k : kind === 'fog' ? 90
    : kind === 'windy' ? 30 + 30 * k : kind === 'hot' ? 0 : kind === 'cold' ? 10 : Math.min(100, base * (0.6 + 0.6 * k))
  const grey = kind === 'storm' ? 0.95 : wet ? 0.5 + 0.4 * k : kind === 'snow' ? 0.45 + 0.35 * k : kind === 'overcast' ? 0.2 + 0.65 * k
    : kind === 'fog' ? 0.35 + 0.45 * k : kind === 'windy' ? 0.2 + 0.2 * k : kind === 'cold' ? 0.1 : kind === 'hot' ? 0 : (cover / 100) * 0.3
  const veiled = Math.max(0.15, 1 - grey * 0.9)
  const tint: [string, number] = kind === 'hot' ? ['#f2a45c', 0.15 + 0.45 * k] : kind === 'cold' ? ['#d6ecfb', 0.1 + 0.35 * k] : ['#000000', 0]
  return { kind, label, cover, grey, veiled, tint, outfit }
}

let seed = 1
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const n0 = (v: number) => Math.round(v)

export const WEATHER_CSS = `
.fall { animation: fall var(--fall, 1.1s) linear infinite; }
@keyframes fall { from { transform: translateY(0); } to { transform: translateY(1000px); } }
.flash { animation: flash 11s linear infinite; }
@keyframes flash { 0%, 91%, 93.5%, 100% { opacity: 0; } 92% { opacity: 0.35; } 93% { opacity: 0.08; } }
.gust { animation: gust var(--gust, 3s) linear infinite; }
@keyframes gust { from { transform: translateX(-1100px); } to { transform: translateX(1100px); } }
.drift { animation: drift var(--drift, 60s) linear infinite alternate; }
@keyframes drift { from { transform: translateX(-160px); } to { transform: translateX(160px); } }
.splash { transform-box: fill-box; transform-origin: center; animation: splash 1.4s ease-out infinite; }
@keyframes splash { 0% { transform: scale(0.2); opacity: 0.9; } 100% { transform: scale(1.8); opacity: 0; } }
.shimmer { animation: shimmer 4s ease-in-out infinite; }
@keyframes shimmer { 0% { transform: translateY(0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-120px); opacity: 0; } }
.sway { transform-box: view-box; transform-origin: 490px 1460px; animation: sway var(--sway-t, 3s) ease-in-out infinite alternate; }
@keyframes sway { from { transform: rotate(calc(var(--sway, 1deg) * -0.4)) skewX(calc(var(--skew, 0deg) * -0.3)); } to { transform: rotate(var(--sway, 1deg)) skewX(var(--skew, 0deg)); } }
.shiver { animation: shiver 0.12s linear infinite alternate; }
@keyframes shiver { from { transform: translateX(calc(var(--shiver, 0px) * -1)); } to { transform: translateX(var(--shiver, 0px)); } }
.brolly { transform-box: view-box; transform-origin: 706px 770px; animation: brolly var(--brolly-t, 2.6s) ease-in-out infinite alternate; }
@keyframes brolly { from { transform: rotate(calc(var(--brolly, 2deg) * -1)); } to { transform: rotate(var(--brolly, 2deg)); } }
.lid { transform-box: fill-box; transform-origin: center top; animation: blink 6s infinite; }
@keyframes blink { 0%, 94%, 100% { transform: scaleY(0); } 96.5% { transform: scaleY(1); } }
.tear { animation: tear 2.4s ease-in infinite; }
@keyframes tear { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(70px); opacity: 0; } }
.sweat { animation: sweat 3s ease-in infinite; }
@keyframes sweat { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 0.9; } 100% { transform: translateY(40px); opacity: 0; } }
.breath { transform-box: fill-box; transform-origin: left center; animation: breath 3.2s ease-out infinite; }
@keyframes breath { 0% { transform: scale(0.3); opacity: 0; } 25% { opacity: 0.8; } 100% { transform: scale(1.6) translateX(30px); opacity: 0; } }
.tremble { animation: tremble 0.25s linear infinite alternate; }
@keyframes tremble { from { transform: translateY(-1px); } to { transform: translateY(1px); } }
.leaf { animation: leaf var(--gust, 3s) linear infinite; }
@keyframes leaf { from { transform: translate(-1100px, 0) rotate(0deg); } to { transform: translate(1100px, -160px) rotate(720deg); } }
`

/** Rain, snow, fog, wind, heat haze or frost over the whole view, stronger as `k` grows. */
export function weatherLayer(c: Conditions, k: number, day: number, fogTone: string): string {
  seed = 7
  const parts: string[] = []
  const wet = c.kind === 'rain' || c.kind === 'drizzle' || c.kind === 'storm'
  const windy = c.kind === 'windy' || c.kind === 'storm'
  if (wet) {
    const count = n0((c.kind === 'drizzle' ? 40 : 60) + (c.kind === 'drizzle' ? 60 : 150) * k)
    const slant = 0.15 + 0.5 * k
    const d = Array.from({ length: count }, () => {
      const len = c.kind === 'drizzle' ? 14 : n0(24 + rnd() * 20 + 14 * k)
      return `M${n0(rnd() * 1300)} ${n0(rnd() * 1000)}l${-n0(len * slant)} ${len}`
    }).join('')
    const splashes = Array.from({ length: n0(6 + 18 * k) }, () => `<ellipse class="splash" style="animation-delay:-${(rnd() * 1.4).toFixed(2)}s" cx="${n0(rnd() * 1000)}" cy="${n0(880 + rnd() * 110)}" rx="9" ry="2.5" fill="none" stroke="#e8f1fb" stroke-width="1.6"/>`).join('')
    parts.push(`<rect y="860" width="1000" height="140" fill="url(#wet)" opacity="${(0.25 + 0.45 * k).toFixed(2)}"/>${splashes}`)
    parts.push(`<g class="fall" style="--fall:${(1.3 - 0.6 * k).toFixed(2)}s" stroke="#dfe8f5" stroke-width="${(1.1 + 0.8 * k).toFixed(1)}" stroke-linecap="round" opacity="${(0.3 + 0.35 * k).toFixed(2)}"><path d="${d}"/><path d="${d}" transform="translate(0 -1000)"/></g>`)
  }
  if (c.kind === 'snow') {
    const d = Array.from({ length: n0(40 + 130 * k) }, () => `M${n0(rnd() * 1000)} ${n0(rnd() * 1000)}h0`).join('')
    parts.push(`<g class="fall" style="--fall:${(16 - 9 * k).toFixed(1)}s" stroke="#ffffff" stroke-width="${(4 + 3 * k).toFixed(1)}" stroke-linecap="round" opacity="0.85"><path d="${d}"/><path d="${d}" transform="translate(0 -1000)"/></g>`)
  }
  if (windy || c.kind === 'snow' && k > 0.6) {
    const d = Array.from({ length: n0(6 + 26 * k) }, () => { const x = n0(rnd() * 1000), y = n0(rnd() * 900), l = n0(60 + rnd() * 120); return `M${x} ${y}q${n0(l / 2)} ${-n0(6 + rnd() * 8)} ${l} 0` }).join('')
    parts.push(`<g class="gust" style="--gust:${(3.4 - 1.8 * k).toFixed(2)}s" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="${(0.25 + 0.3 * k).toFixed(2)}"><path d="${d}"/></g>`)
    const leaves = Array.from({ length: n0(3 + 9 * k) }, (_, i) => `<path class="leaf" style="--gust:${(3 + rnd() * 2 - 1.5 * k).toFixed(2)}s;animation-delay:-${(rnd() * 4).toFixed(1)}s" transform-origin="0 0" d="M${n0(rnd() * 200)} ${n0(300 + rnd() * 650)}q8-10 18 0q-8 10-18 0z" fill="${i % 2 ? '#7c9a3c' : '#b8862f'}"/>`).join('')
    parts.push(leaves)
  }
  if (c.kind === 'fog') {
    // Thicker toward the ground, thinning into the sky, with soft banks drifting through.
    parts.push(`<linearGradient id="fogfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fogTone}" stop-opacity="${(0.1 + 0.3 * k).toFixed(2)}"/><stop offset="0.45" stop-color="${fogTone}" stop-opacity="${(0.25 + 0.45 * k).toFixed(2)}"/><stop offset="1" stop-color="${fogTone}" stop-opacity="${(0.45 + 0.45 * k).toFixed(2)}"/></linearGradient><radialGradient id="fogbank"><stop offset="0" stop-color="${fogTone}" stop-opacity="0.85"/><stop offset="1" stop-color="${fogTone}" stop-opacity="0"/></radialGradient>`)
    parts.push(`<rect width="1000" height="1000" fill="url(#fogfade)"/>`)
    parts.push(Array.from({ length: n0(3 + 4 * k) }, (_, i) => `<ellipse class="drift" style="--drift:${60 + i * 13}s;animation-delay:-${i * 17}s" cx="${n0(rnd() * 1000)}" cy="${n0(420 + rnd() * 480)}" rx="${n0(260 + rnd() * 220)}" ry="${n0(45 + rnd() * 50)}" fill="url(#fogbank)" opacity="${(0.4 + 0.5 * k).toFixed(2)}"/>`).join(''))
  }
  if (c.kind === 'hot') {
    const d = Array.from({ length: n0(6 + 16 * k) }, () => { const x = n0(rnd() * 1000), y = n0(700 + rnd() * 250); return `M${x} ${y}c6-10-6-20 0-30s-6-20 0-30` }).join('')
    parts.push(`<g class="shimmer" fill="none" stroke="#fff4dc" stroke-width="2" opacity="${(0.2 + 0.4 * k).toFixed(2)}"><path d="${d}"/></g>`)
    parts.push(`<rect width="1000" height="1000" fill="url(#heat)" opacity="${(0.2 + 0.5 * k).toFixed(2)}"/>`)
  }
  if (c.kind === 'cold' || c.kind === 'snow') {
    parts.push(`<rect width="1000" height="1000" fill="url(#frost)" opacity="${(0.15 + 0.6 * k).toFixed(2)}"/>`)
  }
  const flash = c.kind === 'storm' ? '<rect class="flash" width="100" height="100" fill="#e8eeff" opacity="0"/>' : ''
  void day
  return (parts.length ? `<svg x="0" y="0" width="100" height="100" viewBox="0 0 1000 1000" preserveAspectRatio="none">${parts.join('')}</svg>` : '') + flash
}

export const WEATHER_DEFS = `<radialGradient id="heat" cx="0.5" cy="1" r="0.9"><stop offset="0" stop-color="#ff9a3d" stop-opacity="0.55"/><stop offset="1" stop-color="#ff9a3d" stop-opacity="0"/></radialGradient>
<linearGradient id="wet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c7d6" stop-opacity="0"/><stop offset="1" stop-color="#d9e4ef" stop-opacity="0.6"/></linearGradient>
<radialGradient id="frost" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#eaf6ff" stop-opacity="0"/><stop offset="1" stop-color="#eaf6ff" stop-opacity="0.95"/></radialGradient>`

/**
 * The character at the window, in the coordinates of the source images (the figure spans x 225
 * to 745 and y 15 to 1465; the canopy of an open umbrella reaches above and to the right).
 * `level` is the mood: 0 a broad smile, 5 tears.
 */
export function character(c: Conditions, k: number, level: number, day: number): string {
  const o = HERO[c.outfit]
  const wet = c.kind === 'rain' || c.kind === 'drizzle' || c.kind === 'storm'
  const windy = c.kind === 'windy' || c.kind === 'storm'
  const sad = [0, 0, 0.15, 0.55, 0.9, 1][level] ?? 1
  const brows = `<path d="M440 ${n0(117 + 3 * sad)}Q456 ${n0(109 - 2 * sad)} 474 ${n0(113 - 9 * sad)}M503 ${n0(113 - 9 * sad)}Q520 ${n0(109 - 2 * sad)} 536 ${n0(117 + 3 * sad)}" fill="none" stroke="#24150e" stroke-width="6" stroke-linecap="round"/>`
  const eyeRy = level === 0 ? 4.5 : 6.5 - sad
  const look = 1.5 * sad
  const eye = (x: number) => `<ellipse cx="${x}" cy="134" rx="10" ry="${eyeRy.toFixed(1)}" fill="#fffaf4"/><circle cx="${x}" cy="${(134 + look).toFixed(1)}" r="5.2" fill="#3a2215"/><circle cx="${x}" cy="${(134 + look).toFixed(1)}" r="2.6" fill="#0d0705"/><circle cx="${x + 2}" cy="${(132 + look).toFixed(1)}" r="1.4" fill="#ffffff"/>`
  const lids = `<ellipse class="lid" cx="458" cy="128" rx="11" ry="12" fill="${o.skin}"/><ellipse class="lid" cx="517" cy="128" rx="11" ry="12" fill="${o.skin}"/>`
  const mouths = [
    `<path d="M463 182Q492 189 521 182Q511 206 492 207Q473 206 463 182Z" fill="#5e1f1c"/><path d="M468 184Q492 190 516 184Q514 189 510 190Q492 193 474 190Q470 189 468 184Z" fill="#f4ece4"/><path d="M478 200Q492 195 506 200Q499 205 492 205Q485 205 478 200Z" fill="#c4544c"/><path d="M461 181Q492 190 523 181" fill="none" stroke="#6b2f25" stroke-width="3" stroke-linecap="round"/><path d="M466 194Q492 214 518 194" fill="none" stroke="#a85a40" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>`,
    `<path d="M464 185Q492 203 520 185" fill="none" stroke="#6b2f25" stroke-width="4.5" stroke-linecap="round"/>`,
    `<path d="M468 192Q492 196 516 192" fill="none" stroke="#6b2f25" stroke-width="4.5" stroke-linecap="round"/>`,
    `<path d="M468 196Q492 188 516 196" fill="none" stroke="#6b2f25" stroke-width="4.5" stroke-linecap="round"/>`,
    `<path d="M465 200Q492 182 519 200" fill="none" stroke="#6b2f25" stroke-width="5" stroke-linecap="round"/>`,
    `<path class="tremble" d="M463 203Q492 180 521 203Q492 192 463 203Z" fill="#5d2420"/>`,
  ]
  const face = `<path d="M490 150q-5 15 2 19" fill="none" stroke="#c46a40" stroke-width="3" stroke-linecap="round" opacity="0.6"/>${eye(458)}${eye(517)}${lids}${brows}${mouths[level] ?? mouths[5]}`
    + (level >= 5 ? `<path class="tear" d="M452 142q-4 8 0 11q4-3 0-11z" fill="#9fd4ff"/><path class="tear" style="animation-delay:-1.2s" d="M523 142q-4 8 0 11q4-3 0-11z" fill="#9fd4ff"/>` : '')
    + (c.kind === 'hot' && k > 0.35 ? `<ellipse cx="452" cy="160" rx="13" ry="7" fill="#e8573a" opacity="${(0.25 * k).toFixed(2)}"/><ellipse cx="530" cy="160" rx="13" ry="7" fill="#e8573a" opacity="${(0.25 * k).toFixed(2)}"/><path class="sweat" d="M470 98q-5 9 0 12q5-3 0-12z" fill="#bfe6ff"/>` + (k > 0.6 ? `<path class="sweat" style="animation-delay:-1.4s" d="M540 112q-5 9 0 12q5-3 0-12z" fill="#bfe6ff"/>` : '') : '')
    + ((c.kind === 'cold' || c.kind === 'snow') && k > 0.3 ? `<ellipse class="breath" cx="535" cy="198" rx="22" ry="12" fill="#ffffff"/>` : '')
  const body = `<g transform="translate(225 15) scale(${(520 / o.w).toFixed(3)})">${o.body}</g><g transform="translate(395 15) scale(${(205 / o.hw).toFixed(3)})">${o.head}</g><g transform="translate(280 1360) scale(${(440 / o.fw).toFixed(3)})">${o.feet}</g>${face}`
  // Open umbrella in the rain, held in the right hand and tipped by the wind.
  const umbrella = wet
    ? `<g class="brolly" style="--brolly:${(2 + 9 * k).toFixed(1)}deg;--brolly-t:${(2.8 - 1.4 * k).toFixed(2)}s"><path d="M704 752L612 -40" stroke="#2a2a2a" stroke-width="9" stroke-linecap="round"/>
<path d="M380 70Q392 -100 612 -112Q832 -100 844 70Q789 46 734 70Q679 46 612 70Q545 46 490 70Q435 46 380 70Z" fill="#174a4d"/><path d="M612 -112Q560 -10 490 70M612 -112Q664 -10 734 70M612 -112V70" fill="none" stroke="#0f3537" stroke-width="5"/><path d="M420 30Q470 -80 612 -100" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.18"/></g>`
    : ''
  const sway = windy ? 0.6 + 2.6 * k : wet ? 0.4 + 1.2 * k : 0.3
  const skew = windy ? 1 + 4 * k : 0
  const shiver = (c.kind === 'cold' || c.kind === 'snow') && k > 0.5 ? (k - 0.5) * 6 : 0
  const dim = (0.55 + 0.45 * day).toFixed(2)
  return `<g style="filter:brightness(${dim})"><g class="sway" style="--sway:${sway.toFixed(1)}deg;--skew:${skew.toFixed(1)}deg;--sway-t:${(3.2 - 1.6 * (windy ? k : 0)).toFixed(2)}s"><g class="shiver" style="--shiver:${shiver.toFixed(1)}px">${body}</g>${umbrella}</g></g>`
}

/** The mood for how full the context window is: a broad smile while it is roomy, tears near the end. */
export function moodFor(percent: number): number {
  return percent < 30 ? 0 : percent < 50 ? 1 : percent < 65 ? 2 : percent < 80 ? 3 : percent < 92 ? 4 : 5
}
