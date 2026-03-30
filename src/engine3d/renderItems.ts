import type { KitchenShape, Walls } from '../domain/types'
import { createVirtualItemMesh, positionModel } from './itemPlacement'
import type { RenderableItem } from './shared'
import { disposeDisposableSubtree } from './shared'
import type { SceneRuntime } from './sceneRuntime'
import type { OptionsValues } from '../ui/options/types'
import type { Subcat } from '../ui/step3/types'
import { syncSelection } from './selection'

const DEFAULT_WALL_MODULE_HEIGHT_MM = 1450
const MODEL_LOAD_CONCURRENCY = 4

type RenderItemsParams = {
  runtime: SceneRuntime
  items: RenderableItem[]
  optionsValues?: OptionsValues
  shape: KitchenShape
  walls: Walls
  selectedId?: string | null
  activeElementsSubcat?: Subcat
}

function getDefaultMountingHeightMm(item: RenderableItem): number {
  return item.catalogId === 'wall' ? DEFAULT_WALL_MODULE_HEIGHT_MM : 0
}

const modelLoaderModulePromise = import('./modelLoader')

async function loadModelAsset(url: string) {
  const mod = await modelLoaderModulePromise
  return mod.loadModel(url)
}

async function getIndexedMountingHeight(catalogId: string, elementId: string) {
  const mod = await modelLoaderModulePromise
  return mod.getMountingHeightFromIndex(catalogId, elementId)
}

async function getModelUrl(item: RenderableItem) {
  const mod = await modelLoaderModulePromise
  return mod.getModelAssetUrl(item)
}

export function renderSceneItems({ runtime, items, optionsValues, shape, walls, selectedId, activeElementsSubcat }: RenderItemsParams): () => void {
  const { itemsGroup, requestRender, syncQuality } = runtime

  try {
    disposeDisposableSubtree(itemsGroup)
  } catch {}
  itemsGroup.clear()

  if (items.length === 0) {
    syncSelection(runtime, selectedId)
    syncQuality()
    requestRender()
    return () => {}
  }

  const wallAMm = Number(walls.A || 0)

  items.forEach((item) => {
    const virtualRenderable = createVirtualItemMesh(shape, wallAMm, item, optionsValues, requestRender)
    if (virtualRenderable) itemsGroup.add(virtualRenderable.object)
  })

  syncSelection(runtime, selectedId)
  syncQuality()
  requestRender()

  let cancelled = false
  let active = 0
  const queue: Array<() => void> = []

  const acquire = () =>
    new Promise<void>((resolve) => {
      if (active < MODEL_LOAD_CONCURRENCY) {
        active += 1
        resolve()
        return
      }
      queue.push(() => {
        active += 1
        resolve()
      })
    })

  const release = () => {
    active = Math.max(0, active - 1)
    const next = queue.shift()
    if (next) next()
  }

  const run = async () => {
    await Promise.all(
      items.map(async (item) => {
        await acquire()
        try {
          if (cancelled) return

          if (String(item.catalogId || '') === '__virtual__') {
            return
          }

          const [modelUrl, indexedMountingHeightMm] = await Promise.all([
            getModelUrl(item),
            getIndexedMountingHeight(item.catalogId, item.elementId),
          ])
          if (!modelUrl) return

          const model = await loadModelAsset(modelUrl)
          if (cancelled) return

          const positioned = positionModel({
            shape,
            wallAMm,
            item,
            model,
            optionsValues,
            mountingHeightMm: Number(item.mountingHeight ?? indexedMountingHeightMm ?? getDefaultMountingHeightMm(item)),
            activeElementsSubcat,
            requestRender,
          })

          if (!cancelled && itemsGroup.parent) {
            const existing = itemsGroup.children.find((child) => String(child.userData?.id || '') === String(item.uniqueId))
            if (existing) {
              disposeDisposableSubtree(existing)
              itemsGroup.remove(existing)
            }
            itemsGroup.add(positioned.object)
            syncQuality()
            syncSelection(runtime, selectedId)
            requestRender()
          }
        } catch (error) {
          console.warn('Neuspešno učitavanje 3D modela.', {
            catalogId: item.catalogId,
            elementId: item.elementId,
            uniqueId: item.uniqueId,
            error,
          })
        } finally {
          release()
        }
      }),
    )
  }

  void run()

  return () => {
    cancelled = true
  }
}
