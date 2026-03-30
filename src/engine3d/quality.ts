export type QualityTier = 'low' | 'medium' | 'high'
export type ShadowQualityMode = 'off' | 'basic' | 'soft'

export type DeviceCapabilities = {
  devicePixelRatio: number
  hardwareConcurrency: number
  deviceMemory: number
  saveData: boolean
  effectiveType: string
  maxTextureSize: number
  maxRenderbufferSize: number
  maxSamples: number
  maxAnisotropy: number
  isWebGL2: boolean
  renderer: string
  vendor: string
  maxTouchPoints: number
}

export type DecorativeEdgeProfile = {
  enabled: boolean
  thresholdAngle: number
  opacity: number
  color: number
}

export type QualityProfile = {
  tier: QualityTier
  capabilities: DeviceCapabilities
  antialias: boolean
  minPixelRatio: number
  targetPixelRatio: number
  maxPixelRatio: number
  interactionPixelRatio: number
  useDetailMaps: boolean
  textureAnisotropy: number
  modelPrefetchLimit: number
  frontTextureMode: 'albedo' | 'full'
  worktopTextureMode: 'albedo' | 'full'
  shadows: {
    enabled: boolean
    mapSize: number
    mode: ShadowQualityMode
  }
  decorativeEdges: DecorativeEdgeProfile
}

export type RuntimeQualityLevel = {
  tier: QualityTier
  pixelRatio: number
  interactionPixelRatio: number
  shadowMode: ShadowQualityMode
  shadowMapSize: number
  edgeLines: boolean
  edgeOpacity: number
}

declare global {
  interface Navigator {
    deviceMemory?: number
    connection?: {
      saveData?: boolean
      effectiveType?: string
    }
  }
}

let cachedCapabilities: DeviceCapabilities | null = null
let cachedProfile: QualityProfile | null = null

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundToQuarter(value: number) {
  return Math.round(value * 4) / 4
}

function normalizePow2(value: number) {
  const safe = clamp(Math.round(value), 256, 4096)
  const exp = Math.round(Math.log2(safe))
  return 2 ** exp
}

function getNavigatorNumber(value: unknown) {
  const numeric = Number(value || 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function readWebGLCapabilities() {
  if (typeof document === 'undefined') {
    return {
      maxTextureSize: 4096,
      maxRenderbufferSize: 4096,
      maxSamples: 0,
      maxAnisotropy: 1,
      isWebGL2: false,
      renderer: '',
      vendor: '',
    }
  }

  try {
    const canvas = document.createElement('canvas')
    const webgl2 = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' }) as WebGL2RenderingContext | null
    const gl = webgl2 ?? canvas.getContext('webgl', { antialias: true, powerPreference: 'high-performance' }) as WebGLRenderingContext | null
    if (!gl) {
      return {
        maxTextureSize: 4096,
        maxRenderbufferSize: 4096,
        maxSamples: 0,
        maxAnisotropy: 1,
        isWebGL2: false,
        renderer: '',
        vendor: '',
      }
    }

    const anisotropyExtension =
      gl.getExtension('EXT_texture_filter_anisotropic')
      || gl.getExtension('MOZ_EXT_texture_filter_anisotropic')
      || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '') : ''
    const vendor = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '') : ''
    const maxAnisotropy = anisotropyExtension
      ? Number(gl.getParameter(anisotropyExtension.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1)
      : 1

    return {
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096),
      maxRenderbufferSize: Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096),
      maxSamples: webgl2 ? Number(webgl2.getParameter(webgl2.MAX_SAMPLES) || 0) : 0,
      maxAnisotropy: Number.isFinite(maxAnisotropy) && maxAnisotropy > 0 ? maxAnisotropy : 1,
      isWebGL2: Boolean(webgl2),
      renderer,
      vendor,
    }
  } catch {
    return {
      maxTextureSize: 4096,
      maxRenderbufferSize: 4096,
      maxSamples: 0,
      maxAnisotropy: 1,
      isWebGL2: false,
      renderer: '',
      vendor: '',
    }
  }
}

export function getDeviceCapabilities(): DeviceCapabilities {
  if (cachedCapabilities) return cachedCapabilities

  const devicePixelRatio = typeof window !== 'undefined' ? clamp(window.devicePixelRatio || 1, 1, 4) : 1
  const hardwareConcurrency = typeof navigator !== 'undefined' ? getNavigatorNumber(navigator.hardwareConcurrency) : 0
  const deviceMemory = typeof navigator !== 'undefined' ? getNavigatorNumber(navigator.deviceMemory) : 0
  const saveData = typeof navigator !== 'undefined' ? Boolean(navigator.connection?.saveData) : false
  const effectiveType = typeof navigator !== 'undefined' ? String(navigator.connection?.effectiveType || '') : ''
  const maxTouchPoints = typeof navigator !== 'undefined' ? getNavigatorNumber(navigator.maxTouchPoints) : 0
  const webgl = readWebGLCapabilities()

  cachedCapabilities = {
    devicePixelRatio,
    hardwareConcurrency,
    deviceMemory,
    saveData,
    effectiveType,
    maxTextureSize: webgl.maxTextureSize,
    maxRenderbufferSize: webgl.maxRenderbufferSize,
    maxSamples: webgl.maxSamples,
    maxAnisotropy: webgl.maxAnisotropy,
    isWebGL2: webgl.isWebGL2,
    renderer: webgl.renderer,
    vendor: webgl.vendor,
    maxTouchPoints,
  }

  return cachedCapabilities
}

