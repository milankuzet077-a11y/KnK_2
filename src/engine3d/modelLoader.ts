import { Box3 } from 'three'
import type { Group, Mesh, Object3D } from 'three'
import { applyPlanarUvProjection } from './utils/uvProjection'
import type { RenderableItem } from './shared'

const MAX_MODEL_CACHE = 32
const modelCache = new Map<string, Group>()
const inFlightModelLoads = new Map<string, Promise<Group>>()

type GLTFLoaderModule = typeof import('three/examples/jsm/loaders/GLTFLoader.js')
type IndexJsonValue = Record<string, unknown> | unknown[] | null

const CATALOG_INDEX_URLS: Partial<Record<string, string>> = {
  base: new URL('../assets/catalog/catalogs/base/index.json', import.meta.url).toString(),
  wall: new URL('../assets/catalog/catalogs/wall/index.json', import.meta.url).toString(),
  tall: new URL('../assets/catalog/catalogs/tall/index.json', import.meta.url).toString(),
  corner: new URL('../assets/catalog/catalogs/corner/index.json', import.meta.url).toString(),
}

type IndexJsonRecord = Record<string, unknown>

type IndexEntry = {
  id?: unknown
  elementId?: unknown
  name?: unknown
  mountingHeightMm?: unknown
  mountingHeight?: unknown
  mountY?: unknown
  mount_y?: unknown
  y?: unknown
  mounting_height?: unknown
}

const INDEX_HEIGHT_KEYS = ['mountingHeightMm', 'mountingHeight', 'mountY', 'mount_y', 'y', 'mounting_height'] as const
const INDEX_LIST_KEYS = ['items', 'modules', 'elements', 'data'] as const

const moduleIndexCache = new Map<string, IndexJsonValue>()
const inFlightIndexLoads = new Map<string, Promise<IndexJsonValue>>()
let gltfLoaderPromise: Promise<InstanceType<GLTFLoaderModule['GLTFLoader']>> | null = null

async function getGltfLoader() {
  if (!gltfLoaderPromise) {
    gltfLoaderPromise = import('three/examples/jsm/loaders/GLTFLoader.js').then((mod) => new mod.GLTFLoader())
  }
  return gltfLoaderPromise
}

function normalizeCornerPivotToJoinXZ(group: Group) {
  const box = new Box3().setFromObject(group)
  const { min, max } = box
  if (!Number.isFinite(max.x) || !Number.isFinite(min.z)) return

  const shiftX = -max.x
  const shiftZ = -min.z
  group.children.forEach((child) => {
    child.position.x += shiftX
    child.position.z += shiftZ
  })
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function resolveUvOrientation(mesh: Mesh): 'front-vertical' | 'top-horizontal' | 'board-vertical' | 'board-horizontal' | null {
  const rawMeshName = String(mesh.name || '')
  const meshName = normalizeName(rawMeshName)
  const materialName = normalizeName(
    Array.isArray(mesh.material)
      ? String(mesh.material[0]?.name || '')
      : String(mesh.material?.name || ''),
  )

  if (meshName.includes('worktop') || materialName === 'worktop' || materialName === 'mesh_worktop') {
    return 'top-horizontal'
  }

  if (meshName.includes('mesh_front')) {
    return 'board-vertical'
  }

  if (
    meshName.includes('mesh_korpus_str')
    || meshName.includes('stranica')
    || meshName.includes('side')
    || meshName.includes('mesh_korpus_ledja')
    || meshName.includes('ledja')
    || meshName.includes('leda')
    || meshName.includes('back')
  ) {
    return 'board-vertical'
  }

  if (
    meshName.includes('mesh_korpus_pod')
    || meshName.includes('pod')
    || meshName.includes('mesh_korpus_polica')
    || meshName.includes('polica')
    || meshName.includes('shelf')
    || meshName.includes('mesh_korpus_vezna')
    || meshName.includes('vezna')
    || meshName.includes('brace')
    || meshName.includes('mesh_cokla')
    || meshName.includes('cokla')
    || meshName.includes('plinth')
    || materialName === 'mesh_cokla'
  ) {
    return 'board-horizontal'
  }

  if (materialName === 'mesh_front') return 'board-vertical'

  return null
}

function standardizeModelMeshes(group: Group) {
  group.traverse((child: Object3D) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true

    const orientation = resolveUvOrientation(mesh)
    if (!orientation) return

    mesh.geometry = mesh.geometry.clone()
    applyPlanarUvProjection(mesh, orientation)
  })
}

async function loadModelInternal(url: string): Promise<Group> {
  const cached = modelCache.get(url)
  if (cached) {
    modelCache.delete(url)
    modelCache.set(url, cached)
    return cached.clone()
  }

  const inflight = inFlightModelLoads.get(url)
  if (inflight) return (await inflight).clone()

  const promise = getGltfLoader()
    .then((loader) => new Promise<Group>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const scene = gltf.scene
          if (/\/corner\//.test(url)) normalizeCornerPivotToJoinXZ(scene)
          standardizeModelMeshes(scene)

          modelCache.set(url, scene)
          while (modelCache.size > MAX_MODEL_CACHE) {
            const oldestKey = modelCache.keys().next().value as string | undefined
            if (!oldestKey) break
            modelCache.delete(oldestKey)
          }

          resolve(scene)
        },
        undefined,
        reject,
      )
    }))
    .finally(() => {
      inFlightModelLoads.delete(url)
    })

  inFlightModelLoads.set(url, promise)
  return (await promise).clone()
}

