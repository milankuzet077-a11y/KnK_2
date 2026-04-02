import * as THREE from 'three'

/*
 * Putanja: src/engine3d/itemPlacement.ts
 *
 * Najvažniji fajl za završni izgled samih elemenata.
 * Ovde se radi sledeće:
 * - bira tekstura za front i radnu ploču
 * - pravi isečak iz slike ploče za frontove
 * - podešava repeat, offset i rotacija teksture
 * - dodeljuju roughness i normal mape
 * - pravi materijal za ručkice, coklu i pomoćne elemente
 *
 * Ako šara drveta ne prati dobro, ako front izgleda rastegnuto ili ako radna ploča menja utisak scene,
 * najčešće se proverava ovaj fajl.
 */
import type { Material, MeshStandardMaterial } from 'three'
import type { KitchenShape } from '../domain/types'
import type { RenderableItem } from './shared'
import { addReadableEdges, getWallKey, isMeshObject, isVirtualWorktopItem, markDisposable } from './shared'
import { PARALLEL_GAP } from './sceneLayout'
import type { OptionsValues } from '../ui/options/types'
import type { Subcat } from '../ui/step3/types'
import { getFrontTextureConfig, getWorktopTextureConfig, type TextureSetConfig } from './materials/catalog'
import { loadTextureSet } from './materials/textureService'
import { detectQualityProfile } from './quality'

export type PositionedRenderable = {
  object: THREE.Object3D
  selectionId: string
}

export type PositioningContext = {
  shape: KitchenShape
  wallAMm: number
  item: RenderableItem
  model?: THREE.Group
  optionsValues?: OptionsValues
  mountingHeightMm: number
  activeElementsSubcat?: Subcat
  requestRender?: () => void
}

// Podrazumevana fizička veličina slike za frontove. Ova vrednost govori koliku ploču jedna slika simulira.
const DEFAULT_FRONT_SHEET = { width: 2800, height: 1299 }
// Podrazumevana fizička veličina slike za radnu ploču.
const DEFAULT_WORKTOP_SHEET = { width: 2800, height: 1300 }
const DEFAULT_FRONT_CUT_HEIGHT_MM = 800

const frontDecorSlicePlan = new Map<string, { xMm: number; yMm: number }>()

function estimateFrontCutHeightMm(item: RenderableItem): number {
  const explicitHeight = Number((item as RenderableItem & { height?: number }).height ?? 0)
  if (Number.isFinite(explicitHeight) && explicitHeight > 0) return explicitHeight
  return DEFAULT_FRONT_CUT_HEIGHT_MM
}

// Pravi plan isečaka za frontove tako da svaki front dobije svoj deo zajedničke ploče dekora.
export function setFrontDecorSlicePlan(items: RenderableItem[], defaultDecor?: string) {
  frontDecorSlicePlan.clear()

  const grouped = new Map<string, RenderableItem[]>()
  items.forEach((item) => {
    if (!shouldApplyDecorToItem(item)) return
    const wallKey = getWallKey(item)
    const decorKey = String((item as { decor?: string }).decor ?? defaultDecor ?? 'Bela')
    const groupKey = `${wallKey}::${decorKey}`
    const bucket = grouped.get(groupKey)
    if (bucket) bucket.push(item)
    else grouped.set(groupKey, [item])
  })

  grouped.forEach((groupItems) => {
    const sorted = [...groupItems].sort((a, b) => {
      const xDiff = Number(a.x ?? 0) - Number(b.x ?? 0)
      if (xDiff !== 0) return xDiff
      return String(a.uniqueId).localeCompare(String(b.uniqueId))
    })

    let cursorX = 0
    let cursorY = 0
    let rowHeight = 0

    sorted.forEach((item) => {
      const widthMm = Math.max(1, Number(item.width ?? 0) || 1)
      const heightMm = Math.max(1, estimateFrontCutHeightMm(item))

      if (cursorX > 0 && cursorX + widthMm > DEFAULT_FRONT_SHEET.width) {
        cursorX = 0
        cursorY += rowHeight
        rowHeight = 0
      }

      const maxSliceY = Math.max(DEFAULT_FRONT_SHEET.height - heightMm, 0)
      frontDecorSlicePlan.set(item.uniqueId, {
        xMm: cursorX,
        yMm: Math.min(cursorY, maxSliceY),
      })

      cursorX += widthMm
      rowHeight = Math.max(rowHeight, heightMm)
    })
  })
}