function scoreCapabilities(capabilities: DeviceCapabilities) {
  let score = 0

  if (capabilities.saveData) score -= 3
  if (capabilities.effectiveType === 'slow-2g' || capabilities.effectiveType === '2g') score -= 3
  else if (capabilities.effectiveType === '3g') score -= 2

  if (capabilities.hardwareConcurrency >= 8) score += 3
  else if (capabilities.hardwareConcurrency >= 6) score += 2
  else if (capabilities.hardwareConcurrency >= 4) score += 1
  else if (capabilities.hardwareConcurrency > 0) score -= 2

  if (capabilities.deviceMemory >= 8) score += 3
  else if (capabilities.deviceMemory >= 6) score += 2
  else if (capabilities.deviceMemory >= 4) score += 1
  else if (capabilities.deviceMemory > 0) score -= 2

  if (capabilities.maxTextureSize >= 16384) score += 3
  else if (capabilities.maxTextureSize >= 8192) score += 2
  else if (capabilities.maxTextureSize >= 4096) score += 1
  else score -= 2

  if (capabilities.maxRenderbufferSize >= 8192) score += 2
  else if (capabilities.maxRenderbufferSize >= 4096) score += 1
  else score -= 2

  if (capabilities.maxAnisotropy >= 8) score += 1
  else if (capabilities.maxAnisotropy <= 2) score -= 1

  if (capabilities.isWebGL2) score += 1
  if (capabilities.maxSamples >= 4) score += 1

  return score
}

function pickTier(capabilities: DeviceCapabilities): QualityTier {
  const score = scoreCapabilities(capabilities)
  if (score <= 1) return 'low'
  if (score >= 7) return 'high'
  return 'medium'
}

function createHighProfile(capabilities: DeviceCapabilities): QualityProfile {
  const devicePixelRatio = capabilities.devicePixelRatio
  const maxPixelRatio = roundToQuarter(clamp(Math.min(devicePixelRatio, 3), 1.5, 3))
  const targetPixelRatio = roundToQuarter(clamp(Math.min(devicePixelRatio, 2.5), 1.5, maxPixelRatio))
  const minPixelRatio = roundToQuarter(clamp(Math.min(devicePixelRatio, 1.75), 1.25, targetPixelRatio))

  return {
    tier: 'high',
    capabilities,
    antialias: true,
    minPixelRatio,
    targetPixelRatio,
    maxPixelRatio,
    interactionPixelRatio: roundToQuarter(clamp(Math.min(devicePixelRatio, 2.25), minPixelRatio, maxPixelRatio)),
    useDetailMaps: true,
    textureAnisotropy: Math.max(2, Math.min(12, Math.round(capabilities.maxAnisotropy || 1))),
    modelPrefetchLimit: 8,
    frontTextureMode: 'full',
    worktopTextureMode: 'full',
    shadows: {
      enabled: true,
      mapSize: capabilities.maxTextureSize >= 8192 ? 2048 : 1024,
      mode: 'soft',
    },
    decorativeEdges: {
      enabled: true,
      thresholdAngle: 32,
      opacity: 0.22,
      color: 0x2c2f34,
    },
  }
}

function createMediumProfile(capabilities: DeviceCapabilities): QualityProfile {
  const devicePixelRatio = capabilities.devicePixelRatio
  const maxPixelRatio = roundToQuarter(clamp(Math.min(devicePixelRatio, 2.25), 1.25, 2.25))
  const targetPixelRatio = roundToQuarter(clamp(Math.min(devicePixelRatio, 1.8), 1.25, maxPixelRatio))
  const minPixelRatio = roundToQuarter(clamp(Math.min(devicePixelRatio, 1.1), 1, targetPixelRatio))

  return {
    tier: 'medium',
    capabilities,
    antialias: true,
    minPixelRatio,
    targetPixelRatio,
    maxPixelRatio,
    interactionPixelRatio: roundToQuarter(clamp(Math.min(targetPixelRatio, 1.35), minPixelRatio, targetPixelRatio)),
    useDetailMaps: true,
    textureAnisotropy: Math.max(2, Math.min(8, Math.round(capabilities.maxAnisotropy || 1))),
    modelPrefetchLimit: 5,
    frontTextureMode: 'full',
    worktopTextureMode: 'full',
    shadows: {
      enabled: true,
      mapSize: capabilities.maxTextureSize >= 4096 ? 1024 : 512,
      mode: 'soft',
    },
    decorativeEdges: {
      enabled: true,
      thresholdAngle: 30,
      opacity: 0.24,
      color: 0x2c2f34,
    },
  }
}

