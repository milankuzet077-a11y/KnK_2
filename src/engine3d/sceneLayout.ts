import * as THREE from 'three'
import type { KitchenShape, Walls } from '../domain/types'
import { markDisposable, mmToM } from './shared'
import { SCENE_PRESET } from './scenePreset'

export const WALL_HEIGHT_M = 2.6
export const WALL_THICKNESS_M = 0.1
export const PARALLEL_GAP = 3.5

const FLOOR_REFLECTION_Y = 0.003
const FLOOR_EPSILON_Y = 0
const CAMERA_TARGET_Y = 1.25
const CAMERA_MIN_ELEVATION_DEG = 0
const CAMERA_MAX_ELEVATION_DEG = 40
const DEFAULT_CAMERA_ELEVATION_DEG = 18

type PlaneWallOptions = {
  width: number
  centerX: number
  centerZ: number
  rotationY?: number
}

export type CameraView = {
  target: THREE.Vector3
  direction: THREE.Vector3
  distanceMultiplier?: number
}

function createWallMaterial() {
  return new THREE.MeshStandardMaterial({
    color: SCENE_PRESET.materials.wall.color,
    roughness: SCENE_PRESET.materials.wall.roughness,
    metalness: SCENE_PRESET.materials.wall.metalness,
  })
}

function createFloorMaterial() {
  return new THREE.MeshStandardMaterial({
    color: SCENE_PRESET.materials.floor.color,
    roughness: SCENE_PRESET.materials.floor.roughness,
    metalness: SCENE_PRESET.materials.floor.metalness,
    envMapIntensity: SCENE_PRESET.materials.floor.envMapIntensity,
  })
}

function createReflectionMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: SCENE_PRESET.materials.floor.color,
    roughness: 0.08,
    metalness: 0.0,
    transparent: true,
    opacity: SCENE_PRESET.reflection.opacity,
    clearcoat: 1.0,
    clearcoatRoughness: 0.2,
  })
}

function addPlaneWall(group: THREE.Group, material: THREE.Material, options: PlaneWallOptions) {
  const { width, centerX, centerZ, rotationY = 0 } = options
  if (!(width > 0)) return
  const mesh = markDisposable(new THREE.Mesh(new THREE.PlaneGeometry(width, WALL_HEIGHT_M), material))
  mesh.position.set(centerX, WALL_HEIGHT_M / 2, centerZ)
  mesh.rotation.y = rotationY
  mesh.receiveShadow = true
  mesh.castShadow = false
  group.add(mesh)
}

function addSegmentWall(group: THREE.Group, material: THREE.Material, from: THREE.Vector2, to: THREE.Vector2, inwardPoint: THREE.Vector2) {
  const delta = to.clone().sub(from)
  const width = delta.length()
  if (!(width > 0)) return

  const midpoint = from.clone().add(to).multiplyScalar(0.5)
  const toInterior = inwardPoint.clone().sub(midpoint)
  let rotationY = -Math.atan2(delta.y, delta.x)
  const baseNormal = new THREE.Vector2(Math.sin(rotationY), Math.cos(rotationY))
  if (baseNormal.dot(toInterior) < 0) rotationY += Math.PI

  const mesh = markDisposable(new THREE.Mesh(new THREE.PlaneGeometry(width, WALL_HEIGHT_M), material))
  mesh.position.set(midpoint.x, WALL_HEIGHT_M / 2, midpoint.y)
  mesh.rotation.y = rotationY
  mesh.receiveShadow = true
  mesh.castShadow = false
  group.add(mesh)
}

function addRectCeiling(group: THREE.Group, material: THREE.Material, width: number, depth: number, centerX: number, centerZ: number) {
  if (!(width > 0) || !(depth > 0)) return
  const ceiling = markDisposable(new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material))
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(centerX, WALL_HEIGHT_M, centerZ)
  ceiling.receiveShadow = true
  ceiling.castShadow = false
  group.add(ceiling)
}

function buildParallelFootprint(wallA: number, wallB: number) {
  const halfGap = PARALLEL_GAP / 2
  return [
    new THREE.Vector2(-halfGap, 0),
    new THREE.Vector2(halfGap, 0),
    new THREE.Vector2(halfGap, -wallB),
    new THREE.Vector2(0, -wallB),
    new THREE.Vector2(0, -wallA),
    new THREE.Vector2(-halfGap, -wallA),
  ]
}

function addPolygonSurface(group: THREE.Group, material: THREE.Material, points: THREE.Vector2[], positionY: number, rotationX: number) {
  if (points.length < 3) return
  const shape = new THREE.Shape(points)
  const geometry = new THREE.ShapeGeometry(shape)
  const mesh = markDisposable(new THREE.Mesh(geometry, material))
  mesh.rotation.x = rotationX
  mesh.position.y = positionY
  mesh.receiveShadow = true
  mesh.castShadow = false
  group.add(mesh)
}

