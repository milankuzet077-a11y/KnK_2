import React, { useCallback, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { KitchenShape, PlacedItem, WallKey, Walls } from '../../domain/types'
import type { CatalogElement } from '../../domain/catalog/catalogTypes'
import { computeRenderItemsByShape } from '../../domain/shapes/shared/step3Derivations'
import { removePlacedItem, tryPlaceItemStrict, validateAndPlaceAsync } from '../../domain/placement/placementService'
import type { OptionsValues } from '../options/types'
import type { Drawer } from './types'
import {
  DEFAULT_DECOR,
  ITEM_ADD_ERROR_MESSAGE,
  MIN_ITEM_LOADING_MS,
  ORDER_PLACEHOLDER_MESSAGE,
  makeSupportPlaceholder,
  supportsWorktop,
} from './configuratorShared'

export function useStep3Actions(params: {
  shape: KitchenShape
  walls: Walls
  placedItems: PlacedItem[]
  placedItemsRef: React.MutableRefObject<PlacedItem[]>
  targetWall: WallKey
  optionsValues: OptionsValues
  selectedItemId: string | null
  setSelectedItemId: React.Dispatch<React.SetStateAction<string | null>>
  isDesktop: boolean
  setDrawer: React.Dispatch<React.SetStateAction<Drawer>>
  sceneLoading: boolean
  pushState: (items: PlacedItem[]) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  resetLayout: () => void
  onBack: () => void
  onResetAll: () => void
}) {
  const {
    shape,
    walls,
    placedItems,
    placedItemsRef,
    targetWall,
    optionsValues,
    selectedItemId,
    setSelectedItemId,
    isDesktop,
    setDrawer,
    sceneLoading,
    pushState,
    canUndo,
    canRedo,
    undo,
    redo,
    resetLayout,
    onBack,
    onResetAll,
  } = params

  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showWorktopRemoveConfirm, setShowWorktopRemoveConfirm] = useState(false)
  const [itemLoading, setItemLoading] = useState(false)

  const addingRef = useRef(false)
  const pendingWorktopRemovalRef = useRef<null | (() => void)>(null)

  const handleAddItem = useCallback(async (catalogItem: CatalogElement) => {
    if (addingRef.current || sceneLoading || itemLoading) return
    addingRef.current = true
    setItemLoading(true)
    const startedAt = Date.now()
    const uniqueId = uuidv4()

    const finishLoading = async () => {
      const remaining = MIN_ITEM_LOADING_MS - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining))
      setItemLoading(false)
      addingRef.current = false
    }

    try {
      const strictResult = tryPlaceItemStrict({
        shape,
        walls,
        placedItems: placedItemsRef.current,
        catalogItem,
        targetWall,
        uniqueId,
      })

      if (strictResult.ok === false) {
        setAlertMsg(strictResult.message ?? 'Greška pri postavljanju.')
        await finishLoading()
        return
      }

      const validated = await validateAndPlaceAsync({
        shape,
        walls,
        placedItems: placedItemsRef.current,
        catalogItem,
        targetWall,
        uniqueId,
      })

      if (!validated.ok) {
        setAlertMsg(validated.message ?? 'Greška pri postavljanju.')
        await finishLoading()
        return
      }

      const preparedItem = {
        ...validated.item,
        decor: validated.item.decor ?? DEFAULT_DECOR,
        glbUrl: catalogItem.glb || validated.item.glbUrl,
      }
      const preloadTarget = computeRenderItemsByShape(shape, [...placedItemsRef.current, preparedItem], optionsValues)
      const { preloadSceneAssetsForItems } = await import('../../engine3d/modelLoader')
      const preloadResult = await Promise.allSettled([preloadSceneAssetsForItems(preloadTarget)])
      const failed = preloadResult.some((result) => result.status === 'rejected')
      if (failed) {
        setAlertMsg(ITEM_ADD_ERROR_MESSAGE)
        await finishLoading()
        return
      }

      pushState([...placedItemsRef.current, preparedItem])
      setSelectedItemId(null)
      if (!isDesktop) setDrawer('none')
      await finishLoading()
    } catch {
      setAlertMsg(ITEM_ADD_ERROR_MESSAGE)
      await finishLoading()
    }
  }, [isDesktop, itemLoading, optionsValues, placedItemsRef, pushState, sceneLoading, setDrawer, setSelectedItemId, shape, targetWall, walls])

  const handleBack = useCallback(() => {
    if (sceneLoading || itemLoading) return
    if (canUndo) {
      undo()
      setSelectedItemId(null)
      return
    }
    setShowBackConfirm(true)
  }, [canUndo, itemLoading, sceneLoading, setSelectedItemId, undo])

  const handleForward = useCallback(() => {
    if (sceneLoading || itemLoading) return
    if (!canRedo) return
    redo()
    setSelectedItemId(null)
  }, [canRedo, itemLoading, redo, sceneLoading, setSelectedItemId])

  const handleDeleteSelected = useCallback(() => {
    if (sceneLoading || itemLoading) return
    if (!selectedItemId) return
    const selectedItem = placedItems.find((item) => item.uniqueId === selectedItemId)
    if (!selectedItem) return

    const removeElementAndWorktop = () => {
      const nextItems = removePlacedItem(placedItems, selectedItemId)
      pushState(nextItems)
      setSelectedItemId(null)
    }

    if (optionsValues.worktop !== 'Bez Radne ploče' && supportsWorktop(selectedItem)) {
      pendingWorktopRemovalRef.current = removeElementAndWorktop
      setShowWorktopRemoveConfirm(true)
      return
    }

    removeElementAndWorktop()
  }, [itemLoading, optionsValues.worktop, placedItems, pushState, sceneLoading, selectedItemId, setSelectedItemId])

  const handleGlobalReset = useCallback(() => {
    if (sceneLoading || itemLoading) return
    resetLayout()
    setSelectedItemId(null)
    onResetAll()
    setShowResetConfirm(false)
  }, [itemLoading, onResetAll, resetLayout, sceneLoading, setSelectedItemId])

  const handleOrder = useCallback(() => {
    if (sceneLoading || itemLoading) return
    setAlertMsg(ORDER_PLACEHOLDER_MESSAGE)
  }, [itemLoading, sceneLoading])

  const handleRequestRemoveWorktop = useCallback((apply: () => void) => {
    if (sceneLoading || itemLoading) return
    pendingWorktopRemovalRef.current = apply
    setShowWorktopRemoveConfirm(true)
  }, [itemLoading, sceneLoading])

  const handleConfirmRemoveWorktop = useCallback(() => {
    if (sceneLoading || itemLoading) return
    const apply = pendingWorktopRemovalRef.current
    pendingWorktopRemovalRef.current = null
    setShowWorktopRemoveConfirm(false)
    if (apply) apply()
  }, [itemLoading, sceneLoading])

  const handleCancelRemoveWorktop = useCallback(() => {
    if (sceneLoading || itemLoading) return
    const selectedItem = selectedItemId ? placedItems.find((item) => item.uniqueId === selectedItemId) : null
    pendingWorktopRemovalRef.current = null
    setShowWorktopRemoveConfirm(false)

    if (selectedItemId && selectedItem && optionsValues.worktop !== 'Bez Radne ploče' && supportsWorktop(selectedItem)) {
      const withoutSelected = removePlacedItem(placedItems, selectedItemId)
      pushState([...withoutSelected, makeSupportPlaceholder(selectedItem)])
      setSelectedItemId(null)
    }
  }, [itemLoading, optionsValues.worktop, placedItems, pushState, sceneLoading, selectedItemId, setSelectedItemId])

  const resetTransientUi = useCallback(() => {
    setAlertMsg(null)
    setShowBackConfirm(false)
    setShowResetConfirm(false)
    setShowWorktopRemoveConfirm(false)
    pendingWorktopRemovalRef.current = null
    setSelectedItemId(null)
  }, [setSelectedItemId])

  return {
    alertMsg,
    setAlertMsg,
    showBackConfirm,
    setShowBackConfirm,
    showResetConfirm,
    setShowResetConfirm,
    showWorktopRemoveConfirm,
    itemLoading,
    handleAddItem,
    handleBack,
    handleForward,
    handleDeleteSelected,
    handleGlobalReset,
    handleOrder,
    handleRequestRemoveWorktop,
    handleConfirmRemoveWorktop,
    handleCancelRemoveWorktop,
    resetTransientUi,
    onBack,
  }
}
