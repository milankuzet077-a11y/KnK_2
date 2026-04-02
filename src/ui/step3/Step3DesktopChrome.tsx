import React from 'react'
import type { KitchenShape, PlacedItem, WallKey } from '../../domain/types'
import { I, Icon } from '../icons'
import { OptionsPanel } from '../options/OptionsPanel'
import type { OptionTab } from '../options/types'
import type { CatalogElement } from '../../domain/catalog/catalogTypes'
import { SidePanel } from './SidePanel'
import { ElementsPanel } from './ElementsPanel'
import type { Drawer, Subcat } from './types'

const priceFormatter = new Intl.NumberFormat('sr-RS')

export function Step3DesktopChrome({
  drawer,
  setDrawer,
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
  return (
    <>
      <SidePanel
        side="left"
        title="Elementi"
        icon={<Icon>{I.cube}</Icon>}
        open={drawer === 'elements'}
        onToggle={() => setDrawer((d) => d === 'elements' ? 'none' : 'elements')}
      >
        <ElementsPanel
          shape={shape}
          placedItems={placedItems}
          targetWall={targetWall}
          availableWalls={availableWalls}
          onTargetWallChange={onTargetWallChange}
          onAddItem={onAddItem}
          subcat={activeElementsSubcat}
          onSubcatChange={setActiveElementsSubcat}
          scrollTop={elementsScrollTop}
          onScrollTopChange={setElementsScrollTop}
        />
      </SidePanel>
      <SidePanel
        side="right"
        title="Opcije"
        icon={<Icon>{I.sliders}</Icon>}
        open={drawer === 'options'}
        onToggle={() => {
          setDrawer((d) => d === 'options' ? 'none' : 'options')
        }}
      >
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
      </SidePanel>
      <div className="safe" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end' }}>
          <div className="glass" style={{ borderRadius: 24, padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn" onClick={onBack} aria-label="Undo" title="Undo"><Icon>{I.undo}</Icon></button>
            <button className="btn primary" onClick={onForward} disabled={isForwardDisabled} aria-label="Redo" title="Redo"><Icon>{I.redo}</Icon></button>
            <button className="btn danger" onClick={onDeleteSelected} disabled={isDeleteDisabled} aria-label="Obriši" title="Obriši"><Icon>{I.trash}</Icon>Obriši</button>
            <button className="btn danger" onClick={onReset}><Icon>{I.reset}</Icon> Reset</button>
          </div>
          <div className="glass" style={{ borderRadius: 24, padding: 12, display: 'grid', gap: 8, justifyItems: 'end' }}>
            <div className="hint" style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}>Ukupna cena</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{priceFormatter.format(grandTotal)} RSD</div>
            <button className="btn primary" onClick={onOrder} style={{ width: 180 }}>Poruči</button>
          </div>
        </div>
      </div>
    </>
  )
}
