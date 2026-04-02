import React from 'react'
import type { KitchenShape, PlacedItem, WallKey } from '../../domain/types'
import type { CatalogElement } from '../../domain/catalog/catalogTypes'
import { I, Icon } from '../icons'
import { OptionsPanel } from '../options/OptionsPanel'
import type { OptionTab } from '../options/types'
import { ElementsPanel } from './ElementsPanel'
import type { Drawer, Subcat } from './types'

const priceFormatter = new Intl.NumberFormat('sr-RS')

export function Step3MobileChrome({
  drawer,
  setDrawer,
  closeDrawer,
  shape,
  placedItems,
  targetWall,
  availableWalls,
  onTargetWallChange,
  onAddItem,
  activeElementsSubcat,
  setActiveElementsSubcat,
  elementsScrollTop,
  setElementsScrollTop,
  optionTab,
  setOptionTab,
  optionsValues,
  setOptionsValues,
  optionsScrollTop,
  setOptionsScrollTop,
  activeDecorGroup,
  setActiveDecorGroup,
  onRequestRemoveWorktop,
  onBack,
  onForward,
  onDeleteSelected,
  onReset,
  onOrder,
  isForwardDisabled,
  isDeleteDisabled,
  grandTotal,
}: {
  drawer: Drawer
  setDrawer: React.Dispatch<React.SetStateAction<Drawer>>
  closeDrawer: () => void
  shape: KitchenShape
  placedItems: PlacedItem[]
  targetWall: WallKey
  availableWalls: WallKey[]
  onTargetWallChange: (w: WallKey) => void
  onAddItem: (item: CatalogElement) => void
  activeElementsSubcat: Subcat
  setActiveElementsSubcat: (s: Subcat) => void
  elementsScrollTop: number
  setElementsScrollTop: (value: number) => void
  optionTab: OptionTab
  setOptionTab: React.Dispatch<React.SetStateAction<OptionTab>>
  optionsValues: React.ComponentProps<typeof OptionsPanel>['values']
  setOptionsValues: React.ComponentProps<typeof OptionsPanel>['setValues']
  optionsScrollTop: number
  setOptionsScrollTop: (value: number) => void
  activeDecorGroup: React.ComponentProps<typeof OptionsPanel>['activeDecorGroup']
  setActiveDecorGroup: React.ComponentProps<typeof OptionsPanel>['setActiveDecorGroup']
  onRequestRemoveWorktop: React.ComponentProps<typeof OptionsPanel>['onRequestRemoveWorktop']
  onBack: () => void
  onForward: () => void
  onDeleteSelected: () => void
  onReset: () => void
  onOrder: () => void
  isForwardDisabled: boolean
  isDeleteDisabled: boolean
  grandTotal: number
}) {
  const DOCK_BOTTOM = 10
  const DOCK_H = 72
  const GAP = 10
  const MINI_H = 56
  const miniBottom = DOCK_BOTTOM + DOCK_H + GAP
  const priceBottom = miniBottom + MINI_H + GAP

  return (
    <>
      <div className="safe" style={{ position: 'absolute', left: 0, right: 0, bottom: priceBottom }}>
        <div className="pill glass" style={{ width: 'fit-content', marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <span className="hint">Cena</span>
          <span style={{ fontWeight: 900 }}>{priceFormatter.format(grandTotal)} RSD</span>
        </div>
      </div>
      <div className="safe" style={{ position: 'absolute', left: 0, right: 0, bottom: miniBottom }}>
        <div className="glass" style={{ width: 'fit-content', borderRadius: 20, padding: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={onBack} aria-label="Undo"><Icon>{I.undo}</Icon></button>
          <button className="btn primary" onClick={onForward} disabled={isForwardDisabled} aria-label="Redo"><Icon>{I.redo}</Icon></button>
        </div>
      </div>
      <div className="dock glass">
        <button className={"dockBtn" + (drawer === 'elements' ? ' active' : '')} onClick={() => setDrawer((d) => d === 'elements' ? 'none' : 'elements')}>
          <strong><Icon>{I.cube}</Icon></strong>
          <span>Elementi</span>
        </button>
        <button className={"dockBtn" + (drawer === 'options' ? ' active' : '')} onClick={() => {
          setDrawer((d) => d === 'options' ? 'none' : 'options')
        }}>
          <strong><Icon>{I.sliders}</Icon></strong>
          <span>Opcije</span>
        </button>
        <button className="dockBtn danger" onClick={onDeleteSelected} disabled={isDeleteDisabled} style={{ opacity: isDeleteDisabled ? 0.3 : 1, gridTemplateRows: "1fr" }} aria-label="Obriši" title="Obriši">
          <strong><Icon>{I.trash}</Icon></strong>
          <span>Obriši</span>
        </button>
        <button className="dockBtn danger" onClick={onReset}>
          <strong><Icon>{I.reset}</Icon></strong>
          <span>Reset</span>
        </button>
        <button className="dockBtn active" onClick={onOrder}>
          <strong><Icon>{I.cart}</Icon></strong>
          <span>Poruči</span>
        </button>
      </div>
      {drawer !== 'none' && <div className="drawerBackdrop" onClick={closeDrawer} />}
      {drawer !== 'none' && (
        <div
          className={"drawer glass fadeIn" + (drawer === 'elements' || drawer === 'options' ? ' drawer--fullscreen' : '')}
          style={drawer === 'elements' || drawer === 'options'
            ? { pointerEvents: 'auto', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 0 }
            : { pointerEvents: 'auto' }}
        >
          <div className="drawerHeader">
            <div style={{ fontWeight: 900 }}>{drawer === 'elements' ? 'Elementi' : 'Opcije'}</div>
            <button className="btn danger" onClick={closeDrawer} style={{ minHeight: 40 }}><Icon>{I.close}</Icon> Zatvori</button>
          </div>
          <div className="drawerBody">
            {drawer === 'elements' ? (
              <ElementsPanel
                shape={shape}
                placedItems={placedItems}
                targetWall={targetWall}
                availableWalls={availableWalls}
                onTargetWallChange={onTargetWallChange}
                onAddItem={onAddItem}
                subcat={activeElementsSubcat}
                onSubcatChange={setActiveElementsSubcat}
                onCloseDrawer={closeDrawer}
                scrollTop={elementsScrollTop}
                onScrollTopChange={setElementsScrollTop}
              />
            ) : (
              <OptionsPanel
                optionTab={optionTab}
                setOptionTab={setOptionTab}
                values={optionsValues}
                setValues={setOptionsValues}
                scrollTop={optionsScrollTop}
                onScrollTopChange={setOptionsScrollTop}
                activeDecorGroup={activeDecorGroup}
                setActiveDecorGroup={setActiveDecorGroup}
                onRequestRemoveWorktop={onRequestRemoveWorktop}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}
