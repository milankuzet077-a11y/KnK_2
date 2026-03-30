import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { KitchenShape, Walls } from '../domain/types'
import { buildFloorGroup, buildWallsGroup, fitCameraToWalls, getCameraConstraints, getInitialCameraView } from './sceneLayout'
import { disposeDisposableSubtree, getObjectSelectionId, markDisposable, setDecorativeEdgesState } from './shared'
import { buildRuntimeQualityLevels, detectQualityProfile, type QualityProfile, type RuntimeQualityLevel } from './quality'
import { SCENE_PRESET } from './scenePreset'

export type SceneRuntime = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  itemsGroup: THREE.Group
  selectionHelper: THREE.BoxHelper
  requestRender: () => void
  syncQuality: () => void
  dispose: () => void
}

type CreateSceneRuntimeParams = {
  host: HTMLDivElement
  shape: KitchenShape
  walls: Walls
  onSelect?: (id: string | null) => void
  onRuntimeError?: () => void
  setFatalError: (message: string | null) => void
}

type PointerPoint = { x: number; y: number }

type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext

type RendererProfile = {
  antialias: boolean
  powerPreference?: WebGLPowerPreference
}

type AdaptiveQualityController = {
  resize: (width: number, height: number) => void
  onFrame: (deltaMs: number) => void
  onInteractionStart: () => void
  onInteractionEnd: () => void
  syncSceneQuality: () => void
  dispose: () => void
}

const PAN_HORIZONTAL_EXTRA_RANGE_M = 1
const QUALITY_DOWNGRADE_THRESHOLD_MS = 24
const QUALITY_UPGRADE_THRESHOLD_MS = 15.5
const QUALITY_SAMPLE_SIZE = 45
const QUALITY_ADJUST_COOLDOWN_MS = 1800
const QUALITY_WARMUP_FRAMES = 18
const INTERACTION_RESTORE_DELAY_MS = 140

function centerWallsGroup(group: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(group)
  const center = new THREE.Vector3()
  box.getCenter(center)
  group.position.x -= center.x
  group.position.z -= center.z
  group.updateMatrixWorld(true)
}

function getObjectFitMetrics(object: THREE.Object3D) {
  object.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(object)
  if (!Number.isFinite(box.min.x)) {
    return {
      center: new THREE.Vector3(),
      radius: 1,
    }
  }

  const sphere = new THREE.Sphere()
  box.getBoundingSphere(sphere)
  return {
    center: sphere.center.clone(),
    radius: Math.max(sphere.radius, 1),
  }
}

function clampOrbitToVisibleScene(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  fitCenter: THREE.Vector3,
  fitRadius: number,
) {
  const cameraOffset = camera.position.clone().sub(controls.target)
  const offsetLength = cameraOffset.length()
  if (offsetLength <= 1e-6) return false

  const forward = controls.target.clone().sub(camera.position)
  if (forward.lengthSq() <= 1e-6) return false
  forward.normalize()

  const right = new THREE.Vector3().crossVectors(forward, camera.up)
  if (right.lengthSq() <= 1e-6) return false
  right.normalize()

  const up = new THREE.Vector3().crossVectors(right, forward).normalize()
  const distanceToCenter = Math.max(0.001, fitCenter.clone().sub(camera.position).dot(forward))
  const verticalFov = THREE.MathUtils.degToRad(camera.fov)
  const halfVertical = Math.tan(verticalFov / 2) * distanceToCenter
  const halfHorizontal = halfVertical * Math.max(camera.aspect, 0.0001)
  const safetyRadius = fitRadius * 1.02
  const maxRightOffset = Math.max(0, halfHorizontal - safetyRadius) + PAN_HORIZONTAL_EXTRA_RANGE_M
  const maxUpOffset = Math.max(0, halfVertical - safetyRadius)

  const targetOffset = controls.target.clone().sub(fitCenter)
  const rightOffset = THREE.MathUtils.clamp(targetOffset.dot(right), -maxRightOffset, maxRightOffset)
  const upOffset = THREE.MathUtils.clamp(targetOffset.dot(up), -maxUpOffset, maxUpOffset)
  const clampedTarget = fitCenter.clone()
    .add(right.multiplyScalar(rightOffset))
    .add(up.multiplyScalar(upOffset))

  const correction = clampedTarget.sub(controls.target)
  if (correction.lengthSq() <= 1e-10) return false

  controls.target.add(correction)
  camera.position.add(correction)
  return true
}

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