function createElevatedDirection(horizontalX: number, horizontalZ: number, elevationDeg = DEFAULT_CAMERA_ELEVATION_DEG) {
  const horizontal = new THREE.Vector3(horizontalX, 0, horizontalZ)
  if (horizontal.lengthSq() <= 1e-6) {
    horizontal.set(0, 0, 1)
  }
  horizontal.normalize()
  const elevationRad = THREE.MathUtils.degToRad(elevationDeg)
  return new THREE.Vector3(
    horizontal.x * Math.cos(elevationRad),
    Math.sin(elevationRad),
    horizontal.z * Math.cos(elevationRad),
  ).normalize()
}

export function buildWallsGroup(shape: KitchenShape, walls: Walls): THREE.Group {
  const wallA = mmToM(walls.A)
  const wallB = mmToM(walls.B)
  const group = new THREE.Group()
  const wallMaterial = createWallMaterial()

  if (shape === 'straight') {
    addPlaneWall(group, wallMaterial, { width: wallA, centerX: 0, centerZ: 0, rotationY: 0 })
    addPlaneWall(group, wallMaterial, { width: wallA, centerX: 0, centerZ: wallA, rotationY: Math.PI })
    addPlaneWall(group, wallMaterial, { width: wallA, centerX: -wallA / 2, centerZ: wallA / 2, rotationY: Math.PI / 2 })
    addPlaneWall(group, wallMaterial, { width: wallA, centerX: wallA / 2, centerZ: wallA / 2, rotationY: -Math.PI / 2 })
    addRectCeiling(group, wallMaterial, wallA, wallA, 0, wallA / 2)
    return group
  }

  if (shape === 'parallel') {
    const halfGap = PARALLEL_GAP / 2
    addPlaneWall(group, wallMaterial, { width: wallA, centerX: -halfGap, centerZ: -(wallA / 2), rotationY: Math.PI / 2 })
    addPlaneWall(group, wallMaterial, { width: wallB, centerX: halfGap, centerZ: -(wallB / 2), rotationY: -Math.PI / 2 })
    addPlaneWall(group, wallMaterial, { width: PARALLEL_GAP, centerX: 0, centerZ: 0, rotationY: Math.PI })

    const interiorPoint = new THREE.Vector2(0, -(Math.max(wallA, wallB) * 0.45))
    addSegmentWall(group, wallMaterial, new THREE.Vector2(-halfGap, -wallA), new THREE.Vector2(0, -wallA), interiorPoint)
    addSegmentWall(group, wallMaterial, new THREE.Vector2(0, -wallB), new THREE.Vector2(halfGap, -wallB), interiorPoint)
    addSegmentWall(group, wallMaterial, new THREE.Vector2(0, -wallA), new THREE.Vector2(0, -wallB), interiorPoint)

    const footprint = buildParallelFootprint(wallA, wallB)
    addPolygonSurface(group, wallMaterial, footprint, WALL_HEIGHT_M, Math.PI / 2)
    return group
  }

  addPlaneWall(group, wallMaterial, { width: wallA, centerX: wallA / 2, centerZ: 0, rotationY: Math.PI })
  addPlaneWall(group, wallMaterial, { width: wallB, centerX: 0, centerZ: -(wallB / 2), rotationY: Math.PI / 2 })
  addPlaneWall(group, wallMaterial, { width: wallB, centerX: wallA, centerZ: -(wallB / 2), rotationY: -Math.PI / 2 })
  addPlaneWall(group, wallMaterial, { width: wallA, centerX: wallA / 2, centerZ: -wallB, rotationY: 0 })
  addRectCeiling(group, wallMaterial, wallA, wallB, wallA / 2, -(wallB / 2))
  return group
}

