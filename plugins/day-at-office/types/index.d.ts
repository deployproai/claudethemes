/** The context window as last measured: tokens in use, the window's size, and the share used (0 to 100). */
export type Sky = { used: number | null; window: number; percent: number }

/** The city the sky follows: where it is, and its offset from UTC and zone abbreviation right now. */
export type Place = { name: string; lat: number; lon: number; offsetSec: number; tz: string }

/** Current conditions there: WMO weather code, temperature in °C, cloud cover in %, and when it was read. */
export type Weather = { code: number; temp: number; cloud: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'day-at-office': { sky: Sky | null; now: number | null; place: Place | null; weather: Weather | null }
  }
}
