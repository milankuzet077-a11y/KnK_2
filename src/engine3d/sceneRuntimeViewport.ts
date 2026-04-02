import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { KitchenShape, Walls } from '../domain/types'
import { fitCameraToWalls, getCameraConstraints, getInitialCameraView } from './sceneLayout'
import type { AdaptiveQualityController } from './sceneRuntimeTypes'

const PAN_HORIZONTAL_EXTRA_RANGE_M = 1

export function centerWallsGroup(group: THREE.Object3D) {
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

export function createOrbitControls(params: {
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