function shouldApplyDecorToItem(item: RenderableItem): boolean {
  const supportRole = (item as { supportRole?: string }).supportRole
  if (supportRole) return false

  const catalogId = String(item.catalogId || '').toLowerCase()
  if (catalogId === '__virtual__' || catalogId === '__support__') return false
  if (catalogId === 'base' || catalogId === 'wall' || catalogId === 'tall') return true
  if (catalogId !== 'corner') return false

  const category = String((item as { category?: string }).category || '').toLowerCase()
  return category === 'base' || category === 'wall'
}

// Pravi novi standardni materijal i čuva osnovna svojstva starog da bismo mogli bezbedno da menjamo teksture.
function cloneWithPreservedBasics(material: Material, materialName: string): MeshStandardMaterial {
  const fallback = material as Material & { transparent?: boolean; opacity?: number; side?: THREE.Side }
  const next = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.02,
    transparent: fallback.transparent ?? false,
    opacity: fallback.opacity ?? 1,
    side: fallback.side ?? THREE.FrontSide,
  })
  next.name = materialName
  return next
}

function getFrontFaceMetrics(mesh: THREE.Mesh): { widthMm: number; heightMm: number; leftMm: number; topMm: number } | null {
  const geometry = mesh.geometry
  if (!geometry) return null
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const bbox = geometry.boundingBox
  if (!bbox) return null

  const size = new THREE.Vector3()
  bbox.getSize(size)
  size.multiply(mesh.scale)

  const min = bbox.min.clone().multiply(mesh.scale)
  const max = bbox.max.clone().multiply(mesh.scale)

  const axisEntries = [
    { axis: 'x' as const, size: Math.abs(size.x), min: Math.min(min.x, max.x), max: Math.max(min.x, max.x) },
    { axis: 'y' as const, size: Math.abs(size.y), min: Math.min(min.y, max.y), max: Math.max(min.y, max.y) },
    { axis: 'z' as const, size: Math.abs(size.z), min: Math.min(min.z, max.z), max: Math.max(min.z, max.z) },
  ].sort((a, b) => a.size - b.size)

  const thicknessAxis = axisEntries[0].axis
  const verticalAxis = thicknessAxis === 'y'
    ? axisEntries.slice(1).sort((a, b) => b.size - a.size)[0].axis
    : 'y'
  const horizontalAxis = (['x', 'y', 'z'] as const).find((axis) => axis !== thicknessAxis && axis !== verticalAxis)
  if (!horizontalAxis) return null

  const byAxis = {
    x: axisEntries.find((entry) => entry.axis === 'x')!,
    y: axisEntries.find((entry) => entry.axis === 'y')!,
    z: axisEntries.find((entry) => entry.axis === 'z')!,
  }

  const widthMm = byAxis[horizontalAxis].size * 1000
  const heightMm = byAxis[verticalAxis].size * 1000
  if (widthMm <= 0 || heightMm <= 0) return null

  return {
    widthMm,
    heightMm,
    leftMm: byAxis[horizontalAxis].min * 1000,
    topMm: byAxis[verticalAxis].max * 1000,
  }
}

function normalizeModulo(value: number, mod: number): number {
  if (!Number.isFinite(mod) || mod <= 0) return 0
  return ((value % mod) + mod) % mod
}

