import * as THREE from 'three'
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

const DEFAULT_WOOD_SHEET = { width: 1300, height: 2800 }
const DEFAULT_WORKTOP_SHEET = { width: 2800, height: 1300 }

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

function getFrontFaceSizeMm(mesh: THREE.Mesh): { widthMm: number; heightMm: number } | null {
  const geometry = mesh.geometry
  if (!geometry) return null
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const bbox = geometry.boundingBox
  if (!bbox) return null

  const size = new THREE.Vector3()
  bbox.getSize(size)
  size.multiply(mesh.scale)

  const dimensionsMm = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)]
    .map((value) => value * 1000)
    .sort((a, b) => b - a)

  if (dimensionsMm[1] <= 0) return null
  return { widthMm: dimensionsMm[1], heightMm: dimensionsMm[0] }
}

function configureTextureTransform(
  texture: THREE.Texture,
  sizeMm: { widthMm: number; heightMm: number },
  config: TextureSetConfig,
  usage: 'front' | 'worktop',
) {
  const sheet = config.sizeMm ?? (usage === 'front' ? DEFAULT_WOOD_SHEET : DEFAULT_WORKTOP_SHEET)
  texture.wrapS = usage === 'worktop' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  texture.wrapT = usage === 'worktop' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  texture.center.set(0.5, 0.5)
  texture.offset.set(0, 0)

  const grain = config.grain ?? 'none'
  if (usage === 'front') {
    texture.repeat.set(1, 1)
    texture.rotation = grain === 'vertical' ? Math.PI / 2 : 0
  } else {
    const repeatX = Math.max(sizeMm.widthMm / sheet.width, 0.35)
    const repeatY = Math.max(sizeMm.heightMm / sheet.height, 0.35)
    texture.repeat.set(repeatX, repeatY)
    texture.rotation = grain === 'vertical' ? Math.PI / 2 : 0
  }

  texture.needsUpdate = true
}

function applyLoadedTextureSet(
  material: THREE.MeshStandardMaterial,
  textures: Awaited<ReturnType<typeof loadTextureSet>>,
  config: TextureSetConfig,
  sizeMm: { widthMm: number; heightMm: number },
  usage: 'front' | 'worktop',
  requestRender?: () => void,
) {
  configureTextureTransform(textures.albedo, sizeMm, config, usage)
  material.map = textures.albedo
  material.roughness = textures.roughnessValue

  if (textures.roughness) {
    configureTextureTransform(textures.roughness, sizeMm, config, usage)
    material.roughnessMap = textures.roughness
  }
  if (textures.normal) {
    configureTextureTransform(textures.normal, sizeMm, config, usage)
    material.normalMap = textures.normal
    material.normalScale = new THREE.Vector2(textures.normalStrength, textures.normalStrength)
  }
  material.needsUpdate = true
  requestRender?.()
}

function applyFrontDecor(root: THREE.Object3D, decor: string | undefined, item: RenderableItem, requestRender?: () => void) {
  const resolvedDecor = decor ?? (item as { decor?: string }).decor ?? 'Bela'
  const textureConfig = getFrontTextureConfig(resolvedDecor)
  if (!textureConfig || !shouldApplyDecorToItem(item)) return
  const quality = detectQualityProfile()

  root.traverse((obj) => {
    if (!isMeshObject(obj) || !obj.material) return

    const originalMaterials = Array.isArray(obj.material) ? obj.material : [obj.material]
    let touched = false
    const frontFaceSize = getFrontFaceSizeMm(obj)
    const widthMm = frontFaceSize?.widthMm ?? Number(item.width ?? 600)
    const heightMm = frontFaceSize?.heightMm ?? Number((item as RenderableItem & { height?: number }).height ?? 720)

    const nextMaterials = originalMaterials.map((mat: Material) => {
      const materialName = String(mat.name || '')
      if (materialName !== 'mesh_front') return mat
      touched = true
      const next = cloneWithPreservedBasics(mat, materialName)
      void loadTextureSet(textureConfig, quality.frontTextureMode, quality.textureAnisotropy).then((textures) => {
        applyLoadedTextureSet(next, textures, textureConfig, { widthMm, heightMm }, 'front', requestRender)

        if (quality.frontTextureMode === 'albedo' && quality.useDetailMaps) {
          void loadTextureSet(textureConfig, 'full', quality.textureAnisotropy).then((fullTextures) => {
            applyLoadedTextureSet(next, fullTextures, textureConfig, { widthMm, heightMm }, 'front', requestRender)
          }).catch(() => {})
        }
      }).catch(() => {})
      return next
    })

    if (!touched) return
    obj.material = Array.isArray(obj.material) ? nextMaterials : nextMaterials[0]
  })
}

export function createVirtualItemMesh(shape: KitchenShape, wallAMm: number, item: RenderableItem, optionsValues?: OptionsValues, requestRender?: () => void): PositionedRenderable | null {
  if (!isVirtualWorktopItem(item)) return null

  const wallKey = getWallKey(item)
  const lengthMm = Number(item.width ?? 0) || 0
  const depthMm = Number(item.depthMm ?? item.depth ?? 600) || 600
  const thicknessMm = Number(item.thicknessMm ?? 40) || 40
  const leftXMm = Number(item.x ?? 0) || 0
  const bottomYMm = Number(item.mountingHeight ?? 820) || 820

  const geometry = new THREE.BoxGeometry(lengthMm / 1000, thicknessMm / 1000, depthMm / 1000)
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
  mesh.castShadow = true
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

function createHandleOrPlinthMaterial(materialName: string, finish: string, fallback: THREE.Material) {
  const isBlack = finish === 'Crna'
  const isHandle = materialName === 'mesh_handle'
  const color = isBlack ? 0x050505 : 0x8f949a
  const roughness = isBlack ? 0.96 : 0.72
  const metalness = isBlack ? 0.02 : 0.34

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
