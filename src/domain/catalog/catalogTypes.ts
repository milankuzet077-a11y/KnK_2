export type CatalogId = 'base' | 'wall' | 'tall' | 'corner' | 'accessories'

export type Vec3 = { x: number; y: number; z: number }

export type ElementDims = {
  w: number
  h: number
  d: number
}

export type CatalogElement = {
  id: string
  sku?: string
  name: string
  type: CatalogId
  dims: ElementDims
  price?: number
  promoPrice?: number
  category?: string
  cornerHandedness?: 'left' | 'right'
  tip?: string
  mountingHeight?: number
  glb: string
  thumbnail?: string
  tags?: string[]
  worktop?: {
    armAmm?: number
    armBmm?: number
    extraCoverMm?: number
  }
}

export type CatalogDefaults = Record<string, unknown>

export type CatalogFile = {
  catalogId: CatalogId
  version?: string
  defaults?: CatalogDefaults
  items: CatalogElement[]
}


export function getCatalogKind(item: Pick<CatalogElement, "type" | "tip">): string {
  return String(item.type ?? item.tip ?? '').toLowerCase()
}

export function isCornerCatalogElement(item: Pick<CatalogElement, "type" | "tip">): boolean {
  const kind = getCatalogKind(item)
  return kind === 'corner' || kind.includes('ugao') || kind.includes('corner')
}
