import { useEffect, useRef, useState } from 'react'
import type { KitchenShape, PlacedItem, Walls } from '../../domain/types'
import { MIN_SCENE_LOADING_MS } from './configuratorShared'

export function useStep3SceneLoading(params: {
  shape: KitchenShape
  walls: Walls
  contextKey: string
  renderItems: PlacedItem[]
}) {
  const { shape, walls, contextKey, renderItems } = params
  const [sceneLoading, setSceneLoading] = useState(true)
  const sceneLoadSequenceRef = useRef(0)

  useEffect(() => {
    const sequence = ++sceneLoadSequenceRef.current
    const startedAt = Date.now()
    setSceneLoading(true)

    let cancelled = false
    ;(async () => {
      try {
        const { preloadSceneAssetsForItems } = await import('../../engine3d/modelLoader')
        await preloadSceneAssetsForItems(renderItems)
      } finally {
        const remaining = MIN_SCENE_LOADING_MS - (Date.now() - startedAt)
        if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining))
        if (cancelled || sequence !== sceneLoadSequenceRef.current) return
        setSceneLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [contextKey, renderItems, shape, walls])

  return sceneLoading
}
