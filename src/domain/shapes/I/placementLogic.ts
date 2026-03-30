// src/domain/shapes/I/placementLogic.ts
// Shape "I" (ravna kuhinja) – jedan zid (A) i linearno slaganje po X osi.
// Ovaj modul je bez UI/React zavisnosti.

import type { PlacedItem, Walls } from '../../types'
import type { CatalogItemLike } from '../common/catalogItemHelpers'

export type IPlacementResult =
  | { ok: true; x: number }
  | { ok: false; message: string }

// U tvom projektu Walls su broj u mm (optional), pa je ovo dovoljno.
export function parseDim(val: number | undefined) {
  return Number(val || 0)
}

const TOLERANCE_MM = 2

function getPlacedType(item: PlacedItem): string {
  // Kod tebe PlacedItem.catalogId se koristi kao tip: 'base' | 'wall' | 'tall'
  return String(item.catalogId || '')
}

function getCatalogType(catalogItem: CatalogItemLike): string {
  return String(catalogItem?.type || '')
}

function getCatalogWidth(catalogItem: CatalogItemLike): number {
  // U tvom katalogu width je catalogItem.dims.w
  const w = catalogItem?.dims?.w ?? catalogItem?.width
  const n = Number(w ?? 0)
  return Number.isFinite(n) ? n : 0
}

function isBase(t: string) {
  return t === 'base'
}
function isWall(t: string) {
  return t === 'wall'
}
function isTall(t: string) {
  return t === 'tall'
}
function isCornerCatalog(t: string, catalogItem: CatalogItemLike) {
  return t === 'corner' || String(catalogItem?.tip || '').toLowerCase() === 'ugao'
}

// --------------------------------------------------
// KURSORI (I oblik)
// --------------------------------------------------
// Kursor se pomera samo ako je niz neprekidan.
// Ako postoji rupa, kursor ostaje na početku rupe.
// NOTE: zadržavamo generičko ime (calculateCursors) da UI ne mora da zna za "I".
export function calculateCursors(items: PlacedItem[]) {
  const sorted = [...items].sort((a, b) => a.x - b.x)

  let cBase = 0
  let cWall = 0

  for (const it of sorted) {
    const start = it.x
    const end = it.x + it.width
    const t = getPlacedType(it)

    // DONJI NIZ (base + tall)
    if (isBase(t) || isTall(t)) {
      if (start <= cBase + TOLERANCE_MM) cBase = Math.max(cBase, end)
    }

    // GORNJI NIZ (wall + tall)
    if (isWall(t) || isTall(t)) {
      if (start <= cWall + TOLERANCE_MM) cWall = Math.max(cWall, end)
    }
  }

  return { cBase, cWall }
}

// --------------------------------------------------
// STATISTIKA (indikatori slobodnog prostora)
// --------------------------------------------------
// NOTE: zadržavamo generičko ime (calculateStats) da UI ne mora da zna za "I".
export function calculateStats(items: PlacedItem[], walls: Walls) {
  const totalA = parseDim(walls.A)

  let usedBase = 0
  let usedWall = 0

  for (const it of items) {
    const t = getPlacedType(it)
    if (isBase(t) || isTall(t)) usedBase += it.width
    if (isWall(t) || isTall(t)) usedWall += it.width
  }

  return {
    total: totalA,
    freeBase: Math.max(0, totalA - usedBase),
    freeWall: Math.max(0, totalA - usedWall),
  }
}

// ------------------------------------------------------------
// I shape: pozicioniranje novog elementa
// - radi samo sa zidom A
// - vraća samo X (UI gradi PlacedItem)
// ------------------------------------------------------------
export function tryPlaceItemI(params: {
  walls: Walls
  placedItems: PlacedItem[]
  catalogItem: CatalogItemLike
  // ostavljeno radi kompatibilnosti sa postojećim pozivima
  shape?: string
}): IPlacementResult {
  const { walls, placedItems, catalogItem } = params

  const wallLen = parseDim(walls.A)
  const width = getCatalogWidth(catalogItem)
  const type = getCatalogType(catalogItem)

  if (!width || width <= 0) {
    return { ok: false, message: 'Neispravna širina elementa.' }
  }

  // U I kuhinji nema uglova
  if (isCornerCatalog(type, catalogItem)) {
    return { ok: false, message: 'Uglovi nisu dozvoljeni u ravnoj (I) kuhinji!' }
  }

  const isViseci = isWall(type)
  const isVisoki = isTall(type)

  const cursors = calculateCursors(placedItems)

  let activeCursorX = 0
  if (isVisoki) activeCursorX = Math.max(cursors.cBase, cursors.cWall)
  else activeCursorX = isViseci ? cursors.cWall : cursors.cBase

  // prepreke na istoj "liniji" (base/tall ili wall/tall)
  let minDist = Infinity

  for (const e of placedItems) {
    const eType = getPlacedType(e)
    const eViseci = isWall(eType)
    const eVisoki = isTall(eType)

    let isObstacle = false

    if (isVisoki) {
      // tall smeta svemu
      isObstacle = true
    } else if (isViseci) {
      // wall smeta wall + tall
      isObstacle = eViseci || eVisoki
    } else {
      // base smeta base + tall
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
      message: `Nema dovoljno mesta!\nPreostalo do prepreke: ${distDisplay} cm.`,
    }
  }

  if (activeCursorX + width > wallLen) {
    const preostalo = Math.max(0, Math.floor((wallLen - activeCursorX) / 10))
    return {
      ok: false,
      message: `Nema dovoljno mesta u zidu!\nPreostalo prostora: ${preostalo} cm.`,
    }
  }

  return { ok: true, x: activeCursorX }
}

// Nema backward-compat aliasa ovde.
// UI treba direktno da uvozi iz src/domain/shapes/I/placementLogic.ts