// Čita stvarnu veličinu učitane slike, potrebnu da bismo isečak iz kanvasa bio precizan.
function getTextureImageSize(image: unknown): { width: number; height: number } | null {
  const candidate = image as { width?: number; height?: number } | null | undefined
  const width = Number(candidate?.width ?? 0)
  const height = Number(candidate?.height ?? 0)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

// Od jedne velike slike dekora pravi mali isečak baš za određeni front.
function buildFrontSliceTexture(
  source: THREE.Texture,
  sizeMm: { widthMm: number; heightMm: number },
  sliceMm?: { xMm?: number; yMm?: number },
  rotationQuarterTurns: 0 | 1 = 0,
): THREE.Texture {
  if (typeof document === 'undefined') return source.clone()

  const imageSize = getTextureImageSize(source.image)
  if (!imageSize) return source.clone()

  const isQuarterTurn = rotationQuarterTurns === 1
  const targetWidthMm = Math.max(sizeMm.widthMm, 1)
  const targetHeightMm = Math.max(sizeMm.heightMm, 1)
  const sourceWidthMm = isQuarterTurn ? targetHeightMm : targetWidthMm
  const sourceHeightMm = isQuarterTurn ? targetWidthMm : targetHeightMm

  const canvasWidth = Math.max(1, Math.round(imageSize.width * (targetWidthMm / DEFAULT_FRONT_SHEET.width)))
  const canvasHeight = Math.max(1, Math.round(imageSize.height * (targetHeightMm / DEFAULT_FRONT_SHEET.height)))

  // Kanvas služi samo kao privremena radna površina na kojoj sastavljamo komad teksture za front.
  const sliceCanvas = document.createElement('canvas')
  sliceCanvas.width = Math.max(1, Math.round(imageSize.width * (sourceWidthMm / DEFAULT_FRONT_SHEET.width)))
  sliceCanvas.height = Math.max(1, Math.round(imageSize.height * (sourceHeightMm / DEFAULT_FRONT_SHEET.height)))

  const sliceCtx = sliceCanvas.getContext('2d')
  if (!sliceCtx) return source.clone()

  const sourceImage = source.image as CanvasImageSource
  const startPxX = Math.round((normalizeModulo(Number(sliceMm?.xMm ?? 0), DEFAULT_FRONT_SHEET.width) / DEFAULT_FRONT_SHEET.width) * imageSize.width)
  const startPxY = Math.round((normalizeModulo(Number(sliceMm?.yMm ?? 0), DEFAULT_FRONT_SHEET.height) / DEFAULT_FRONT_SHEET.height) * imageSize.height)

  let destY = 0
  let srcY = startPxY
  while (destY < sliceCanvas.height) {
    const drawHeight = Math.min(imageSize.height - srcY, sliceCanvas.height - destY)
    let destX = 0
    let srcX = startPxX

    while (destX < sliceCanvas.width) {
      const drawWidth = Math.min(imageSize.width - srcX, sliceCanvas.width - destX)
      sliceCtx.drawImage(sourceImage, srcX, srcY, drawWidth, drawHeight, destX, destY, drawWidth, drawHeight)
      destX += drawWidth
      srcX = 0
    }

    destY += drawHeight
    srcY = 0
  }

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return source.clone()

  if (isQuarterTurn) {
    ctx.translate(canvasWidth / 2, canvasHeight / 2)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(sliceCanvas, -canvasHeight / 2, -canvasWidth / 2, canvasHeight, canvasWidth)
  } else {
    ctx.drawImage(sliceCanvas, 0, 0, canvasWidth, canvasHeight)
  }

  const next = new THREE.CanvasTexture(canvas)
  next.colorSpace = source.colorSpace
  next.flipY = source.flipY
  next.anisotropy = source.anisotropy
  next.generateMipmaps = source.generateMipmaps
  next.minFilter = source.minFilter
  next.magFilter = source.magFilter
  next.wrapS = THREE.ClampToEdgeWrapping
  next.wrapT = THREE.ClampToEdgeWrapping
  next.repeat.set(1, 1)
  next.offset.set(0, 0)
  next.center.set(0, 0)
  next.rotation = 0
  next.needsUpdate = true
  return next
}

// Podešava kako će se tekstura položiti na površinu: ponavljanje, pomeranje i rotacija.
function configureTextureTransform(
  texture: THREE.Texture,
  sizeMm: { widthMm: number; heightMm: number },
  config: TextureSetConfig,
  usage: 'front' | 'worktop',
  sliceMm?: { xMm?: number; yMm?: number },
) {
  const sheet = usage === 'front'
    ? DEFAULT_FRONT_SHEET
    : (config.sizeMm ?? DEFAULT_WORKTOP_SHEET)

  // Radna ploča sme da ponavlja teksturu, dok front ovde koristi isečak i ne sme da 'curi' preko ivice.
  texture.wrapS = usage === 'worktop' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  texture.wrapT = usage === 'worktop' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  texture.center.set(0, 0)
  texture.offset.set(0, 0)

  const grain = config.grain ?? 'none'
  // Frontovi koriste već pripremljen isečak, pa repeat ostaje 1:1.
  if (usage === 'front') {
    texture.repeat.set(1, 1)
    texture.rotation = 0
  } else {
    // Radna ploča računa koliko puta treba da ponovi šaru prema realnoj veličini elementa i slike.
    const repeatX = Math.max(sizeMm.widthMm / sheet.width, 0.35)
    const repeatY = Math.max(sizeMm.heightMm / sheet.height, 0.35)
    texture.repeat.set(repeatX, repeatY)
    texture.rotation = grain === 'vertical' ? Math.PI / 2 : 0
  }

  texture.needsUpdate = true
}

// Dodeljuje učitane mape materijalu: osnovnu sliku, roughness i normal gde je dostupno.
function applyLoadedTextureSet(
  material: THREE.MeshStandardMaterial,
  textures: Awaited<ReturnType<typeof loadTextureSet>>,
  config: TextureSetConfig,
  sizeMm: { widthMm: number; heightMm: number },
  usage: 'front' | 'worktop',
  requestRender?: () => void,
  sliceMm?: { xMm?: number; yMm?: number },
) {
  const frontRotationQuarterTurns: 0 | 1 = usage === 'front' && config.grain === 'vertical' ? 1 : 0
  const albedoTexture = usage === 'front'
    ? buildFrontSliceTexture(textures.albedo, sizeMm, sliceMm, frontRotationQuarterTurns)
    : textures.albedo
  configureTextureTransform(albedoTexture, sizeMm, config, usage, sliceMm)
  // Glavna vidljiva slika dekora.
  material.map = albedoTexture
  // Osnovni utisak mat ili sjajne površine.
  material.roughness = textures.roughnessValue

  if (textures.roughness) {
    const roughnessTexture = usage === 'front'
      ? buildFrontSliceTexture(textures.roughness, sizeMm, sliceMm, frontRotationQuarterTurns)
      : textures.roughness
    configureTextureTransform(roughnessTexture, sizeMm, config, usage, sliceMm)
    // Mapa koja lokalno menja mat/sjaj izgled površine.
    material.roughnessMap = roughnessTexture
  }
  if (textures.normal) {
    const normalTexture = usage === 'front'
      ? buildFrontSliceTexture(textures.normal, sizeMm, sliceMm, frontRotationQuarterTurns)
      : textures.normal
    configureTextureTransform(normalTexture, sizeMm, config, usage, sliceMm)
    // Mapa koja pod svetlom daje utisak sitnog reljefa.
    material.normalMap = normalTexture
    material.normalScale = new THREE.Vector2(textures.normalStrength, textures.normalStrength)
  }
  material.needsUpdate = true
  requestRender?.()
}

// Traži sve frontove unutar modela i lepi dekor samo na materijal fronta.
function applyFrontDecor(root: THREE.Object3D, decor: string | undefined, item: RenderableItem, requestRender?: () => void) {
  const resolvedDecor = decor ?? (item as { decor?: string }).decor ?? 'Bela'
  const textureConfig = getFrontTextureConfig(resolvedDecor)
  if (!textureConfig || !shouldApplyDecorToItem(item)) return
  const quality = detectQualityProfile()

  type FrontTarget = {
    mesh: THREE.Mesh
    originalMaterials: Material[]
    metrics: { widthMm: number; heightMm: number; leftMm: number; topMm: number }
  }

  const frontTargets: FrontTarget[] = []

  root.traverse((obj) => {
    if (!isMeshObject(obj) || !obj.material) return
    const originalMaterials = Array.isArray(obj.material) ? obj.material : [obj.material]
    const hasFrontMaterial = originalMaterials.some((mat: Material) => String(mat.name || '') === 'mesh_front')
    if (!hasFrontMaterial) return
    const metrics = getFrontFaceMetrics(obj)
    if (!metrics) return
    frontTargets.push({ mesh: obj, originalMaterials, metrics })
  })

  const itemLeftMm = frontTargets.length > 0
    ? Math.min(...frontTargets.map((target) => target.metrics.leftMm))
    : 0
  const itemTopMm = frontTargets.length > 0
    ? Math.max(...frontTargets.map((target) => target.metrics.topMm))
    : 0
  const plannedFrontSlice = frontDecorSlicePlan.get(item.uniqueId)
  const baseSliceXmm = plannedFrontSlice?.xMm ?? Number(item.x ?? 0)
  const baseSliceYmm = plannedFrontSlice?.yMm ?? 0

  frontTargets.forEach(({ mesh, originalMaterials, metrics }) => {
    let touched = false
    const widthMm = metrics.widthMm
    const heightMm = metrics.heightMm
    const frontSliceMm = {
      xMm: baseSliceXmm + Math.max(metrics.leftMm - itemLeftMm, 0),
      yMm: baseSliceYmm + Math.max(itemTopMm - metrics.topMm, 0),
    }

    const nextMaterials = originalMaterials.map((mat: Material) => {
      const materialName = String(mat.name || '')
      // Samo pravi front dobija dekor; ostali materijali ostaju netaknuti.
      if (materialName !== 'mesh_front') return mat
      touched = true
      const next = cloneWithPreservedBasics(mat, materialName)
      void loadTextureSet(textureConfig, quality.frontTextureMode, quality.textureAnisotropy).then((textures) => {
        applyLoadedTextureSet(next, textures, textureConfig, { widthMm, heightMm }, 'front', requestRender, frontSliceMm)

        if (quality.frontTextureMode === 'albedo' && quality.useDetailMaps) {
          void loadTextureSet(textureConfig, 'full', quality.textureAnisotropy).then((fullTextures) => {
            applyLoadedTextureSet(next, fullTextures, textureConfig, { widthMm, heightMm }, 'front', requestRender, frontSliceMm)
          }).catch(() => {})
        }
      }).catch(() => {})
      return next
    })

    if (!touched) return
    mesh.material = Array.isArray(mesh.material) ? nextMaterials : nextMaterials[0]
  })
}

// Pravi 3D radnu ploču koja se generiše u sceni i odmah dobija materijal, teksturu i senke.
export function createVirtualItemMesh(shape: KitchenShape, wallAMm: number, item: RenderableItem, optionsValues?: OptionsValues, requestRender?: () => void): PositionedRenderable | null {
  if (!isVirtualWorktopItem(item)) return null

  const wallKey = getWallKey(item)
  const lengthMm = Number(item.width ?? 0) || 0
  const depthMm = Number(item.depthMm ?? item.depth ?? 600) || 600
  const thicknessMm = Number(item.thicknessMm ?? 40) || 40
  const leftXMm = Number(item.x ?? 0) || 0
  const bottomYMm = Number(item.mountingHeight ?? 820) || 820

  const geometry = new THREE.BoxGeometry(lengthMm / 1000, thicknessMm / 1000, depthMm / 1000)
  // Osnovni materijal radne ploče, kasnije po potrebi dobija teksture i dodatne mape.
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.02 })
  material.name = 'worktop'

  const worktopTextureConfig = getWorktopTextureConfig(optionsValues?.worktop)
  if (worktopTextureConfig) {
    const quality = detectQualityProfile()
    void loadTextureSet(worktopTextureConfig, quality.worktopTextureMode, quality.textureAnisotropy).then((textures) => {
      applyLoadedTextureSet(material, textures, worktopTextureConfig, { widthMm: lengthMm, heightMm: depthMm }, 'worktop', requestRender)

      if (quality.worktopTextureMode === 'albedo' && quality.useDetailMaps) {
        void loadTextureSet(worktopTextureConfig, 'full', quality.textureAnisotropy).then((fullTextures) => {
          applyLoadedTextureSet(material, fullTextures, worktopTextureConfig, { widthMm: lengthMm, heightMm: depthMm }, 'worktop', requestRender)
        }).catch(() => {})
      }
    }).catch(() => {})
  }

  const mesh = markDisposable(new THREE.Mesh(geometry, material))
  mesh.name = 'worktop'
  // Radna ploča baca senku i zato jako utiče na izgled frontova ispod nje.
  mesh.castShadow = true
  // Radna ploča prima senku ostalih elemenata i svetala.
  mesh.receiveShadow = true

  const centerY = (bottomYMm + thicknessMm / 2) / 1000
  const centerAlongRunMm = leftXMm + lengthMm / 2

  if (shape === 'straight') {
    const startOffsetMm = -(wallAMm / 2)
    mesh.position.set((centerAlongRunMm + startOffsetMm) / 1000, centerY, depthMm / 2000)
    mesh.rotation.y = 0
  } else if (shape === 'parallel') {
    const halfGap = PARALLEL_GAP / 2
    if (wallKey === 'A') {
      const innerPlaneX = -halfGap
      mesh.position.set(innerPlaneX + depthMm / 2000, centerY, -centerAlongRunMm / 1000)
      mesh.rotation.y = Math.PI / 2
    } else {
      const innerPlaneX = halfGap
      mesh.position.set(innerPlaneX - depthMm / 2000, centerY, -centerAlongRunMm / 1000)
      mesh.rotation.y = -Math.PI / 2
    }
  } else {
    if (wallKey === 'B') {
      mesh.position.set(depthMm / 2000, centerY, -centerAlongRunMm / 1000)
      mesh.rotation.y = Math.PI / 2
    } else {
      mesh.position.set(centerAlongRunMm / 1000, centerY, -depthMm / 2000)
      mesh.rotation.y = Math.PI
    }
  }

  mesh.userData = { id: item.uniqueId }
  const quality = detectQualityProfile()
  addReadableEdges(mesh, quality.decorativeEdges)
  return { object: mesh, selectionId: item.uniqueId }
}

