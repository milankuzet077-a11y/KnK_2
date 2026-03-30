import type { PlacedItem, Walls } from '../../types'
import type { CatalogItemLike } from '../common/catalogItemHelpers'
import { createPlacedItem } from '../common/createPlacedItem'
import { tryPlaceItemI } from './placementLogic'

export type AddItemResult =
  | { ok: true; item: PlacedItem }
  | { ok: false; message: string }

/**
 * Shape I (straight) – dodavanje item-a na zid A.
 * Održava postojeće ponašanje: u placement se prosleđuju samo item-i sa zida A.
 */
export function tryAddItemI(params: {
  walls: Walls
  placedItems: PlacedItem[]
  catalogItem: CatalogItemLike
  uniqueId: string
}): AddItemResult {
  const { walls, placedItems, catalogItem, uniqueId } = params

  const placement = tryPlaceItemI({
    walls,
    placedItems,
    catalogItem,
  })

  if (!placement.ok) return { ok: false, message: placement.message }

  const item = createPlacedItem({
    uniqueId,
    catalogItem,
    x: placement.x,
    wallKey: 'A',
  })

  return { ok: true, item }
}
