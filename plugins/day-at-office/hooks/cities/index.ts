import { BENGALURU } from './bengaluru'
import { DELHI } from './delhi'
import { DUBAI } from './dubai'
import { LONDON } from './london'
import { MUMBAI_VIEW } from './mumbai'
import { NEW_YORK } from './new-york'
import { PARIS } from './paris'
import { SINGAPORE } from './singapore'
import { SYDNEY } from './sydney'
import { TOKYO } from './tokyo'
import type { CityScene } from './types'

export type { CityScene } from './types'
export { MUMBAI_VIEW } from './mumbai'

const BY_NAME: Record<string, CityScene> = {
  mumbai: MUMBAI_VIEW, bombay: MUMBAI_VIEW,
  delhi: DELHI, 'new delhi': DELHI,
  bengaluru: BENGALURU, bangalore: BENGALURU,
  london: LONDON, 'city of london': LONDON,
  paris: PARIS,
  'new york': NEW_YORK, 'new york city': NEW_YORK, manhattan: NEW_YORK,
  dubai: DUBAI,
  singapore: SINGAPORE,
  tokyo: TOKYO,
  sydney: SYDNEY,
}

/** The view for a city by name, if the theme has one. */
export function sceneFor(name: string): CityScene | undefined {
  return BY_NAME[name.trim().toLowerCase()]
}
