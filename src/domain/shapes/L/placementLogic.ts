import type { PlacedItem, Walls } from '../../types'
import type { CatalogItemLike } from '../common/catalogItemHelpers'
import { tryPlaceItemI, parseDim } from '../I/placementLogic'
import { isCornerType, readCornerCategory, readCornerHandedness, readPlacedCornerCategory, readPlacedCornerHandedness } from '../../rules/corner'

export type LCornersGateResult =
  | { ok: true }
  | { ok: false; message: string }

export type LPlacementResult =
  | { ok: true; x: number; wall: 'A' | 'B' }
  | { ok: false; message: string }

const WALL_THICKNESS_OFFSET = 0

type CornerSource = Pick<PlacedItem, 'catalogId' | 'category' | 'cornerHandedness' | 'wallKey' | 'width' | 'depth'>
type CatalogCornerSource = CatalogItemLike

function readCornerType(item: CornerSource | CatalogCornerSource): string {
  return String(('type' in item ? item.type : item.catalogId) ?? '').toLowerCase()
}

function isCornerCatalogItem(catalogItem: CornerSource | CatalogCornerSource): boolean {
  return isCornerType(readCornerType(catalogItem))
}

function getCornerCategoryFromCatalogItem(catalogItem: CornerSource | CatalogCornerSource): 'base' | 'wall' | null {
  return 'type' in catalogItem ? readCornerCategory(catalogItem) : readPlacedCornerCategory(catalogItem)
}

function getCornerHandedness(item: CornerSource | CatalogCornerSource): 'left' | 'right' | null {
  return 'type' in item ? readCornerHandedness(item) : readPlacedCornerHandedness(item)
}

function hasPlacedCorner(placedItems: PlacedItem[], category: 'base' | 'wall'): boolean {
  return placedItems.some((it) => isCornerCatalogItem(it) && getCornerCategoryFromCatalogItem(it) === category)
}

function getItemWallKey(item: PlacedItem): 'A' | 'B' {
  const wk = item.wallKey
  return wk === 'B' ? 'B' : 'A'
}

export function getLCornersState(placedItems: PlacedItem[]): { hasLower: boolean; hasUpper: boolean; ready: boolean } {
  const hasLower = hasPlacedCorner(placedItems, 'base')
  const hasUpper = hasPlacedCorner(placedItems, 'wall')
  return { hasLower, hasUpper, ready: hasLower && hasUpper }
}

export function enforceCornersFirstL(params: { placedItems: PlacedItem[]; catalogItem: CatalogItemLike }): LCornersGateResult {
  const { placedItems, catalogItem } = params
  const { hasLower, hasUpper } = getLCornersState(placedItems)
  const isCorner = isCornerCatalogItem(catalogItem)

  if (!isCorner) {
    const placingType = String(catalogItem?.type ?? '').toLowerCase()
    if (placingType === 'wall') {
      return hasUpper
        ? { ok: true }
        : { ok: false, message: 'Prvo morate dodati GORNJI ugaoni element da biste otključali gornje elemente.' }
    }

    return hasLower
      ? { ok: true }
      : { ok: false, message: 'Prvo morate dodati DONJI ugaoni element da biste otključali donje i visoke elemente.' }
  }

  const cornerCategory = getCornerCategoryFromCatalogItem(catalogItem)
  if (!cornerCategory) {
    return { ok: false, message: 'Nepoznata vrsta ugaonog elementa.' }
  }

  if (cornerCategory === 'base' && hasLower) {
    return { ok: false, message: 'Već je dodat DONJI ugaoni element.' }
  }
  if (cornerCategory === 'wall' && hasUpper) {
    return { ok: false, message: 'Već je dodat GORNJI ugaoni element.' }
  }

  return { ok: true }
}

export function tryPlaceItemL(params: {
  walls: Walls
  placedItems: PlacedItem[]
  catalogItem: CatalogItemLike
  targetWall: 'A' | 'B'
}): LPlacementResult {
  const { walls, placedItems, catalogItem, targetWall } = params

  const gate = enforceCornersFirstL({ placedItems, catalogItem })
  if (!gate.ok) {
    return { ok: false, message: gate.message }
  }

  const isCorner = isCornerCatalogItem(catalogItem)
  if (isCorner) {
    return { ok: true, x: 0, wall: 'A' }
  }

  const placingType = String(catalogItem?.type ?? '').toLowerCase()
  const cornerCat: 'base' | 'wall' = placingType === 'wall' ? 'wall' : 'base'

  const cornerItem = placedItems.find((it) => isCornerCatalogItem(it) && getCornerCategoryFromCatalogItem(it) === cornerCat)

  if (!cornerItem) {
    return { ok: false, message: 'Greška: Ugaoni element nije pronađen.' }
  }

  const handedness = getCornerHandedness(cornerItem)
  const cWidth = Number(cornerItem?.width || 0)
  const cDepth = Number(cornerItem?.depth || 0)

  let logicalObstacle = 0
  if (handedness === 'left') {
    logicalObstacle = targetWall === 'A' ? cWidth : cDepth
  } else if (handedness === 'right') {
    logicalObstacle = targetWall === 'A' ? cDepth : cWidth
  } else {
    logicalObstacle = targetWall === 'A' ? cWidth : cDepth
  }

  const visualOccupiedMm = logicalObstacle + WALL_THICKNESS_OFFSET
  const wallTotalMm = parseDim(targetWall === 'A' ? walls.A : walls.B)
  const effectiveWallLenMm = Math.max(0, wallTotalMm - logicalObstacle)

  const relevantItems = placedItems
    .filter((it) => getItemWallKey(it) === targetWall)
    .map((it) => ({
      ...it,
      x: it.x - visualOccupiedMm,
    }))
    .filter((it) => Number(it.x) > -1)

  if (targetWall === 'A') {
    relevantItems.forEach((it) => {
      it.x = it.x - it.width
    })
  }

  const placement = tryPlaceItemI({
    walls: { A: effectiveWallLenMm },
    placedItems: relevantItems,
    catalogItem,
  })

  if (!placement.ok) {
    return { ok: false, message: placement.message }
  }

  let finalX = placement.x + visualOccupiedMm
  const newItemWidth = Number(catalogItem?.dims?.w || 0)

  if (targetWall === 'A') {
    finalX += newItemWidth
  }

  if (targetWall === 'A') {
    if (finalX > wallTotalMm + WALL_THICKNESS_OFFSET) {
      return {
        ok: false,
        message: `Nema dovoljno mesta na zidu A.
Potrebno: ${Math.max(0, Math.floor((finalX - WALL_THICKNESS_OFFSET) / 10))} cm, Dostupno: ${Math.max(0, Math.floor(wallTotalMm / 10))} cm.`
      }
    }
  } else {
    if (finalX + newItemWidth > wallTotalMm + WALL_THICKNESS_OFFSET) {
      return {
        ok: false,
        message: `Nema dovoljno mesta na zidu B.
Potrebno: ${Math.max(0, Math.floor(((finalX + newItemWidth) - WALL_THICKNESS_OFFSET) / 10))} cm, Dostupno: ${Math.max(0, Math.floor(wallTotalMm / 10))} cm.`
      }
    }
  }

  return {
    ok: true,
    x: finalX,
    wall: targetWall
  }
}
