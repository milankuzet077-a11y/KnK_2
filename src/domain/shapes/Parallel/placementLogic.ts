// src/domain/shapes/Parallel/placementLogic.ts
// Shape "Parallel" – dva zida (A i B) jedan naspram drugog.
// Logika je identična kao za "I", ali se primenjuje kontekstualno na izabrani zid.

import type { PlacedItem, Walls } from '../../types'
import type { CatalogItemLike } from '../common/catalogItemHelpers'

export type ParallelPlacementResult =
  | { ok: true; x: number }
  | { ok: false; message: string }

export function parseDim(val: number | undefined) {
  return Number(val || 0)
}

const TOLERANCE_MM = 2

function getPlacedType(item: PlacedItem): string {
  return String(item.catalogId || '')
}

function getCatalogType(catalogItem: CatalogItemLike): string {
  return String(catalogItem?.type || '')
}

function getCatalogWidth(catalogItem: CatalogItemLike): number {
  const w = catalogItem?.dims?.w ?? catalogItem?.width
  const n = Number(w ?? 0)
  return Number.isFinite(n) ? n : 0
}

function isBase(t: string) { return t === 'base' }
function isWall(t: string) { return t === 'wall' }
function isTall(t: string) { return t === 'tall' }
function isCornerCatalog(t: string, catalogItem: CatalogItemLike) {
  return t === 'corner' || String(catalogItem?.tip || '').toLowerCase() === 'ugao'
}

// Helper za dobijanje wallKey-a (fallback na 'A')
function getItemWallKey(item: PlacedItem): string {
  return item.wallKey || 'A'
}

// --------------------------------------------------
// KURSORI (Reusable logic from I, scoped to list)
// --------------------------------------------------
export function calculateCursorsForList(items: PlacedItem[]) {
  const sorted = [...items].sort((a, b) => a.x - b.x)

  let cBase = 0
  let cWall = 0

  for (const it of sorted) {
    const start = it.x
    const end = it.x + it.width
    const t = getPlacedType(it)

    if (isBase(t) || isTall(t)) {
      if (start <= cBase + TOLERANCE_MM) cBase = Math.max(cBase, end)
    }

    if (isWall(t) || isTall(t)) {
      if (start <= cWall + TOLERANCE_MM) cWall = Math.max(cWall, end)
    }
  }

  return { cBase, cWall }
}

// ------------------------------------------------------------
// Parallel shape: pozicioniranje novog elementa
// - Zahteva targetWall ('A' ili 'B')
// ------------------------------------------------------------
export function tryPlaceItemParallel(params: {
  walls: Walls
  placedItems: PlacedItem[]
  catalogItem: CatalogItemLike
  targetWall: 'A' | 'B'
}): ParallelPlacementResult {
  const { walls, placedItems, catalogItem, targetWall } = params

  // 1. Odredi dužinu aktivnog zida
  const wallLen = parseDim(targetWall === 'B' ? walls.B : walls.A)
  
  const width = getCatalogWidth(catalogItem)
  const type = getCatalogType(catalogItem)

  if (!width || width <= 0) {
    return { ok: false, message: 'Neispravna širina elementa.' }
  }

  // U Parallel kuhinji (kao i u I) nema uglova u klasičnom smislu povezivanja zidova
  if (isCornerCatalog(type, catalogItem)) {
    return { ok: false, message: 'Uglovi nisu dozvoljeni u Parallel rasporedu (koristite ravne elemente).' }
  }

  const isViseci = isWall(type)
  const isVisoki = isTall(type)

  // 2. Filtriraj samo elemente koji su na ciljanom zidu
  const itemsOnThisWall = placedItems.filter(it => getItemWallKey(it) === targetWall)

  // 3. Izračunaj kursore samo za taj zid
  const cursors = calculateCursorsForList(itemsOnThisWall)

  let activeCursorX = 0
  if (isVisoki) activeCursorX = Math.max(cursors.cBase, cursors.cWall)
  else activeCursorX = isViseci ? cursors.cWall : cursors.cBase

  // 4. Provera kolizija na istom zidu
  let minDist = Infinity

  for (const e of itemsOnThisWall) {
    const eType = getPlacedType(e)
    const eViseci = isWall(eType)
    const eVisoki = isTall(eType)

    let isObstacle = false

    if (isVisoki) {
      isObstacle = true
    } else if (isViseci) {
      isObstacle = eViseci || eVisoki
    } else {
      isObstacle = !eViseci || eVisoki
    }

    if (!isObstacle) continue

    const dist = e.x - activeCursorX
    if (dist > -0.1 && dist < width - 0.1) {
      if (dist < minDist) minDist = dist
    }
  }

  if (minDist !== Infinity) {
    const distDisplay = Math.max(0, Math.floor(minDist / 10))
    return {
      ok: false,
      message: `Nema dovoljno mesta na zidu ${targetWall}!\nPreostalo do prepreke: ${distDisplay} cm.`,
    }
  }

  if (activeCursorX + width > wallLen) {
    const preostalo = Math.max(0, Math.floor((wallLen - activeCursorX) / 10))
    return {
      ok: false,
      message: `Nema dovoljno mesta na zidu ${targetWall}!\nPreostalo prostora: ${preostalo} cm.`,
    }
  }

  return { ok: true, x: activeCursorX }
}