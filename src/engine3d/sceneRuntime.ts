import * as THREE from 'three'

/*
 * Putanja: src/engine3d/sceneRuntime.ts
 *
 * Ovaj fajl sastavlja živu 3D scenu: renderer, kameru, svetla, senke i petlju crtanja.
 * Sve što korisnik na kraju vidi na ekranu prolazi kroz ovaj runtime.
 *
 * Ako postoji problem sa osvetljenjem, nazubljenim senkama, prejakim kontrastom,
 * mutnom slikom ili bojom selekcije, velika je šansa da je trag u ovom fajlu.
 */
import type { SceneRuntime, CreateSceneRuntimeParams } from './sceneRuntimeTypes'
import { buildFloorGroup, buildWallsGroup } from './sceneLayout'
import { disposeDisposableSubtree, markDisposable } from './shared'
import { detectQualityProfile } from './quality'
import { SCENE_PRESET } from './scenePreset'
import { addLights, createRenderer, createSelectionHelper } from './sceneRuntimeRenderer'
import { createAdaptiveQualityController } from './sceneRuntimeQualityController'
import { createRenderLoop } from './sceneRuntimeLoop'
import { createSelectionBindings } from './sceneRuntimeSelectionBindings'
import { centerWallsGroup, createOrbitControls } from './sceneRuntimeViewport'

export type { SceneRuntime } from './sceneRuntimeTypes'

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
      start: renderLoop.start,
      stop: renderLoop.stop,
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
