import type { KitchenShape, Walls, PlacedItem, WallKey } from '../domain/types'
import type { CatalogElement } from '../domain/catalog/catalogTypes'
import { getCornerWorktopMetaByElementId } from '../domain/catalog/cornerWorktop'
import { getActiveWall } from '../domain/shapes/shared/uiShapeConfig'
import { computeRenderItemsByShape, computeActiveStatsByShape } from '../domain/shapes/shared/step3Derivations'
import { removePlacedItem, tryPlaceItemStrict, validateAndPlaceAsync } from '../domain/placement/placementService'
import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLayoutHistory } from './step3/useLayoutHistory'
import { useMediaQuery } from './useMediaQuery'
import { DEFAULT_OPTIONS } from './options/config'
import type { OptionTab, OptionsValues } from './options/types'
import { v4 as uuidv4 } from 'uuid'
import type { Drawer, Subcat } from './step3/types'
import { InfoDialog, ConfirmDialog } from './step3/dialogs'
import { Step3Header } from './step3/Step3Header'
import { markPerf } from '../engine3d/metrics/perf'
import { Step3DesktopChrome } from './step3/Step3DesktopChrome'
import { Step3MobileChrome } from './step3/Step3MobileChrome'
import { readStep3Snapshot, writeStep3Snapshot } from './step3/snapshot'

const ORDER_PLACEHOLDER_MESSAGE = 'Slanje porudžbine još nije aktivirano u ovoj verziji aplikacije.'
const DEFAULT_DECOR = 'Bela'
const STEP3_SCENE_LOADING_MESSAGE = 'Učitavanje 3D scene, molimo sačekajte'
const ITEM_LOADING_MESSAGE = 'Učitavanje, molimo sačekajte'
const ITEM_ADD_ERROR_MESSAGE = 'Trenutno nije moguće dodati element. Pokušajte ponovo.'
const MIN_SCENE_LOADING_MS = 1000
const MIN_ITEM_LOADING_MS = 500

const Canvas3DLazy = lazy(() => import('../engine3d/Canvas3DLazy').then((m) => ({ default: m.Canvas3DLazy })))

type DecorGroup = Extract<Subcat, 'Donji' | 'Gornji' | 'Visoki'>
type DecorByGroup = Record<DecorGroup, string>

function isDecorGroup(value: Subcat): value is DecorGroup {
  return value === 'Donji' || value === 'Gornji' || value === 'Visoki'
}

function getDecorGroupForItem(item: PlacedItem): DecorGroup | null {
  const supportRole = item.supportRole
  if (supportRole === 'base') return 'Donji'
  if (supportRole === 'wall') return 'Gornji'

  const catalogId = String(item.catalogId || '').toLowerCase()
  if (catalogId === 'base') return 'Donji'
  if (catalogId === 'wall') return 'Gornji'
  if (catalogId === 'tall') return 'Visoki'
  if (catalogId !== 'corner') return null

  const category = String(item.category || '').toLowerCase()
  if (category === 'base') return 'Donji'
  if (category === 'wall') return 'Gornji'
  return null
}

function applyDecorToGroup(items: PlacedItem[], group: DecorGroup, decor: string): { items: PlacedItem[]; changed: boolean } {
  let changed = false
  const nextItems = items.map((item) => {
    if (getDecorGroupForItem(item) !== group) return item
    if ((item.decor ?? DEFAULT_DECOR) === decor) return item
    changed = true
    return { ...item, decor }
  })
  return { items: nextItems, changed }
}

function supportsWorktop(item: PlacedItem): boolean {
  const supportRole = item.supportRole
  if (supportRole === 'base') return true
  if (supportRole === 'wall') return false

  const catalogId = String(item.catalogId || '').toLowerCase()
  if (catalogId === 'base') return true
  if (catalogId !== 'corner') return false
  return String(item.category || '').toLowerCase() === 'base'
}

function makeSupportPlaceholder(item: PlacedItem): PlacedItem {
  return {
    ...item,
    uniqueId: `__support__${item.uniqueId}`,
    catalogId: '__support__',
    supportRole: getDecorGroupForItem(item) === 'Gornji' ? 'wall' : 'base',
    supportSourceCatalogId: String(item.catalogId || ''),
    worktopMeta: String(item.catalogId || '').toLowerCase() === 'corner'
      ? (getCornerWorktopMetaByElementId(String(item.elementId || '')) ?? item.worktopMeta)
      : undefined,
  }
}

