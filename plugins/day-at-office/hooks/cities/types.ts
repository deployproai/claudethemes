/**
 * A city's view from the office window, in its own coordinates (`width` by `height`). `paths` is the
 * whole view traced, `landmarks` the landmarks traced again more finely on top. `tower` is where the
 * glass tower on the right begins, `horizon` the skyline's height as a share of the picture, and
 * `skyline` the outline of the city against the sky, which the haze is clipped to.
 */
export type CityScene = {
  width: number
  height: number
  tower: number
  horizon: number
  skyline: string
  paths: string
  landmarks: string
  /** The tower's outline where it is not a plain upright edge. */
  towerPath?: string
  /** How high the sun and moon sit at rising, as a percentage of the backdrop. */
  arcBase?: number
}