function createRenderer(host: HTMLDivElement, quality: QualityProfile): THREE.WebGLRenderer {
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

function addLights(scene: THREE.Scene) {
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

function createSelectionHelper(scene: THREE.Scene): THREE.BoxHelper {
  const helper = new THREE.BoxHelper(new THREE.Object3D(), 0xf0f4ff)
  helper.visible = false
  scene.add(helper)
  return helper
}

function createAdaptiveQualityController(params: {
  renderer: THREE.WebGLRenderer
  quality: QualityProfile
  directionalLight: THREE.DirectionalLight
  itemsGroup: THREE.Group
}) : AdaptiveQualityController {
  const { renderer, quality, directionalLight, itemsGroup } = params
  const levels = buildRuntimeQualityLevels(quality)
  let currentLevelIndex = 0
  let width = 1
  let height = 1
  let warmupFrames = QUALITY_WARMUP_FRAMES
  let sampleCount = 0
  let sampleTotalMs = 0
  let lastAdjustmentAt = performance.now()
  let interactionActive = false
  let interactionRestoreTimer = 0

  const clampLevelIndex = (value: number) => Math.max(0, Math.min(levels.length - 1, value))

  const getEffectivePixelRatio = (level: RuntimeQualityLevel, interacting: boolean) => {
    const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1)
    const pixelRatio = interacting ? Math.min(level.pixelRatio, level.interactionPixelRatio) : level.pixelRatio
    return Math.min(pixelRatio, devicePixelRatio, quality.maxPixelRatio)
  }

  const applyLevel = (nextIndex: number, interacting = interactionActive) => {
    currentLevelIndex = clampLevelIndex(nextIndex)
    const level = levels[currentLevelIndex]
    const pixelRatio = getEffectivePixelRatio(level, interacting)

    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height, false)

    directionalLight.castShadow = level.shadowMode !== 'off'
    renderer.shadowMap.enabled = level.shadowMode !== 'off'
    renderer.shadowMap.type = level.shadowMode === 'soft' ? SCENE_PRESET.renderer.shadowMapType : THREE.PCFShadowMap

    if (level.shadowMode !== 'off') {
      const nextShadowMapSize = Math.max(256, level.shadowMapSize || quality.shadows.mapSize)
      if (
        directionalLight.shadow.mapSize.x !== nextShadowMapSize
        || directionalLight.shadow.mapSize.y !== nextShadowMapSize
      ) {
        directionalLight.shadow.mapSize.set(nextShadowMapSize, nextShadowMapSize)
        directionalLight.shadow.dispose()
      }
      directionalLight.shadow.needsUpdate = true
    }

    setDecorativeEdgesState(itemsGroup, {
      enabled: level.edgeLines,
      opacity: level.edgeOpacity,
    })
  }

  applyLevel(0)

  return {
    resize: (nextWidth: number, nextHeight: number) => {
      width = Math.max(1, Math.round(nextWidth))
      height = Math.max(1, Math.round(nextHeight))
      applyLevel(currentLevelIndex)
    },
    onFrame: (deltaMs: number) => {
      if (!Number.isFinite(deltaMs) || deltaMs <= 0) return
      if (interactionActive) return
      if (warmupFrames > 0) {
        warmupFrames -= 1
        return
      }

      sampleCount += 1
      sampleTotalMs += deltaMs
      if (sampleCount < QUALITY_SAMPLE_SIZE) return

      const averageFrameMs = sampleTotalMs / sampleCount
      sampleCount = 0
      sampleTotalMs = 0

      const now = performance.now()
      if (now - lastAdjustmentAt < QUALITY_ADJUST_COOLDOWN_MS) return

      if (averageFrameMs > QUALITY_DOWNGRADE_THRESHOLD_MS && currentLevelIndex < levels.length - 1) {
        warmupFrames = 10
        lastAdjustmentAt = now
        applyLevel(currentLevelIndex + 1)
        return
      }

      if (averageFrameMs < QUALITY_UPGRADE_THRESHOLD_MS && currentLevelIndex > 0) {
        warmupFrames = QUALITY_WARMUP_FRAMES
        lastAdjustmentAt = now
        applyLevel(currentLevelIndex - 1)
      }
    },
    onInteractionStart: () => {
      interactionActive = true
      window.clearTimeout(interactionRestoreTimer)
      applyLevel(currentLevelIndex, true)
    },
    onInteractionEnd: () => {
      interactionActive = false
      window.clearTimeout(interactionRestoreTimer)
      interactionRestoreTimer = window.setTimeout(() => {
        applyLevel(currentLevelIndex, false)
      }, INTERACTION_RESTORE_DELAY_MS)
    },
    syncSceneQuality: () => {
      applyLevel(currentLevelIndex, interactionActive)
    },
    dispose: () => {
      window.clearTimeout(interactionRestoreTimer)
    },
  }
}

function createRenderLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  adaptiveQuality: AdaptiveQualityController,
  constrainScene?: () => void,
) {
  let frameId = 0
  let lastFrameAt = 0

  const renderFrame = (timestamp: number) => {
    if (lastFrameAt > 0) {
      adaptiveQuality.onFrame(timestamp - lastFrameAt)
    }
    lastFrameAt = timestamp

    controls.update()
    constrainScene?.()
    renderer.render(scene, camera)
    frameId = window.requestAnimationFrame(renderFrame)
  }
  frameId = window.requestAnimationFrame(renderFrame)

  return {
    requestRender: () => undefined,
    dispose: () => {
      window.cancelAnimationFrame(frameId)
      frameId = 0
      lastFrameAt = 0
    },
  }
}

function createSelectionBindings(params: {
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

function createOrbitControls(params: {
  domElement: HTMLCanvasElement
  camera: THREE.PerspectiveCamera
  target: THREE.Vector3
  shape: KitchenShape
  walls: Walls
  fitObject: THREE.Object3D
  adaptiveQuality: AdaptiveQualityController
}) {
  const { domElement, camera, target, shape, walls, fitObject, adaptiveQuality } = params
  const initialView = getInitialCameraView(shape, walls)
  const fitMetrics = getObjectFitMetrics(fitObject)
  const fitTarget = new THREE.Vector3()
  const radius = fitCameraToWalls(camera, fitTarget, fitObject, initialView.direction)
  const constraints = getCameraConstraints(shape, radius)
  const controls = new OrbitControls(camera, domElement)

  controls.enableDamping = true
  controls.enablePan = true
  controls.screenSpacePanning = true
  controls.minAzimuthAngle = -Infinity
  controls.maxAzimuthAngle = Infinity
  controls.maxPolarAngle = constraints.maxPolarAngle
  controls.minPolarAngle = constraints.minPolarAngle
  controls.minDistance = constraints.minDistance
  controls.maxDistance = constraints.maxDistance
  controls.target.copy(initialView.target)

  const initialRadius = radius * (initialView.distanceMultiplier ?? 1)
  target.copy(initialView.target)
  camera.position.copy(initialView.target).add(initialView.direction.clone().multiplyScalar(initialRadius))
  camera.lookAt(initialView.target)
  controls.update()
  clampOrbitToVisibleScene(camera, controls, fitMetrics.center, fitMetrics.radius)
  controls.update()

  const onStart = () => adaptiveQuality.onInteractionStart()
  const onEnd = () => adaptiveQuality.onInteractionEnd()
  controls.addEventListener('start', onStart)
  controls.addEventListener('end', onEnd)

  return {
    controls,
    constrainScene: () => {
      if (clampOrbitToVisibleScene(camera, controls, fitMetrics.center, fitMetrics.radius)) {
        controls.update()
      }
    },
    updateCamera: () => {
      const nextRadius = fitCameraToWalls(camera, new THREE.Vector3(), fitObject, camera.position.clone().sub(controls.target))
      const direction = camera.position.clone().sub(controls.target)
      if (direction.lengthSq() <= 1e-6) direction.copy(initialView.direction)
      direction.normalize().multiplyScalar(THREE.MathUtils.clamp(nextRadius, controls.minDistance, controls.maxDistance))
      camera.position.copy(controls.target).add(direction)
      clampOrbitToVisibleScene(camera, controls, fitMetrics.center, fitMetrics.radius)
      controls.update()
    },
    dispose: () => {
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end', onEnd)
      controls.dispose()
    },
  }
}

export function createSceneRuntime(params: CreateSceneRuntimeParams): SceneRuntime | null {
  const { host, shape, walls, onSelect, onRuntimeError, setFatalError } = params

  setFatalError(null)

  try {
    const quality = detectQualityProfile()
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b0f14')

    const camera = new THREE.PerspectiveCamera(
      SCENE_PRESET.camera.fieldOfView,
      1,
      SCENE_PRESET.camera.near,
      SCENE_PRESET.camera.far,
    )
    const target = SCENE_PRESET.camera.lookAt.clone()
    const renderer = createRenderer(host, quality)

    const onContextLost = (event: Event) => {
      event.preventDefault()
      onRuntimeError?.()
      setFatalError('3D prikaz trenutno nije dostupan.')
    }
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, { passive: false })

    const lights = addLights(scene)

    const wallsGroup = markDisposable(buildWallsGroup(shape, walls))
    centerWallsGroup(wallsGroup)
    scene.add(wallsGroup)

    const floorGroup = markDisposable(buildFloorGroup(shape, walls))
    floorGroup.position.copy(wallsGroup.position)
    scene.add(floorGroup)

    const itemsGroup = new THREE.Group()
    itemsGroup.position.copy(wallsGroup.position)
    scene.add(itemsGroup)

    const adaptiveQuality = createAdaptiveQualityController({
      renderer,
      quality,
      directionalLight: lights.directionalLight,
      itemsGroup,
    })

    const selectionHelper = createSelectionHelper(scene)
    const orbit = createOrbitControls({
      domElement: renderer.domElement,
      camera,
      target,
      shape,
      walls,
      fitObject: wallsGroup,
      adaptiveQuality,
    })
    const renderLoop = createRenderLoop(renderer, scene, camera, orbit.controls, adaptiveQuality, orbit.constrainScene)
    const selectionBindings = createSelectionBindings({
      domElement: renderer.domElement,
      camera,
      itemsGroup,
      onSelect,
    })

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      adaptiveQuality.resize(width, height)
      orbit.updateCamera()
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    resizeObserver?.observe(host)
    const onWindowResize = () => resize()
    window.addEventListener('resize', onWindowResize)
    resize()

    return {
      scene,
      camera,
      itemsGroup,
      selectionHelper,
      requestRender: renderLoop.requestRender,
      syncQuality: adaptiveQuality.syncSceneQuality,
      dispose: () => {
        renderLoop.dispose()
        resizeObserver?.disconnect()
        window.removeEventListener('resize', onWindowResize)
        selectionBindings.dispose()
        orbit.dispose()
        adaptiveQuality.dispose()
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost)

        disposeDisposableSubtree(scene)
        scene.clear()
        renderer.dispose()
        if (host.contains(renderer.domElement)) {
          host.removeChild(renderer.domElement)
        }
      },
    }
  } catch {
    return null
  }
}