// Poseban materijal za ručkice i coklu, da metal i crne završne obrade izgledaju ubedljivije.
function createHandleOrPlinthMaterial(materialName: string, finish: string, fallback: THREE.Material) {
  const isBlack = finish === 'Crna'
  const isHandle = materialName === 'mesh_handle'
  //const color = isBlack ? 0x050505 : 0x8f949a
  const color = isBlack ? 0x101010 : 0xdbdddd
  //const roughness = isBlack ? 0.96 : 0.72
  //const metalness = isBlack ? 0.02 : 0.34  
  const roughness = isBlack ? 0.92 : 0.88
  const metalness = isBlack ? 0.32 : 0.72

  const standardMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    transparent: (fallback as THREE.Material & { transparent?: boolean }).transparent ?? false,
    opacity: (fallback as THREE.Material & { opacity?: number }).opacity ?? 1,
    side: (fallback as THREE.Material & { side?: THREE.Side }).side ?? THREE.FrontSide,
  })
  standardMaterial.name = materialName

  if (!isBlack && isHandle) {
    standardMaterial.emissive = new THREE.Color(0x111111)
    standardMaterial.emissiveIntensity = 0.02
  }

  return standardMaterial
}

function applyHandlesAndPlinthFinish(root: THREE.Object3D, finish: string) {
  root.traverse((obj) => {
    if (!isMeshObject(obj) || !obj.material) return

    const originalMaterials = Array.isArray(obj.material) ? obj.material : [obj.material]
    const nextMaterials = originalMaterials.map((mat: THREE.Material) => {
      const materialName = String(mat.name || '')
      if (materialName !== 'mesh_handle' && materialName !== 'mesh_cokla') return mat
      return createHandleOrPlinthMaterial(materialName, finish, mat)
    })

    obj.material = Array.isArray(obj.material) ? nextMaterials : nextMaterials[0]
  })
}


