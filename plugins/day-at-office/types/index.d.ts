/** The context window as last measured: tokens in use, the window's size, and the share used (0 to 100). */
export type Sky = { used: number | null; window: number; percent: number }

/** The city the sky follows: where it is, and its offset from UTC and zone abbreviation right now. */
export type Place = { name: string; lat: number; lon: number; offsetSec: number; tz: string }

/** Current conditions there: WMO weather code, temperature in °C, cloud cover in %, and when it was read. */
export type Weather = { code: number; temp: number; cloud: number; at: number }

/** A city to follow: its name, a longer label to tell namesakes apart, and where it is. A country offered in the search carries `capitalOf` until its capital is looked up. */
export type City = { name: string; label: string; lat: number; lon: number; capitalOf?: { capital: string; code: string } }

/** The city search box: what has been typed, the matches for it, and a line about them. */
export type Search = { query: string; results: City[]; note: string }

declare module 'claude-code' {
  interface PluginState {
    'day-at-office': { sky: Sky | null; now: number | null; place: Place | null; weather: Weather | null; search: Search; mode: string }
  }
}