export function loadModel(url: string): Promise<Group> {
  return loadModelInternal(url)
}

export function preloadModel(url: string): Promise<void> {
  return loadModelInternal(url).then(() => undefined)
}

function getModelUrlForItem(item: RenderableItem): string {
  const explicitUrl = String((item as RenderableItem & { glbUrl?: string }).glbUrl || '')
  if (explicitUrl) return explicitUrl
  if (String(item.catalogId || '') === '__virtual__') return ''
  return `/assets/glb/modules/${item.catalogId}/${item.elementId}.glb`
}

export function getModelAssetUrl(item: RenderableItem): string {
  return getModelUrlForItem(item)
}

export async function preloadModelsForItems(items: RenderableItem[]): Promise<void> {
  const urls = Array.from(
    new Set(
      items
        .map((item) => ({ item, glbUrl: getModelUrlForItem(item) }))
        .filter(({ item, glbUrl }) => String(item.catalogId || '') !== '__virtual__' && glbUrl && !glbUrl.includes('/handles/'))
        .map(({ glbUrl }) => glbUrl),
    ),
  )

  if (urls.length === 0) return
  await Promise.all(urls.map((url) => preloadModel(url)))
}

export async function preloadSceneAssetsForItems(items: RenderableItem[]): Promise<void> {
  const realItems = items.filter((item) => String(item.catalogId || '') !== '__virtual__')
  if (realItems.length === 0) return

  const preloadJobs: Promise<unknown>[] = [preloadModelsForItems(realItems)]
  const uniqueIndexes = Array.from(new Set(realItems.map((item) => String(item.catalogId || '')).filter(Boolean)))
  uniqueIndexes.forEach((catalogId) => {
    preloadJobs.push(getMountingHeightFromIndex(catalogId, ''))
  })

  await Promise.all(preloadJobs)
}

function asIndexRecord(value: unknown): IndexJsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as IndexJsonRecord) : null
}

function normalizeMaybeMm(value: unknown): number | null {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  if (numberValue > 0 && numberValue <= 10) return numberValue * 1000
  return numberValue
}

function readIndexHeight(value: unknown): number | null {
  const record = asIndexRecord(value)
  if (!record) return null
  for (const key of INDEX_HEIGHT_KEYS) {
    const normalized = normalizeMaybeMm(record[key])
    if (normalized !== null) return normalized
  }
  return null
}

function readIndexEntries(indexJson: IndexJsonValue): IndexEntry[] {
  if (Array.isArray(indexJson)) {
    return indexJson.filter((entry): entry is IndexEntry => Boolean(asIndexRecord(entry)))
  }
  const record = asIndexRecord(indexJson)
  if (!record) return []

  const entries: IndexEntry[] = []
  for (const key of INDEX_LIST_KEYS) {
    const items = record[key]
    if (!Array.isArray(items)) continue
    entries.push(...items.filter((entry): entry is IndexEntry => Boolean(asIndexRecord(entry))))
  }
  return entries
}

function extractMountingHeightMm(indexJson: IndexJsonValue, elementId: string): number | null {
  if (!indexJson) return null
  const directHeight = readIndexHeight(asIndexRecord(indexJson)?.[elementId])
  if (directHeight !== null) return directHeight

  const hit = readIndexEntries(indexJson).find((entry) => {
    return entry.id === elementId || entry.elementId === elementId || entry.name === elementId
  })
  const hitHeight = readIndexHeight(hit)
  if (hitHeight !== null) return hitHeight

  return readIndexHeight(indexJson)
}

export async function getMountingHeightFromIndex(catalogId: string, elementId: string): Promise<number | null> {
  const key = catalogId
  if (moduleIndexCache.has(key)) {
    return extractMountingHeightMm(moduleIndexCache.get(key) ?? null, elementId)
  }

  const inflight = inFlightIndexLoads.get(key)
  if (inflight) {
    return extractMountingHeightMm(await inflight, elementId)
  }

  const url = CATALOG_INDEX_URLS[catalogId]
  if (!url) {
    moduleIndexCache.set(key, null)
    return null
  }
  const promise = (async () => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        moduleIndexCache.set(key, null)
        return null
      }
      const json = (await response.json()) as IndexJsonValue
      moduleIndexCache.set(key, json)
      return json
    } catch {
      moduleIndexCache.set(key, null)
      return null
    }
  })().finally(() => {
    inFlightIndexLoads.delete(key)
  })

  inFlightIndexLoads.set(key, promise)
  return extractMountingHeightMm(await promise, elementId)
}
