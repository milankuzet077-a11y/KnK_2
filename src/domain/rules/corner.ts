import type { CatalogElement } from '../catalog/catalogTypes'
import type { PlacedItem } from '../types'

export type CornerHandedness = 'left' | 'right'
export type CornerCategory = 'base' | 'wall'

export function isCornerType(type: string): boolean {
  return type === 'corner' || type.includes('ugao') || type.includes('corner')
}

function normalizeCornerHandedness(raw: unknown): CornerHandedness | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const s = raw.toLowerCase()
  if (s.includes('left') || s.includes('lijev') || s.includes('lev')) return 'left'
  if (s.includes('right') || s.includes('desn')) return 'right'
  return null
}

function normalizeCornerCategory(raw: unknown): CornerCategory | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const s = raw.toLowerCase()
  if (s === 'base' || s.includes('donji')) return 'base'
  if (s === 'wall' || s.includes('gornji') || s.includes('vise') || s.includes('visi')) return 'wall'
  return null
}

export function readCornerHandedness(el: Pick<CatalogElement, 'cornerHandedness'>): CornerHandedness | null {
  return normalizeCornerHandedness(el.cornerHandedness)
}

export function readCornerCategory(el: Pick<CatalogElement, 'category'>): CornerCategory | null {
  return normalizeCornerCategory(el.category)
}

export function readPlacedCornerHandedness(item: Pick<PlacedItem, 'cornerHandedness'>): CornerHandedness | null {
  return normalizeCornerHandedness(item.cornerHandedness)
}

export function readPlacedCornerCategory(item: Pick<PlacedItem, 'category'>): CornerCategory | null {
  return normalizeCornerCategory(item.category)
}