function getPlaceholderHeightMm(item: RenderableItem): number {
  const explicitHeight = Number((item as RenderableItem & { height?: number }).height ?? 0)
  if (explicitHeight > 0) return explicitHeight
  const supportRole = String((item as { supportRole?: string }).supportRole || '').toLowerCase()
  const catalogId = String(item.catalogId || '').toLowerCase()
  const category = String((item as { category?: string }).category || '').toLowerCase()
  if (supportRole === 'wall' || catalogId === 'wall' || category === 'wall') return 720
  if (catalogId === 'tall') return 2100
  return 720
}

function getPlaceholderDepthMm(item: RenderableItem): number {
  const explicitDepth = Number((item as RenderableItem & { depth?: number; depthMm?: number }).depthMm ?? (item as RenderableItem & { depth?: number }).depth ?? 0)
  if (explicitDepth > 0) return explicitDepth
  const supportRole = String((item as { supportRole?: string }).supportRole || '').toLowerCase()
  const catalogId = String(item.catalogId || '').toLowerCase()
  const category = String((item as { category?: string }).category || '').toLowerCase()
  if (supportRole === 'wall' || catalogId === 'wall' || category === 'wall') return 320
  return 560
}

function getPlaceholderBodyColor(item: RenderableItem): number {
  const decor = String((item as { decor?: string }).decor || '').toLowerCase()
  if (decor.includes('orah')) return 0x6f543d
  if (decor.includes('hrast')) return 0xb78c60
  if (decor.includes('zelena')) return 0x7f9178
  if (decor.includes('kašmir') || decor.includes('kasmir')) return 0xd8d0c3
  if (decor.includes('bež') || decor.includes('bez')) return 0xd8ccb8
  if (decor.includes('siva')) return decor.includes('dark') ? 0x6e737a : 0xb6bcc4
  return 0xe7eaee
}

