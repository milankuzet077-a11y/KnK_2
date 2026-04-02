import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { AdaptiveQualityController } from './sceneRuntimeTypes'

export function createRenderLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  adaptiveQuality: AdaptiveQualityController,
  constrainScene?: () => void,
) {
  let frameId = 0
  let lastFrameAt = 0
  let isRunning = false
  let isDisposed = false

  const renderOnce = () => {
    controls.update()
    constrainScene?.()
    renderer.render(scene, camera)
  }

  const renderFrame = (timestamp: number) => {
    if (!isRunning || isDisposed) return

    if (lastFrameAt > 0) {
      adaptiveQuality.onFrame(timestamp - lastFrameAt)
    }
    lastFrameAt = timestamp

    renderOnce()
    frameId = window.requestAnimationFrame(renderFrame)
  }

  const start = () => {
    if (isDisposed || isRunning) return
    isRunning = true
    frameId = window.requestAnimationFrame(renderFrame)
  }

  const stop = () => {
    if (!isRunning && frameId === 0) return
    isRunning = false
    if (frameId) window.cancelAnimationFrame(frameId)
    frameId = 0
    lastFrameAt = 0
  }

  start()

  return {
    requestRender: () => {
      if (isDisposed) return
      if (!isRunning) renderOnce()
    },
    start,
    stop,
    dispose: () => {
      isDisposed = true
      stop()
    },
  }
}
