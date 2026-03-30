import type { SceneRuntime } from './sceneRuntime'
import { getObjectSelectionId } from './shared'

export function syncSelection(runtime: SceneRuntime, selectedId: string | null | undefined) {
  const { itemsGroup, selectionHelper, requestRender } = runtime

  if (!selectedId) {
    selectionHelper.visible = false
    requestRender()
    return
  }

  const selectedObject = itemsGroup.children.find((child) => getObjectSelectionId(child) === selectedId)
  if (!selectedObject) {
    selectionHelper.visible = false
    requestRender()
    return
  }

  selectionHelper.setFromObject(selectedObject)
  selectionHelper.visible = true
  requestRender()
}
