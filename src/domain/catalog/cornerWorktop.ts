import cornerCatalogJson from '../../assets/catalog/catalogs/corner/index.json'
import type { CatalogElement, CatalogFile } from './catalogTypes'
import { WORKTOP_DEPTH_MM } from '../shapes/shared/worktopVirtual'

export type CornerCatalogElement = CatalogElement & {
  worktop?: {
    armAmm?: number
    armBmm?: number
    extraCoverMm?: number
  }
}

type CornerCatalogFile = CatalogFile & {
  items: CornerCatalogElement[]
}

const cornerCatalog = cornerCatalogJson as CornerCatalogFile

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function inferArmsFromDims(item: Pick<CornerCatalogElement, 'dims' | 'cornerHandedness'>): { armAmm: number; armBmm: number } {
  const width = toFiniteNumber(item.dims?.w) ?? 0
  const depth = toFiniteNumber(item.dims?.d) ?? 0
  const handedness = String(item.cornerHandedness ?? '').toLowerCase()

  if (handedness === 'right') {
    return {
      armAmm: depth || width,
      armBmm: width || depth,
    }
  }

  return {
    armAmm: width || depth,
    armBmm: depth || width,
  }
}

export type CornerWorktopMeta = {
  armAmm: number
  armBmm: number
  extraCoverMm: number
}

export function getCornerWorktopMetaByElementId(elementId: string): CornerWorktopMeta | null {
  const normalizedId = String(elementId ?? '').trim()
  if (!normalizedId) return null

  const item = cornerCatalog.items.find((entry) => String(entry.id) === normalizedId)
  if (!item || String(item.category ?? '').toLowerCase() !== 'base') return null

  const inferred = inferArmsFromDims(item)
  const armAmm = toFiniteNumber(item.worktop?.armAmm) ?? inferred.armAmm
  const armBmm = toFiniteNumber(item.worktop?.armBmm) ?? inferred.armBmm
  const smallestArm = Math.min(armAmm, armBmm)
  const extraCoverMm = toFiniteNumber(item.worktop?.extraCoverMm) ?? Math.max(0, smallestArm - WORKTOP_DEPTH_MM)

  return {
    armAmm: Math.max(0, Math.round(armAmm)),
    armBmm: Math.max(0, Math.round(armBmm)),
    extraCoverMm: Math.max(0, Math.round(extraCoverMm)),
  }
}
