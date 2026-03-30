import { NoColorSpace, SRGBColorSpace, TextureLoader } from 'three'
import type { ColorSpace, Texture } from 'three'
import type { TextureSetConfig } from './catalog'

export type DetailLevel = 'albedo' | 'full'

export type LoadedTextureSet = {
  albedo: Texture
  roughness?: Texture
  normal?: Texture
  normalStrength: number
  roughnessValue: number
}

const loader = new TextureLoader()
const textureSetCache = new Map<string, LoadedTextureSet>()
const texturePromiseCache = new Map<string, Promise<LoadedTextureSet>>()

function finalizeTexture(texture: Texture, colorSpace: ColorSpace, anisotropy: number) {
  texture.colorSpace = colorSpace
  texture.anisotropy = anisotropy
  texture.needsUpdate = Boolean((texture as Texture & { image?: unknown }).image)
}

function cloneTexture(texture?: Texture): Texture | undefined {
  if (!texture) return undefined
  const clone = texture.clone()
  clone.source = texture.source
  clone.needsUpdate = true
  return clone
}

function cloneTextureSet(set: LoadedTextureSet): LoadedTextureSet {
  return {
    albedo: cloneTexture(set.albedo)!,
    roughness: cloneTexture(set.roughness),
    normal: cloneTexture(set.normal),
    normalStrength: set.normalStrength,
    roughnessValue: set.roughnessValue,
  }
}

function loadTexture(url: string, colorSpace: ColorSpace, anisotropy = 4): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        finalizeTexture(texture, colorSpace, anisotropy)
        resolve(texture)
      },
      undefined,
      reject,
    )
  })
}

async function buildTextureSet(config: TextureSetConfig, detailLevel: DetailLevel, anisotropy: number): Promise<LoadedTextureSet> {
  const shouldLoadDetailMaps = detailLevel === 'full'
  const [albedo, roughness, normal] = await Promise.all([
    loadTexture(config.albedo, SRGBColorSpace, anisotropy),
    shouldLoadDetailMaps && config.roughness ? loadTexture(config.roughness, NoColorSpace, anisotropy) : Promise.resolve(undefined),
    shouldLoadDetailMaps && config.normal ? loadTexture(config.normal, NoColorSpace, anisotropy) : Promise.resolve(undefined),
  ])

  return {
    albedo,
    roughness,
    normal,
    normalStrength: config.normalStrength ?? 0.12,
    roughnessValue: config.roughnessValue ?? 0.85,
  }
}

export async function loadTextureSet(config: TextureSetConfig, detailLevel: DetailLevel = 'full', anisotropy = 4): Promise<LoadedTextureSet> {
  const key = JSON.stringify({ config, detailLevel, anisotropy })
  const cached = textureSetCache.get(key)
  if (cached) return cloneTextureSet(cached)

  const inflight = texturePromiseCache.get(key)
  if (inflight) return cloneTextureSet(await inflight)

  const promise = buildTextureSet(config, detailLevel, anisotropy)
    .then((result) => {
      textureSetCache.set(key, result)
      return result
    })
    .finally(() => {
      texturePromiseCache.delete(key)
    })

  texturePromiseCache.set(key, promise)
  return cloneTextureSet(await promise)
}

export function primeTextureSet(config: TextureSetConfig | null | undefined, detailLevel: DetailLevel = 'full', anisotropy = 4): Promise<LoadedTextureSet | null> {
  if (!config) return Promise.resolve(null)
  return loadTextureSet(config, detailLevel, anisotropy)
}