export function createPlaceholderItemMesh(context: Omit<PositioningContext, 'model'>): PositionedRenderable | null {
  const { item } = context
  if (isVirtualWorktopItem(item) || String(item.catalogId || '') === '__support__') return null

  const widthMm = Math.max(300, Number(item.width ?? 600) || 600)
  const heightMm = Math.max(300, getPlaceholderHeightMm(item))
  const depthMm = Math.max(180, getPlaceholderDepthMm(item))

  const body = markDisposable(new THREE.Mesh(
    new THREE.BoxGeometry(widthMm / 1000, heightMm / 1000, depthMm / 1000),
    new THREE.MeshStandardMaterial({
      color: getPlaceholderBodyColor(item),
      //roughness: 0.92
      roughness: 0.92,
      metalness: 0.01,
    }),
  ))
  body.name = 'placeholder_body'

  const group = markDisposable(new THREE.Group())
  group.add(body)
  group.userData = { id: item.uniqueId, __placeholder: true }
  const quality = detectQualityProfile()
  addReadableEdges(group, quality.decorativeEdges)

  const positioned = positionModel({ ...context, model: group })
  positioned.object.userData = { ...positioned.object.userData, __placeholder: true }
  return positioned
}

export function positionModel({ shape, wallAMm, item, model, optionsValues, mountingHeightMm, activeElementsSubcat, requestRender }: PositioningContext): PositionedRenderable {
  void activeElementsSubcat
  if (!model) {
    throw new Error('Model is required for non-virtual items.')
  }

  const wallKey = getWallKey(item)
  const posXMm = Number(item.x ?? 0) || 0
  const finalY = mountingHeightMm / 1000
  let finalX = 0
  let finalZ = 0

  if (shape === 'straight') {
    finalX = (posXMm - wallAMm / 2) / 1000
    finalZ = 0
    model.rotation.y = 0
  } else if (shape === 'parallel') {
    const halfGap = PARALLEL_GAP / 2
    if (wallKey === 'A') {
      model.rotation.y = Math.PI / 2
      model.updateMatrixWorld(true)
      const bb = new THREE.Box3().setFromObject(model)
      finalX = -halfGap
      finalZ = -posXMm / 1000
    } else {
      const widthMm = Number(item.width || 0)
      finalX = halfGap
      finalZ = -(posXMm + widthMm) / 1000
      model.rotation.y = -Math.PI / 2
    }
  } else if (item.catalogId === 'corner') {
    const offset = 0
    model.rotation.y = Math.PI
    finalX = offset
    finalZ = -offset
  } else if (wallKey === 'B') {
    model.rotation.y = Math.PI / 2
    finalX = 0
    finalZ = -posXMm / 1000
  } else {
    model.rotation.y = Math.PI
    finalX = posXMm / 1000
    finalZ = 0
  }

  applyHandlesAndPlinthFinish(model, optionsValues?.handles ?? 'Crna')
  applyFrontDecor(model, (item as { decor?: string }).decor ?? optionsValues?.decor ?? 'Bela', item, requestRender)
  model.position.set(finalX, finalY, finalZ)
  model.userData = { id: item.uniqueId }
  const quality = detectQualityProfile()
  addReadableEdges(model, quality.decorativeEdges)
  return { object: model, selectionId: item.uniqueId }
}
