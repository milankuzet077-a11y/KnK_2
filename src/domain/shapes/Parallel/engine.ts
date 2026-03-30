import type { Walls, PlacedItem } from '../../types'
import type { CatalogItemLike } from '../common/catalogItemHelpers'
import { tryPlaceItemParallel } from './placementLogic'

export function placeItem(params: {
  walls: Walls
  placedItems: PlacedItem[]
  catalogItem: CatalogItemLike
  targetWall: 'A' | 'B'
}) {
  return tryPlaceItemParallel(params)
}
