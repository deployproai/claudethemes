/** The context window as last measured: tokens in use, the window's size, and the share used (0 to 100). */
export type Sky = { used: number | null; window: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    'new-year-sky': { sky: Sky | null; now: number | null }
  }
}
