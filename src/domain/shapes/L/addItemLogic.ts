import type { PlacedItem, Walls } from '../../types'
import type { CatalogItemLike } from '../common/catalogItemHelpers'
import { createPlacedItem, type WallKey } from '../common/createPlacedItem'
import { tryPlaceItemL } from './placementLogic'

export type AddItemResult =
  | { ok: true; item: PlacedItem }
  | { ok: false; message: string }

export function tryAddItemL(params: {
  walls: Walls
  placedItems: PlacedItem[]
  catalogItem: CatalogItemLike
  targetWall: 'A' | 'B'
  uniqueId: string
}): AddItemResult {
  const { walls, placedItems, catalogItem, targetWall, uniqueId } = params

  const result = tryPlaceItemL({
    walls,
    placedItems,
    catalogItem,
    targetWall,
  })

  if (!result.ok) return { ok: false, message: result.message }

  const item = createPlacedItem({
    uniqueId,
    catalogItem,
    x: result.x,
    wallKey: result.wall as WallKey,
  })

  return { ok: true, item }
}
