import * as THREE from 'three'
import { getObjectSelectionId } from './shared'
import type { PointerPoint } from './sceneRuntimeTypes'

export function createSelectionBindings(params: {
  domElement: HTMLCanvasElement
  camera: THREE.PerspectiveCamera
  itemsGroup: THREE.Group
  onSelect?: (id: string | null) => void
}) {
  const { domElement, camera, itemsGroup, onSelect } = params
  const raycaster = new THREE.Raycaster()
  let pointerDownPos: PointerPoint | null = null

  const onPointerDown = (event: PointerEvent) => {
    pointerDownPos = { x: event.clientX, y: event.clientY }
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!pointerDownPos || !onSelect) {
      pointerDownPos = null
      return
    }

    const dx = event.clientX - pointerDownPos.x
    const dy = event.clientY - pointerDownPos.y
    pointerDownPos = null
    if (Math.sqrt(dx * dx + dy * dy) >= 5) return

    const rect = domElement.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    const intersections = raycaster.intersectObjects(itemsGroup.children, true)
    if (intersections.length <= 0) {
      onSelect(null)
      return
    }

    let foundId: string | null = null
    for (const intersection of intersections) {
      let hit: THREE.Object3D | null = intersection.object
      while (hit) {
        if ((hit.userData as { __decorativeEdge?: boolean } | undefined)?.__decorativeEdge) {
          hit = hit.parent
          continue
        }

        const objectId = getObjectSelectionId(hit)
        if (objectId) {
          foundId = objectId
          break
        }

        if (hit.parent === itemsGroup || !hit.parent) break
        hit = hit.parent
      }
      if (foundId) break
    }

    onSelect(foundId)
  }

  domElement.addEventListener('pointerdown', onPointerDown)
  domElement.addEventListener('pointerup', onPointerUp)
  domElement.addEventListener('pointercancel', onPointerUp)

  return {
    dispose: () => {
      domElement.removeEventListener('pointerdown', onPointerDown)
      domElement.removeEventListener('pointerup', onPointerUp)
      domElement.removeEventListener('pointercancel', onPointerUp)
    },
  }
}
