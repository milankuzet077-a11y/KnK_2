import type { KitchenShape, PlacedItem, WallKey, Walls } from '../domain/types'
import { getActiveWall } from '../domain/shapes/shared/uiShapeConfig'
import { computeRenderItemsByShape, computeActiveStatsByShape } from '../domain/shapes/shared/step3Derivations'
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLayoutHistory } from './step3/useLayoutHistory'
import { useMediaQuery } from './useMediaQuery'
import type { OptionTab, OptionsValues } from './options/types'
import type { Drawer, Subcat } from './step3/types'
import { InfoDialog, ConfirmDialog } from './step3/dialogs'
import { Step3Header } from './step3/Step3Header'
import { markPerf } from '../engine3d/metrics/perf'
import { Step3DesktopChrome } from './step3/Step3DesktopChrome'
import { Step3MobileChrome } from './step3/Step3MobileChrome'
import {
  ITEM_LOADING_MESSAGE,
  STEP3_SCENE_LOADING_MESSAGE,
  applyDecorToGroup,
  buildInitialStep3View,
  type DecorByGroup,
  type DecorGroup,
} from './step3/configuratorShared'
import { useStep3Actions } from './step3/useStep3Actions'
import { useStep3SceneLoading } from './step3/useStep3SceneLoading'
import { useStep3SnapshotPersistence } from './step3/useStep3SnapshotPersistence'

const Canvas3DLazy = lazy(() => import('../engine3d/Canvas3DLazy').then((m) => ({ default: m.Canvas3DLazy })))

export function Step3Configurator({
  shape,
  walls,
  onBack,
  onResetAll,
}: {
  shape: KitchenShape
  walls: Walls
  onBack: () => void
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

  const sceneLoading = useStep3SceneLoading({
    shape,
    walls,
    contextKey: `${contextKey}|${sceneAssetKey}`,
    renderItems,
  })

  const {
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
  } = useStep3Actions({
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
  })


  useEffect(() => {
    if (!isPreviewOnlyLandscape) return
    resetTransientUi()
  }, [isPreviewOnlyLandscape, resetTransientUi])

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
      const decor = next.decor || 'Bela'
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

  useEffect(() => {
    if (!sceneLoading && !itemLoading) return
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }, [itemLoading, sceneLoading])

  useStep3SnapshotPersistence({
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
