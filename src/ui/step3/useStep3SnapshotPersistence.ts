import { useEffect, useLayoutEffect } from 'react'
import { writeStep3Snapshot } from './snapshot'
import { createStep3SnapshotPayload, type DecorByGroup, type DecorGroup } from './configuratorShared'
import type { KitchenShape, PlacedItem, WallKey, Walls } from '../../domain/types'
import type { OptionTab, OptionsValues } from '../options/types'
import type { Drawer, Subcat } from './types'

export function useStep3SnapshotPersistence(params: {
  shape: KitchenShape
  walls: Walls
  placedItems: PlacedItem[]
  optionsValues: OptionsValues
  decorByGroup: DecorByGroup
  drawer: Drawer
  optionTab: OptionTab
  activeElementsSubcat: Subcat
  activeDecorGroup: DecorGroup
  targetWall: WallKey
  selectedItemId: string | null
  elementsScrollTop: number
  optionsScrollTop: number
}) {
  const {
    shape,
    walls,
    placedItems,
    optionsValues,
    decorByGroup,
    drawer,
    optionTab,
    activeElementsSubcat,
    activeDecorGroup,
    targetWall,
    selectedItemId,
    elementsScrollTop,
    optionsScrollTop,
  } = params

  const snapshot = createStep3SnapshotPayload({
    shape,
    walls,
    placedItems,
    optionsValues,
    decorByGroup,
    drawer,
    optionTab,
    activeElementsSubcat,
    activeDecorGroup,
    targetWall,
    selectedItemId,
    elementsScrollTop,
    optionsScrollTop,
  })

  useLayoutEffect(() => {
    writeStep3Snapshot(snapshot)
  }, [snapshot])

  useEffect(() => {
    const flush = () => writeStep3Snapshot(snapshot)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [snapshot])
}