function createLowProfile(capabilities: DeviceCapabilities): QualityProfile {
  const devicePixelRatio = capabilities.devicePixelRatio
  const maxPixelRatio = roundToQuarter(clamp(Math.min(devicePixelRatio, 1.35), 1, 1.35))
  const targetPixelRatio = roundToQuarter(clamp(Math.min(devicePixelRatio, 1.1), 1, maxPixelRatio))
  const minPixelRatio = roundToQuarter(clamp(Math.min(targetPixelRatio, 0.9), 0.85, targetPixelRatio))

  return {
    tier: 'low',
    capabilities,
    antialias: false,
    minPixelRatio,
    targetPixelRatio,
    maxPixelRatio,
    interactionPixelRatio: roundToQuarter(clamp(Math.min(targetPixelRatio, 0.9), 0.85, targetPixelRatio)),
    useDetailMaps: false,
    textureAnisotropy: Math.max(1, Math.min(4, Math.round(capabilities.maxAnisotropy || 1))),
    modelPrefetchLimit: 3,
    frontTextureMode: 'albedo',
    worktopTextureMode: 'albedo',
    shadows: {
      enabled: true,
      mapSize: capabilities.maxTextureSize >= 4096 ? 512 : 256,
      mode: 'basic',
    },
    decorativeEdges: {
      enabled: false,
      thresholdAngle: 36,
      opacity: 0.18,
      color: 0x2c2f34,
    },
  }
}

export function detectQualityProfile(): QualityProfile {
  if (cachedProfile) return cachedProfile

  const capabilities = getDeviceCapabilities()
  const tier = pickTier(capabilities)

  cachedProfile = tier === 'high'
    ? createHighProfile(capabilities)
    : tier === 'medium'
      ? createMediumProfile(capabilities)
      : createLowProfile(capabilities)

  return cachedProfile
}

function uniqueRatios(values: number[]) {
  const rounded = values
    .map((value) => roundToQuarter(value))
    .filter((value) => Number.isFinite(value) && value > 0)

  return rounded.filter((value, index) => rounded.findIndex((candidate) => Math.abs(candidate - value) < 0.08) === index)
}

export function buildRuntimeQualityLevels(profile: QualityProfile): RuntimeQualityLevel[] {
  const ratios = profile.tier === 'high'
    ? uniqueRatios([
        profile.maxPixelRatio,
        profile.targetPixelRatio,
        Math.max(profile.minPixelRatio, (profile.targetPixelRatio + profile.minPixelRatio) / 2),
        profile.minPixelRatio,
      ])
    : profile.tier === 'medium'
      ? uniqueRatios([
          profile.maxPixelRatio,
          profile.targetPixelRatio,
          profile.minPixelRatio,
        ])
      : uniqueRatios([
          profile.targetPixelRatio,
          profile.minPixelRatio,
        ])

  if (ratios.length === 0) {
    ratios.push(roundToQuarter(profile.targetPixelRatio))
  }

  return ratios.map((pixelRatio, index) => {
    const lastIndex = Math.max(0, ratios.length - 1)
    const progress = lastIndex === 0 ? 0 : index / lastIndex
    const isLowestLevel = index === lastIndex
    const edgeLines = profile.decorativeEdges.enabled && (!isLowestLevel || pixelRatio > 1.15)
    const edgeOpacity = clamp(profile.decorativeEdges.opacity + progress * 0.05, 0.16, 0.3)

    let shadowMode: ShadowQualityMode = profile.shadows.mode
    let shadowMapSize = profile.shadows.mapSize

    if (!profile.shadows.enabled) {
      shadowMode = 'off'
      shadowMapSize = 0
    } else if (profile.tier === 'high') {
      shadowMode = index <= 1 ? 'soft' : 'basic'
      shadowMapSize = normalizePow2(index <= 1 ? profile.shadows.mapSize : profile.shadows.mapSize / 2)
      if (isLowestLevel) {
        shadowMode = 'basic'
        shadowMapSize = Math.max(512, normalizePow2(profile.shadows.mapSize / 4))
      }
    } else if (profile.tier === 'medium') {
      shadowMode = index === 0 ? 'soft' : 'basic'
      shadowMapSize = normalizePow2(index === 0 ? profile.shadows.mapSize : profile.shadows.mapSize / 2)
    } else {
      shadowMode = index === 0 ? 'basic' : 'off'
      shadowMapSize = index === 0 ? normalizePow2(profile.shadows.mapSize) : 0
    }

    return {
      tier: profile.tier,
      pixelRatio,
      interactionPixelRatio: Math.min(pixelRatio, profile.interactionPixelRatio),
      shadowMode,
      shadowMapSize,
      edgeLines,
      edgeOpacity,
    }
  })
}

export function resetQualityProfileCache() {
  cachedCapabilities = null
  cachedProfile = null
}
