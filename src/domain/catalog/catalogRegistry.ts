import type { CatalogId } from './catalogTypes'

export const CATALOGS: CatalogId[] = [
  'base',
  'wall',
  'tall',
  'corner'
]

export function catalogJsonPath(id: CatalogId) {
  // iz src/assets (bundlovano), ne iz public
  return new URL(`../../assets/catalog/catalogs/${id}/index.json`, import.meta.url).toString()
}
