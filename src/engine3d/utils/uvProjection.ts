import { BufferAttribute, Vector3 } from 'three'

/*
 * Putanja: src/engine3d/utils/uvProjection.ts
 *
 * Ovaj fajl određuje kako se 2D slika prevodi na 3D površinu.
 * To je osnova za pravilno lepljenje drvne šare, kamena i svih drugih dekora.
 *
 * Ako je tekstura okrenuta pogrešno, rastegnuta, zbijena ili nazubljena samo na nekim delovima,
 * vrlo često je problem u UV rasporedu koji se računa ovde.
 */
import type { BufferGeometry, Mesh } from 'three'

type AxisKey = 'x' | 'y' | 'z'
type Orientation = 'front-vertical' | 'top-horizontal' | 'board-vertical' | 'board-horizontal'

// Ako model nema UV koordinate, ovde ih pravimo da bi tekstura uopšte mogla da se prikaže.
function ensureUvAttribute(geometry: BufferGeometry): BufferAttribute {
  const existing = geometry.getAttribute('uv')
  if (existing && existing.itemSize === 2) return existing as BufferAttribute

  const position = geometry.getAttribute('position')
  const uv = new BufferAttribute(new Float32Array((position.count || 0) * 2), 2)
  geometry.setAttribute('uv', uv)
  return uv
}

function normalizeAxisValue(axis: AxisKey, position: Vector3, bboxMin: Vector3, size: Vector3): number {
  if (axis === 'x') return size.x > 0 ? (position.x - bboxMin.x) / size.x : 0
  if (axis === 'y') return size.y > 0 ? (position.y - bboxMin.y) / size.y : 0
  return size.z > 0 ? (position.z - bboxMin.z) / size.z : 0
}

function axisSize(axis: AxisKey, size: Vector3): number {
  if (axis === 'x') return Math.abs(size.x)
  if (axis === 'y') return Math.abs(size.y)
  return Math.abs(size.z)
}

// Traži najtanju osu ploče da bi znao kako da rasporedi dekor kao na stvarnoj tabli.
function getThicknessAxis(size: Vector3): AxisKey {
  const axes: AxisKey[] = ['x', 'y', 'z']
  return axes.reduce((smallest, current) => (axisSize(current, size) < axisSize(smallest, size) ? current : smallest), 'x')
}

function getDominantAxis(normal: Vector3): AxisKey {
  const ax = Math.abs(normal.x)
  const ay = Math.abs(normal.y)
  const az = Math.abs(normal.z)
  if (ax >= ay && ax >= az) return 'x'
  if (ay >= az) return 'y'
  return 'z'
}

function getPlaneAxes(normalAxis: AxisKey): [AxisKey, AxisKey] {
  if (normalAxis === 'x') return ['y', 'z']
  if (normalAxis === 'y') return ['x', 'z']
  return ['x', 'y']
}

function chooseBoardAxes(normalAxis: AxisKey, thicknessAxis: AxisKey, desiredGrainAxis: AxisKey): { uAxis: AxisKey; vAxis: AxisKey } {
  const [a, b] = getPlaneAxes(normalAxis)

  if (normalAxis === thicknessAxis) {
    if (desiredGrainAxis === a) return { uAxis: b, vAxis: a }
    if (desiredGrainAxis === b) return { uAxis: a, vAxis: b }
    return { uAxis: a, vAxis: b }
  }

  const longAxis = a === thicknessAxis ? b : a
  return { uAxis: thicknessAxis, vAxis: longAxis }
}

// UV raspored za pločaste delove kao što su frontovi, stranice i police.
function applyBoardUvProjection(mesh: Mesh, desiredGrainAxis: AxisKey) {
  let geometry = mesh.geometry
  if (!geometry) return

  if (geometry.index) {
    geometry = geometry.toNonIndexed()
    mesh.geometry = geometry
  }

  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const bbox = geometry.boundingBox
  if (!bbox) return

  const position = geometry.getAttribute('position')
  const uv = ensureUvAttribute(geometry)
  const size = new Vector3()
  const p0 = new Vector3()
  const p1 = new Vector3()
  const p2 = new Vector3()
  const edgeA = new Vector3()
  const edgeB = new Vector3()
  const normal = new Vector3()

  bbox.getSize(size)
  const thicknessAxis = getThicknessAxis(size)

  for (let i = 0; i < position.count; i += 3) {
    p0.fromBufferAttribute(position, i)
    p1.fromBufferAttribute(position, i + 1)
    p2.fromBufferAttribute(position, i + 2)

    edgeA.subVectors(p1, p0)
    edgeB.subVectors(p2, p0)
    normal.crossVectors(edgeA, edgeB)

    if (normal.lengthSq() === 0) continue

    normal.normalize()
    const normalAxis = getDominantAxis(normal)
    const { uAxis, vAxis } = chooseBoardAxes(normalAxis, thicknessAxis, desiredGrainAxis)

    for (let j = 0; j < 3; j += 1) {
      const vertexIndex = i + j
      const vertex = j === 0 ? p0 : j === 1 ? p1 : p2
      const u = normalizeAxisValue(uAxis, vertex, bbox.min, size)
      const v = normalizeAxisValue(vAxis, vertex, bbox.min, size)
      uv.setXY(vertexIndex, u, v)
    }
  }

  uv.needsUpdate = true
}

// Glavna ulazna tačka za izbor UV rasporeda prema vrsti površine.
export function applyPlanarUvProjection(mesh: Mesh, orientation: Orientation) {
  const geometry = mesh.geometry
  if (!geometry) return

  // Uspravni pločasti elementi: frontovi, bočne stranice i slični delovi.
  if (orientation === 'board-vertical') {
    applyBoardUvProjection(mesh, 'y')
    return
  }

  // Vodoravni pločasti elementi: police, dno, cokla i slični delovi.
  if (orientation === 'board-horizontal') {
    applyBoardUvProjection(mesh, 'x')
    return
  }

  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const bbox = geometry.boundingBox
  if (!bbox) return

  const uv = ensureUvAttribute(geometry)
  const position = geometry.getAttribute('position')
  const size = new Vector3()
  bbox.getSize(size)

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    let u = 0
    let v = 0

    // Poseban jednostavan slučaj za ravnu prednju površinu.
    if (orientation === 'front-vertical') {
      u = size.x > 0 ? (x - bbox.min.x) / size.x : 0
      v = size.y > 0 ? (y - bbox.min.y) / size.y : 0
    } else {
      u = size.x > 0 ? (x - bbox.min.x) / size.x : 0
      v = size.z > 0 ? (z - bbox.min.z) / size.z : 0
    }

    uv.setXY(i, u, v)
  }

  uv.needsUpdate = true
}
