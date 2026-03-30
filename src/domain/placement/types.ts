import type { CatalogItemLike } from '../shapes/common/catalogItemHelpers'
import type { KitchenShape, PlacedItem, Walls } from '../types'

export type WallKey = 'A' | 'B' | 'C'

export type PlaceCatalogItem = CatalogItemLike

export interface PlaceItemInput {
  shape: KitchenShape
  walls: Walls
  placedItems: PlacedItem[]
  catalogItem: PlaceCatalogItem
  targetWall?: WallKey
  uniqueId: string
}

export type PlaceItemResult =
  | { ok: true; item: PlacedItem }
  | { ok: false; message?: string }

export type LayoutValidationResult =
  | { ok: true }
  | { ok: false; message: string }