export function buildFloorGroup(shape: KitchenShape, walls: Walls): THREE.Group {
  const wallA = mmToM(walls.A)
  const wallB = mmToM(walls.B)
  const group = new THREE.Group()
  const floorMaterial = createFloorMaterial()

  const addFloorRect = (width: number, depth: number, centerX: number, centerZ: number) => {
    if (!(width > 0) || !(depth > 0)) return

    const floor = markDisposable(new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMaterial))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(centerX, FLOOR_EPSILON_Y, centerZ)
    floor.receiveShadow = true
    floor.castShadow = false
    group.add(floor)

    if (SCENE_PRESET.reflection.enabled) {
      const reflection = markDisposable(new THREE.Mesh(new THREE.PlaneGeometry(width, depth), createReflectionMaterial()))
      reflection.rotation.x = -Math.PI / 2
      reflection.position.set(centerX, FLOOR_REFLECTION_Y, centerZ)
      reflection.receiveShadow = false
      reflection.castShadow = false
      group.add(reflection)
    }
  }

  const addFloorPolygon = (points: THREE.Vector2[]) => {
    const polygonFloorMaterial = floorMaterial.clone()
    polygonFloorMaterial.side = THREE.DoubleSide
    addPolygonSurface(group, polygonFloorMaterial, points, FLOOR_EPSILON_Y, Math.PI / 2)
    if (SCENE_PRESET.reflection.enabled) {
      const polygonReflectionMaterial = createReflectionMaterial()
      polygonReflectionMaterial.side = THREE.DoubleSide
      addPolygonSurface(group, polygonReflectionMaterial, points, FLOOR_REFLECTION_Y, Math.PI / 2)
    }
  }

  if (shape === 'straight') {
    addFloorRect(wallA, wallA, 0, wallA / 2)
    return group
  }

  if (shape === 'parallel') {
    addFloorPolygon(buildParallelFootprint(wallA, wallB))
    return group
  }

  addFloorRect(wallA, wallB, wallA / 2, -(wallB / 2))
  return group
}

export function getInitialCameraView(shape: KitchenShape, _walls: Walls): CameraView {
  if (shape === 'straight') {
    return {
      target: new THREE.Vector3(0, CAMERA_TARGET_Y, 0),
      direction: createElevatedDirection(0, 1),
      distanceMultiplier: 1.08,
    }
  }

  if (shape === 'parallel') {
    return {
      target: new THREE.Vector3(0, CAMERA_TARGET_Y, 0),
      direction: createElevatedDirection(0, 1),
      distanceMultiplier: 1.06,
    }
  }

  return {
    target: new THREE.Vector3(0, CAMERA_TARGET_Y, 0),
    direction: createElevatedDirection(1, -1),
    distanceMultiplier: 1.08,
  }
}

export function getCameraConstraints(_shape: KitchenShape, fitDistance = 6) {
  const minPolarAngle = THREE.MathUtils.degToRad(90 - CAMERA_MAX_ELEVATION_DEG)
  const maxPolarAngle = THREE.MathUtils.degToRad(90 - CAMERA_MIN_ELEVATION_DEG)

  return {
    minDistance: Math.max(2.4, fitDistance * 0.6),
    maxDistance: Math.max(8, fitDistance * 2.5),
    maxPolarAngle,
    minPolarAngle,
  }
}

function getObjectBox(group: THREE.Object3D) {
  group.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(group)
  if (!Number.isFinite(box.min.x)) return null
  return box
}

function getCameraBasis(viewDirection: THREE.Vector3) {
  const forward = viewDirection.clone().multiplyScalar(-1).normalize()
  const worldUp = new THREE.Vector3(0, 1, 0)
  const right = new THREE.Vector3().crossVectors(worldUp, forward)
  if (right.lengthSq() <= 1e-6) {
    right.set(1, 0, 0)
  } else {
    right.normalize()
  }
  const up = new THREE.Vector3().crossVectors(forward, right).normalize()
  return { forward, right, up }
}

function getFitScale() {
  const isMobile = window.matchMedia?.('(max-width: 720px)').matches
  return isMobile ? 1.16 : 1.08
}

export function fitCameraToWalls(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  group: THREE.Object3D,
  viewDirection?: THREE.Vector3,
): number {
  const box = getObjectBox(group)
  if (!box) return 5

  const center = new THREE.Vector3()
  box.getCenter(center)
  target.set(center.x, CAMERA_TARGET_Y, center.z)

  const direction = viewDirection?.clone().normalize() ?? createElevatedDirection(0, 1)
  const { forward, right, up } = getCameraBasis(direction)

  const verticalFov = THREE.MathUtils.degToRad(camera.fov)
  const aspect = Math.max(0.0001, camera.aspect)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
  const tanHalfV = Math.tan(verticalFov / 2)
  const tanHalfH = Math.tan(horizontalFov / 2)

  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ]

  let requiredDistance = 0
  for (const corner of corners) {
    const fromTarget = corner.clone().sub(target)
    const projectedForward = fromTarget.dot(forward)
    const projectedRight = Math.abs(fromTarget.dot(right))
    const projectedUp = Math.abs(fromTarget.dot(up))

    requiredDistance = Math.max(
      requiredDistance,
      projectedForward + projectedRight / Math.max(tanHalfH, 1e-6),
      projectedForward + projectedUp / Math.max(tanHalfV, 1e-6),
    )
  }

  return THREE.MathUtils.clamp(requiredDistance * getFitScale(), 3, 60)
}

export function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    )
  } catch {
    return false
  }
}
