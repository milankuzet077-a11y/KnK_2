import type { PlacedItem, Walls } from '../../types'
import type { CatalogItemLike } from '../common/catalogItemHelpers'
import { createPlacedItem, type WallKey } from '../common/createPlacedItem'
import { tryPlaceItemParallel } from './placementLogic'

export type AddItemResult =
  | { ok: true; item: PlacedItem }
  | { ok: false; message: string }

export function tryAddItemParallel(params: {
  walls: Walls
  placedItems: PlacedItem[]
  catalogItem: CatalogItemLike
  targetWall: 'A' | 'B'
  uniqueId: string
}): AddItemResult {
  const { walls, placedItems, catalogItem, targetWall, uniqueId } = params

  const placement = tryPlaceItemParallel({
    walls,
    placedItems,
    catalogItem,
    targetWall,
  })

  if (!placement.ok) return { ok: false, message: placement.message }

  const item = createPlacedItem({
    uniqueId,
    catalogItem,
    x: placement.x,
    wallKey: targetWall as WallKey,
  })

  return { ok: true, item }
}
