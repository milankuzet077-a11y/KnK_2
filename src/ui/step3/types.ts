import type { KitchenShape, PlacedItem, WallKey } from '../../domain/types'
import type { CatalogElement } from '../../domain/catalog/catalogTypes'

export type Drawer = 'none' | 'elements' | 'options'
export type Subcat = 'Donji' | 'Gornji' | 'Visoki' | 'Ugao'

export type Step3ActionHandlers = {
  onBack: () => void
  onForward: () => void
  onDeleteSelected: () => void
  onReset: () => void
  onOrder: () => void
}

export type ElementsPanelProps = {
  shape: KitchenShape
  placedItems: PlacedItem[]
  targetWall: WallKey
  availableWalls: WallKey[]
  onTargetWallChange?: (w: WallKey) => void
  onAddItem?: (item: CatalogElement) => void
  subcat: Subcat
  onSubcatChange: (s: Subcat) => void
  onCloseDrawer?: () => void
  scrollTop?: number
  onScrollTopChange?: (value: number) => void
}
