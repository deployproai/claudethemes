import { PHOTO_HEIGHT, PHOTO_PATHS, PHOTO_WIDTH } from '../photo'
import type { CityScene } from './types'

// The owner's own photograph of the view from their office window in Mumbai.
export const MUMBAI_VIEW: CityScene = {
  width: PHOTO_WIDTH, height: PHOTO_HEIGHT, tower: 477, horizon: 0.36, skyline: '',
  paths: PHOTO_PATHS, landmarks: '', towerPath: 'M477 0H560V504H486Z', arcBase: 50,
}
