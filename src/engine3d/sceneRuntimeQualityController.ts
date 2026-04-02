import * as THREE from 'three'
import { buildRuntimeQualityLevels, type QualityProfile, type RuntimeQualityLevel } from './quality'
import { setDecorativeEdgesState } from './shared'
import { SCENE_PRESET } from './scenePreset'
import type { AdaptiveQualityController } from './sceneRuntimeTypes'

const QUALITY_DOWNGRADE_THRESHOLD_MS = 24
const QUALITY_UPGRADE_THRESHOLD_MS = 15.5
const QUALITY_SAMPLE_SIZE = 45
const QUALITY_ADJUST_COOLDOWN_MS = 1800
const QUALITY_WARMUP_FRAMES = 18
const INTERACTION_RESTORE_DELAY_MS = 140

export function createAdaptiveQualityController(params: {
  renderer: THREE.WebGLRenderer
  quality: QualityProfile
  directionalLight: THREE.DirectionalLight
  itemsGroup: THREE.Group
}): AdaptiveQualityController {
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
