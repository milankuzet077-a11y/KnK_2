import * as THREE from 'three'
import { SCENE_PRESET } from './scenePreset'
import type { QualityProfile } from './quality'
import type { RendererProfile, WebGLContext } from './sceneRuntimeTypes'

function tryCreateContext(canvas: HTMLCanvasElement, profile: RendererProfile): WebGLContext | null {
  const contextOptions: WebGLContextAttributes = {
    alpha: false,
    antialias: profile.antialias,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: profile.powerPreference,
  }

  return (
    canvas.getContext('webgl2', contextOptions)
    || canvas.getContext('webgl', contextOptions)
    || canvas.getContext('experimental-webgl', contextOptions)
  ) as WebGLContext | null
}

export function createRenderer(host: HTMLDivElement, quality: QualityProfile): THREE.WebGLRenderer {
  const canvas = document.createElement('canvas')
  const profiles: RendererProfile[] = quality.antialias
    ? [
        { antialias: true, powerPreference: 'high-performance' },
        { antialias: false, powerPreference: 'high-performance' },
        { antialias: false },
      ]
    : [
        { antialias: false, powerPreference: 'high-performance' },
        { antialias: false },
      ]

  let renderer: THREE.WebGLRenderer | null = null
  let lastError: unknown = null

  for (const profile of profiles) {
    const context = tryCreateContext(canvas, profile)
    if (!context) continue
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        antialias: profile.antialias,
        alpha: false,
        powerPreference: profile.powerPreference,
      })
      break
    } catch (error) {
      lastError = error
    }
  }

  if (!renderer) {
    throw (lastError instanceof Error ? lastError : new Error('WebGL renderer init failed'))
  }

  renderer.setPixelRatio(Math.min(quality.targetPixelRatio, window.devicePixelRatio || 1))
  renderer.toneMapping = SCENE_PRESET.renderer.toneMapping
  renderer.toneMappingExposure = SCENE_PRESET.renderer.exposure
  renderer.outputColorSpace = SCENE_PRESET.renderer.outputColorSpace
  renderer.shadowMap.enabled = SCENE_PRESET.renderer.shadowsEnabled
  renderer.shadowMap.type = SCENE_PRESET.renderer.shadowMapType
  host.appendChild(renderer.domElement)
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.touchAction = 'none'
  return renderer
}

export function addLights(scene: THREE.Scene) {
  const ambientLight = new THREE.AmbientLight(SCENE_PRESET.ambient.color, SCENE_PRESET.ambient.intensity)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(
    SCENE_PRESET.directional.color,
    SCENE_PRESET.directional.intensity,
  )
  const angleRad = THREE.MathUtils.degToRad(SCENE_PRESET.directional.lightAngleDeg)
  directionalLight.position.set(
    Math.cos(angleRad) * SCENE_PRESET.directional.distance,
    SCENE_PRESET.directional.height,
    Math.sin(angleRad) * SCENE_PRESET.directional.distance,
  )
  directionalLight.target.position.set(0, 0, 0)
  directionalLight.castShadow = SCENE_PRESET.directional.castShadow
  directionalLight.shadow.mapSize.set(
    SCENE_PRESET.directional.shadowMapSize,
    SCENE_PRESET.directional.shadowMapSize,
  )
  directionalLight.shadow.bias = SCENE_PRESET.directional.shadowBias
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 80
  directionalLight.shadow.camera.left = -18
  directionalLight.shadow.camera.right = 18
  directionalLight.shadow.camera.top = 18
  directionalLight.shadow.camera.bottom = -18
  scene.add(directionalLight)
  scene.add(directionalLight.target)

  for (const lightDef of SCENE_PRESET.pointLights) {
    const pointLight = new THREE.PointLight(
      lightDef.color,
      lightDef.intensity,
      lightDef.distance,
      lightDef.decay,
    )
    pointLight.position.copy(lightDef.position)
    pointLight.castShadow = lightDef.castShadow
    scene.add(pointLight)
  }

  return { directionalLight }
}

export function createSelectionHelper(scene: THREE.Scene): THREE.BoxHelper {
  const helper = new THREE.BoxHelper(new THREE.Object3D(), 0xff2222)
  helper.visible = false
  scene.add(helper)
  return helper
}
