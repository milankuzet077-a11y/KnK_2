import type { Material, Mesh, Object3D, Texture } from 'three'

/*
 * Putanja: src/engine3d/shared.ts
 *
 * Pomoćni fajl za čišćenje materijala, tekstura i geometrije.
 * Ne menja direktno izgled scene, ali je važan da stare teksture i materijali
 * ne ostanu u memoriji i ne prave čudno ponašanje pri ponovnom renderovanju.
 */
import type { PlacedItem, WallKey } from '../domain/types'
import type { WorktopVirtualItem } from '../domain/shapes/shared/worktopVirtual'

export type RenderableItem = PlacedItem | WorktopVirtualItem

export type DisposableUserData = Object3D['userData'] & { __disposable?: boolean; id?: string }
export type DisposableObject3D = Object3D & { userData: DisposableUserData }

type TextureMapKey =
  | 'map'
  | 'aoMap'
  | 'emissiveMap'
  | 'metalnessMap'
  | 'roughnessMap'
  | 'normalMap'
  | 'bumpMap'
  | 'displacementMap'
  | 'alphaMap'
  | 'envMap'
  | 'lightMap'

type TextureBearingMaterial = Material & Partial<Record<TextureMapKey, Texture | null>>

// Spisak svih tipova mapa koje materijal može da nosi i koje moramo pravilno da oslobodimo.
const TEXTURE_KEYS: TextureMapKey[] = [
  'map',
  'aoMap',
  'emissiveMap',
  'metalnessMap',
  'roughnessMap',
  'normalMap',
  'bumpMap',
  'displacementMap',
  'alphaMap',
  'envMap',
  'lightMap',
]

export function markDisposable<T extends Object3D>(obj: T): T {
  const disposable = obj as DisposableObject3D
  disposable.userData = { ...disposable.userData, __disposable: true }
  return obj
}

export function isMeshObject(obj: Object3D): obj is Mesh {
  return (obj as Mesh).isMesh === true
}

export function isDisposableObject(obj: Object3D): obj is DisposableObject3D {
  return Boolean((obj as DisposableObject3D).userData?.__disposable)
}

export function isVirtualWorktopItem(item: RenderableItem): item is WorktopVirtualItem {
  return item.catalogId === '__virtual__' && (item as WorktopVirtualItem).__virtualType === 'worktop'
}

export function getWallKey(item: Pick<RenderableItem, 'wallKey'>): WallKey {
  return item.wallKey === 'B' || item.wallKey === 'C' ? item.wallKey : 'A'
}

export function getObjectSelectionId(obj: Object3D): string | null {
  const id = (obj.userData as DisposableUserData | undefined)?.id
  return typeof id === 'string' && id.length > 0 ? id : null
}

// Bezbedno oslobađa sve teksture i sam materijal kada element nestane iz scene.
function disposeMaterial(mat: Material) {
  const textureMat = mat as TextureBearingMaterial
  for (const key of TEXTURE_KEYS) {
    const texture = textureMat[key]
    if (texture && typeof texture.dispose === 'function') {
      try {
        texture.dispose()
      } catch {}
    }
  }
  try {
    mat.dispose()
  } catch {}
}

export function disposeDisposableSubtree(root: Object3D) {
  root.traverse((obj) => {
    if (!isDisposableObject(obj)) return
    if (isMeshObject(obj) && obj.geometry && typeof obj.geometry.dispose === 'function') {
      try {
        obj.geometry.dispose()
      } catch {}
    }
    if (isMeshObject(obj) && obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      materials.forEach(disposeMaterial)
    }
  })
}

export function addReadableEdges(_root: Object3D, _profile?: unknown) {
  // Edge overlay uklonjen: ne dodajemo dekorativne linije preko ivica modela.
}

export function setDecorativeEdgesState(_root: Object3D, _settings: { enabled: boolean; opacity?: number }) {
  // No-op: edge overlay je uklonjen iz scene.
}

export function mmToM(mm: number | undefined): number {
  const value = Number(mm || 0)
  return Number.isFinite(value) && value > 0 ? value / 1000 : 0
}
