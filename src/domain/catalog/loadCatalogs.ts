import type { CatalogElement, CatalogFile, CatalogId } from './catalogTypes'
import { CATALOGS, catalogJsonPath } from './catalogRegistry'

const perCatalogPromise = new Map<CatalogId, Promise<CatalogFile | null>>()
let allCatalogsPromise: Promise<{ catalogs: Record<CatalogId, CatalogFile>; items: CatalogElement[] }> | null = null

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function normalizeCatalogElement(raw: CatalogElement): CatalogElement {
  return {
    ...raw,
    dims: {
      w: toNumber(raw.dims?.w) ?? raw.dims.w,
      h: toNumber(raw.dims?.h) ?? raw.dims.h,
      d: toNumber(raw.dims?.d) ?? raw.dims.d,
    },
    price: toNumber(raw.price),
    promoPrice: toNumber(raw.promoPrice),
    mountingHeight: toNumber(raw.mountingHeight),
    worktop: raw.worktop
      ? {
          armAmm: toNumber(raw.worktop.armAmm),
          armBmm: toNumber(raw.worktop.armBmm),
          extraCoverMm: toNumber(raw.worktop.extraCoverMm),
        }
      : undefined,
  }
}

function normalizeCatalogFile(file: CatalogFile): CatalogFile {
  return { ...file, items: file.items.map(normalizeCatalogElement) }
}

async function loadOne(id: CatalogId): Promise<CatalogFile | null> {
  const existing = perCatalogPromise.get(id)
  if (existing) return existing

  const promise = (async () => {
    try {
      const res = await fetch(catalogJsonPath(id))
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${id}`)
      const json = (await res.json()) as CatalogFile
      if (!json || json.catalogId !== id || !Array.isArray(json.items)) {
        throw new Error(`Invalid catalog schema for ${id}`)
      }
      return normalizeCatalogFile(json)
    } catch {
      return null
    }
  })()

  perCatalogPromise.set(id, promise)
  return promise
}

export async function loadAllCatalogs(): Promise<{ catalogs: Record<CatalogId, CatalogFile>; items: CatalogElement[] }> {
  if (allCatalogsPromise) return allCatalogsPromise

  allCatalogsPromise = (async () => {
    const results = await Promise.all(CATALOGS.map(loadOne))
    const catalogs = {} as Record<CatalogId, CatalogFile>
    const items: CatalogElement[] = []

    for (const catalog of results) {
      if (!catalog) continue
      catalogs[catalog.catalogId] = catalog
      items.push(...catalog.items)
    }

    return { catalogs, items }
  })()

  return allCatalogsPromise
}
