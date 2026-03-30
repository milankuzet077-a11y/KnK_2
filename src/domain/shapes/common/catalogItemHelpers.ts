import type { CatalogElement } from '../../catalog/catalogTypes'

export type CatalogItemLike = CatalogElement & {
  width?: number
  depth?: number
  catalogId?: string
  elementId?: string
}

export function getCatalogWidthMm(item: CatalogItemLike): number {
  const w = item.dims?.w ?? item.width
  const n = Number(w ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function getCatalogDepthMm(item: CatalogItemLike): number {
  const d = item.dims?.d ?? item.depth
  const n = Number(d ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function getMountingHeightMm(item: CatalogItemLike): number | undefined {
  const n = Number(item.mountingHeight)
  return Number.isFinite(n) ? n : undefined
}

export function getEffectivePrice(item: CatalogItemLike): number {
  const base = Number(item.price ?? 0)
  const promo = Number(item.promoPrice ?? 0)
  if (Number.isFinite(promo) && promo > 0 && promo < base) return promo
  return Number.isFinite(base) ? base : 0
}

export function getCategory(item: CatalogItemLike): string | undefined {
  return typeof item.category === 'string' && item.category.length ? item.category : undefined
}

export function getCornerHandedness(item: CatalogItemLike): 'left' | 'right' | undefined {
  return item.cornerHandedness === 'left' || item.cornerHandedness === 'right' ? item.cornerHandedness : undefined
}
