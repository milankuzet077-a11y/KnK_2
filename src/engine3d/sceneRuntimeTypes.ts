import * as THREE from 'three'

export type SceneRuntime = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  itemsGroup: THREE.Group
  selectionHelper: THREE.BoxHelper
  requestRender: () => void
  start: () => void
  stop: () => void
  syncQuality: () => void
  dispose: () => void
}

export type CreateSceneRuntimeParams = {
  host: HTMLDivElement
  shape: import('../domain/types').KitchenShape
  walls: import('../domain/types').Walls
  onSelect?: (id: string | null) => void
  onRuntimeError?: () => void
  setFatalError: (message: string | null) => void
}

export type PointerPoint = { x: number; y: number }

export type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext

export type RendererProfile = {
  antialias: boolean
  powerPreference?: WebGLPowerPreference
}

export type AdaptiveQualityController = {
  resize: (width: number, height: number) => void
  onFrame: (deltaMs: number) => void
  onInteractionStart: () => void
  onInteractionEnd: () => void
  syncSceneQuality: () => void
  dispose: () => void
}
