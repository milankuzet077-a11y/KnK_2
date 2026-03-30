import type { Walls, PlacedItem } from '../../types'
import type { CatalogItemLike } from '../common/catalogItemHelpers'
import { tryPlaceItemI } from './placementLogic'

export function placeItem(params: {
  walls: Walls
  placedItems: PlacedItem[]
  catalogItem: CatalogItemLike
  shape?: string
}) {
  return tryPlaceItemI(params)
}
