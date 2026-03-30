import type { PlacedItem } from '../../types'
import type { CatalogItemLike } from './catalogItemHelpers'
import { getCatalogWidthMm, getCatalogDepthMm, getMountingHeightMm, getEffectivePrice, getCategory, getCornerHandedness } from './catalogItemHelpers'

export type WallKey = 'A' | 'B' | 'C'

/**
 * Kreira PlacedItem iz kataloškog item-a i izračunate pozicije.
 * Nema UI/React zavisnosti.
 */
export function createPlacedItem(params: {
  uniqueId: string
  catalogItem: CatalogItemLike
  x: number
  wallKey: WallKey
}): PlacedItem {
  const { uniqueId, catalogItem, x, wallKey } = params

  const placed: PlacedItem = {
    uniqueId,
    catalogId: String(catalogItem.type),
    elementId: String(catalogItem.id),
    width: getCatalogWidthMm(catalogItem),
    depth: getCatalogDepthMm(catalogItem),
    mountingHeight: getMountingHeightMm(catalogItem),
    x,
    wallKey,
    // meta
    price: getEffectivePrice(catalogItem),
    category: getCategory(catalogItem),
    cornerHandedness: getCornerHandedness(catalogItem),
    decor: 'Bela',
    glbUrl: typeof catalogItem.glb === 'string' && catalogItem.glb.length ? catalogItem.glb : undefined,
  }

  return placed
}