function buildInitialStep3View(shape: KitchenShape, walls: Walls) {
  const snapshot = readStep3Snapshot(shape, walls)
  if (!snapshot) {
    return {
      drawer: 'none' as Drawer,
      optionTab: null as OptionTab,
      optionsValues: DEFAULT_OPTIONS,
      decorByGroup: { Donji: DEFAULT_DECOR, Gornji: DEFAULT_DECOR, Visoki: DEFAULT_DECOR } as DecorByGroup,
      activeElementsSubcat: (shape === 'l-shape' ? 'Ugao' : 'Donji') as Subcat,
      activeDecorGroup: 'Donji' as DecorGroup,
      targetWall: 'A' as WallKey,
      selectedItemId: null as string | null,
      elementsScrollTop: 0,
      optionsScrollTop: 0,
    }
  }

  return {
    drawer: snapshot.ui.drawer,
    optionTab: snapshot.ui.optionTab,
    optionsValues: snapshot.optionsValues,
    decorByGroup: snapshot.decorByGroup,
    activeElementsSubcat: snapshot.ui.activeElementsSubcat,
    activeDecorGroup: snapshot.ui.activeDecorGroup,
    targetWall: snapshot.ui.targetWall,
    selectedItemId: snapshot.ui.selectedItemId,
    elementsScrollTop: snapshot.ui.elementsScrollTop,
    optionsScrollTop: snapshot.ui.optionsScrollTop,
  }
}

export function Step3Configurator({
  shape,
  walls,
  onBack,
  onNext,
  onResetAll,
}: {
  shape: KitchenShape
  walls: Walls
  onBack: () => void
  onNext: () => void
  onResetAll: () => void
}) {
  const isDesktop = useMediaQuery('(min-width: 1026px)')
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isPreviewOnlyLandscape = !isDesktop && isLandscape
  const initialView = useMemo(() => buildInitialStep3View(shape, walls), [shape, walls])
  const [drawer, setDrawer] = useState<Drawer>(() => initialView.drawer)
  const closeDrawer = () => setDrawer('none')
  const [optionTab, setOptionTab] = useState<OptionTab>(() => initialView.optionTab)
  const [optionsValues, setOptionsValues] = useState<OptionsValues>(() => initialView.optionsValues)
  const [decorByGroup, setDecorByGroup] = useState<DecorByGroup>(() => initialView.decorByGroup)
  const [activeElementsSubcat, setActiveElementsSubcat] = useState<Subcat>(() => initialView.activeElementsSubcat)
  const [activeDecorGroup, setActiveDecorGroup] = useState<DecorGroup>(() => initialView.activeDecorGroup)
  const [targetWall, setTargetWall] = useState<WallKey>(() => initialView.targetWall)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(() => initialView.selectedItemId)
  const [elementsScrollTop, setElementsScrollTop] = useState<number>(() => initialView.elementsScrollTop)
  const [optionsScrollTop, setOptionsScrollTop] = useState<number>(() => initialView.optionsScrollTop)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showWorktopRemoveConfirm, setShowWorktopRemoveConfirm] = useState(false)
  const [sceneLoading, setSceneLoading] = useState(true)
  const [itemLoading, setItemLoading] = useState(false)
  const pendingWorktopRemovalRef = useRef<null | (() => void)>(null)

  const isIShape = shape === 'straight'
  const availableWalls: WallKey[] = useMemo(() => (shape === 'straight' ? ['A'] : ['A', 'B']), [shape])

  useEffect(() => {
    if (isIShape) {
      if (targetWall !== 'A') setTargetWall('A')
      return
    }
    if (!availableWalls.includes(targetWall)) {
      setTargetWall(availableWalls[0] ?? 'A')
    }
  }, [availableWalls, isIShape, targetWall])

  const {
    placedItems,
    pushState,
    canUndo,
    canRedo,
    undo,
    redo,
    reset: resetLayout,
    contextKey,
  } = useLayoutHistory(shape, walls)

  const placedItemsRef = useRef<PlacedItem[]>(placedItems)
  const addingRef = useRef(false)
  const sceneLoadSequenceRef = useRef(0)

  useEffect(() => {
    placedItemsRef.current = placedItems
  }, [placedItems])

  useEffect(() => {
    const restored = buildInitialStep3View(shape, walls)
    setDrawer(restored.drawer)
    setOptionTab(restored.optionTab)
    setOptionsValues(restored.optionsValues)
    setDecorByGroup(restored.decorByGroup)
    setActiveElementsSubcat(restored.activeElementsSubcat)
    setActiveDecorGroup(restored.activeDecorGroup)
    setTargetWall(restored.targetWall)
    setSelectedItemId(restored.selectedItemId)
    setElementsScrollTop(restored.elementsScrollTop)
    setOptionsScrollTop(restored.optionsScrollTop)
  }, [shape, walls, contextKey])

  useEffect(() => {
    if (!isPreviewOnlyLandscape) return
    setDrawer('none')
    setAlertMsg(null)
    setShowBackConfirm(false)
    setShowResetConfirm(false)
    setShowWorktopRemoveConfirm(false)
    pendingWorktopRemovalRef.current = null
    setSelectedItemId(null)
  }, [isPreviewOnlyLandscape])


  const renderItems: PlacedItem[] = useMemo(
    () => computeRenderItemsByShape(shape, placedItems, optionsValues),
    [shape, placedItems, optionsValues]
  )

  const sceneAssetKey = useMemo(
    () => renderItems
      .filter((item) => String(item.catalogId || '') !== '__virtual__')
      .map((item) => `${item.uniqueId}:${item.catalogId}:${item.elementId}:${item.glbUrl || ''}`)
      .join('|'),
    [renderItems],
  )

  useEffect(() => {
    setSelectedItemId((current) => {
      if (!current) return null
      return placedItems.some((item) => item.uniqueId === current) ? current : null
    })
  }, [contextKey, placedItems])

  useEffect(() => {
    const nextDecor = decorByGroup[activeDecorGroup]
    setOptionsValues((current) => (current.decor === nextDecor ? current : { ...current, decor: nextDecor }))
  }, [activeDecorGroup, decorByGroup])

  const setOptionsValuesWithDecorSync = useCallback<React.Dispatch<React.SetStateAction<OptionsValues>>>((updater) => {
    const previous = optionsValues
    const next = typeof updater === 'function' ? updater(previous) : updater

    if (next.decor !== previous.decor) {
      const group = activeDecorGroup
      const decor = next.decor || DEFAULT_DECOR
      setDecorByGroup((current) => (current[group] === decor ? current : { ...current, [group]: decor }))

      const result = applyDecorToGroup(placedItemsRef.current, group, decor)
      if (result.changed) pushState(result.items)
    }

    setOptionsValues(next)
  }, [activeDecorGroup, optionsValues, pushState])

  const activeWall: WallKey = getActiveWall(shape, targetWall)
  const activeStats = useMemo(
    () => computeActiveStatsByShape(shape, { walls, activeWall, placedItems }),
    [shape, placedItems, walls, activeWall]
  )

  const itemsPrice = useMemo(
    () => placedItems.reduce((acc, item) => acc + (Number(item.price) || 0), 0),
    [placedItems]
  )
  const grandTotal = itemsPrice
  const dimensionText = useMemo(
    () => `Donji: ${Math.round(activeStats.freeBase / 10)} cm\nGornji: ${Math.round(activeStats.freeWall / 10)} cm`,
    [activeStats]
  )

  const handleAddItem = async (catalogItem: CatalogElement) => {
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

      const preparedItem = { ...validated.item, decor: validated.item.decor ?? DEFAULT_DECOR, glbUrl: catalogItem.glb || validated.item.glbUrl }
      const preloadTarget = computeRenderItemsByShape(shape, [...placedItemsRef.current, preparedItem], optionsValues)
      const { preloadSceneAssetsForItems } = await import('../engine3d/modelLoader')
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
  }

  const handleBack = () => {
    if (sceneLoading || itemLoading) return
    if (canUndo) {
      undo()
      setSelectedItemId(null)
      return
    }
    setShowBackConfirm(true)
  }

  const handleForward = () => {
    if (sceneLoading || itemLoading) return
    if (!canRedo) return
    redo()
    setSelectedItemId(null)
  }

  const handleDeleteSelected = () => {
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
  }

  const handleGlobalReset = () => {
    if (sceneLoading || itemLoading) return
    resetLayout()
    setSelectedItemId(null)
    onResetAll()
    setShowResetConfirm(false)
  }

  const handleOrder = () => {
    if (sceneLoading || itemLoading) return
    setAlertMsg(ORDER_PLACEHOLDER_MESSAGE)
  }

  const handleRequestRemoveWorktop = (apply: () => void) => {
    if (sceneLoading || itemLoading) return
    pendingWorktopRemovalRef.current = apply
    setShowWorktopRemoveConfirm(true)
  }

  const handleConfirmRemoveWorktop = () => {
    if (sceneLoading || itemLoading) return
    const apply = pendingWorktopRemovalRef.current
    pendingWorktopRemovalRef.current = null
    setShowWorktopRemoveConfirm(false)
    if (apply) apply()
  }

  const handleCancelRemoveWorktop = () => {
    if (sceneLoading || itemLoading) return
    const selectedItem = selectedItemId ? placedItems.find((item) => item.uniqueId === selectedItemId) : null
    pendingWorktopRemovalRef.current = null
    setShowWorktopRemoveConfirm(false)

    if (selectedItemId && selectedItem && optionsValues.worktop !== 'Bez Radne ploče' && supportsWorktop(selectedItem)) {
      const withoutSelected = removePlacedItem(placedItems, selectedItemId)
      pushState([...withoutSelected, makeSupportPlaceholder(selectedItem)])
      setSelectedItemId(null)
    }
  }


  useEffect(() => {
    const sequence = ++sceneLoadSequenceRef.current
    const startedAt = Date.now()
    setSceneLoading(true)

    let cancelled = false
    ;(async () => {
      try {
        const { preloadSceneAssetsForItems } = await import('../engine3d/modelLoader')
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
  }, [shape, walls, contextKey])

  useEffect(() => {
    if (!sceneLoading && !itemLoading) return
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }, [sceneLoading, itemLoading])

  useLayoutEffect(() => {
    writeStep3Snapshot({
      version: 1 as const,
      shape,
      walls,
      items: placedItems,
      optionsValues,
      decorByGroup,
      ui: {
        drawer,
        optionTab,
        activeElementsSubcat,
        activeDecorGroup,
        targetWall,
        selectedItemId: selectedItemId && placedItems.some((item) => item.uniqueId === selectedItemId) ? selectedItemId : null,
        elementsScrollTop,
        optionsScrollTop,
      },
    })
  }, [
    activeDecorGroup,
    activeElementsSubcat,
    decorByGroup,
    drawer,
    optionTab,
    optionsValues,
    placedItems,
    selectedItemId,
    shape,
    targetWall,
    walls,
    elementsScrollTop,
    optionsScrollTop,
  ])

  useEffect(() => {
    const flush = () => writeStep3Snapshot({
      version: 1 as const,
      shape,
      walls,
      items: placedItems,
      optionsValues,
      decorByGroup,
      ui: {
        drawer,
        optionTab,
        activeElementsSubcat,
        activeDecorGroup,
        targetWall,
        selectedItemId: selectedItemId && placedItems.some((item) => item.uniqueId === selectedItemId) ? selectedItemId : null,
        elementsScrollTop,
        optionsScrollTop,
      },
    })

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
  }, [
    activeDecorGroup,
    activeElementsSubcat,
    decorByGroup,
    drawer,
    optionTab,
    optionsValues,
    placedItems,
    selectedItemId,
    shape,
    targetWall,
    walls,
    elementsScrollTop,
    optionsScrollTop,
  ])

  useEffect(() => {
    markPerf('step3EnteredAt')
  }, [])

  const isUiLocked = sceneLoading || itemLoading
  const loadingMessage = itemLoading ? ITEM_LOADING_MESSAGE : sceneLoading ? STEP3_SCENE_LOADING_MESSAGE : null
  const isForwardDisabled = isUiLocked || !canRedo
  const isDeleteDisabled = isUiLocked || !selectedItemId

  return (
    <div className="fullscreen" style={{ position: 'relative' }}>
      <Suspense fallback={null}>
        <Canvas3DLazy
          shape={shape}
          walls={walls}
          items={renderItems}
          optionsValues={optionsValues}
          selected={selectedItemId}
          onSelect={(id) => { if (!isUiLocked && !isPreviewOnlyLandscape) setSelectedItemId(id) }}
          activeElementsSubcat={activeElementsSubcat}
        />
      </Suspense>

      {alertMsg && <InfoDialog msg={alertMsg} onClose={() => setAlertMsg(null)} />}

      {showBackConfirm && (
        <ConfirmDialog
          msg="Da li ste sigurni da želite da se vratite na unos dimenzija?"
          onConfirm={onBack}
          onCancel={() => setShowBackConfirm(false)}
        />
      )}

      {showResetConfirm && (
        <ConfirmDialog
          msg="Da li ste sigurni da želite resetovati sve? Ovo će obrisati sve elemente i istoriju."
          onConfirm={handleGlobalReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {showWorktopRemoveConfirm && (
        <ConfirmDialog
          msg="Da li želite da obrišete i radnu ploču?"
          onConfirm={handleConfirmRemoveWorktop}
          onCancel={handleCancelRemoveWorktop}
          confirmLabel="DA"
          cancelLabel="NE"
        />
      )}

      <Step3Header isDesktop={isDesktop} activeWall={activeWall} dimensionText={dimensionText} previewOnly={isPreviewOnlyLandscape} />

      {isPreviewOnlyLandscape ? null : isDesktop ? (
        <Step3DesktopChrome
          drawer={drawer}
          setDrawer={isUiLocked ? (() => undefined) as typeof setDrawer : setDrawer}
          shape={shape}
          placedItems={placedItems}
          targetWall={targetWall}
          availableWalls={availableWalls}
          onTargetWallChange={(wall) => { if (!isUiLocked) setTargetWall(wall) }}
          onAddItem={handleAddItem}
          activeElementsSubcat={activeElementsSubcat}
          setActiveElementsSubcat={(value) => { if (!isUiLocked) setActiveElementsSubcat(value) }}
          elementsScrollTop={elementsScrollTop}
          setElementsScrollTop={(value) => { if (!isUiLocked) setElementsScrollTop(value) }}
          optionTab={optionTab}
          setOptionTab={isUiLocked ? (() => undefined) as typeof setOptionTab : setOptionTab}
          optionsValues={optionsValues}
          setOptionsValues={isUiLocked ? (() => undefined) as typeof setOptionsValuesWithDecorSync : setOptionsValuesWithDecorSync}
          optionsScrollTop={optionsScrollTop}
          setOptionsScrollTop={(value) => { if (!isUiLocked) setOptionsScrollTop(value) }}
          activeDecorGroup={activeDecorGroup}
          setActiveDecorGroup={(value) => { if (!isUiLocked) setActiveDecorGroup(value) }}
          onRequestRemoveWorktop={handleRequestRemoveWorktop}
          onBack={handleBack}
          onForward={handleForward}
          onDeleteSelected={handleDeleteSelected}
          onReset={() => { if (!isUiLocked) setShowResetConfirm(true) }}
          onOrder={handleOrder}
          isForwardDisabled={isForwardDisabled}
          isDeleteDisabled={isDeleteDisabled}
          grandTotal={grandTotal}
        />
      ) : (
        <Step3MobileChrome
          drawer={drawer}
          setDrawer={isUiLocked ? (() => undefined) as typeof setDrawer : setDrawer}
          closeDrawer={() => { if (!isUiLocked) closeDrawer() }}
          shape={shape}
          placedItems={placedItems}
          targetWall={targetWall}
          availableWalls={availableWalls}
          onTargetWallChange={(wall) => { if (!isUiLocked) setTargetWall(wall) }}
          onAddItem={handleAddItem}
          activeElementsSubcat={activeElementsSubcat}
          setActiveElementsSubcat={(value) => { if (!isUiLocked) setActiveElementsSubcat(value) }}
          elementsScrollTop={elementsScrollTop}
          setElementsScrollTop={(value) => { if (!isUiLocked) setElementsScrollTop(value) }}
          optionTab={optionTab}
          setOptionTab={isUiLocked ? (() => undefined) as typeof setOptionTab : setOptionTab}
          optionsValues={optionsValues}
          setOptionsValues={isUiLocked ? (() => undefined) as typeof setOptionsValuesWithDecorSync : setOptionsValuesWithDecorSync}
          optionsScrollTop={optionsScrollTop}
          setOptionsScrollTop={(value) => { if (!isUiLocked) setOptionsScrollTop(value) }}
          activeDecorGroup={activeDecorGroup}
          setActiveDecorGroup={(value) => { if (!isUiLocked) setActiveDecorGroup(value) }}
          onRequestRemoveWorktop={handleRequestRemoveWorktop}
          onBack={handleBack}
          onForward={handleForward}
          onDeleteSelected={handleDeleteSelected}
          onReset={() => { if (!isUiLocked) setShowResetConfirm(true) }}
          onOrder={handleOrder}
          isForwardDisabled={isForwardDisabled}
          isDeleteDisabled={isDeleteDisabled}
          grandTotal={grandTotal}
        />
      )}
      {loadingMessage ? (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            background: 'rgba(8, 12, 18, 0.42)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div className="glass" style={{ padding: '16px 20px', borderRadius: 18, fontWeight: 800 }}>
            {loadingMessage}
          </div>
        </div>
      ) : null}
    </div>
  )
}
