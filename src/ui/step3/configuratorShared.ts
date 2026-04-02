import type { KitchenShape, PlacedItem, WallKey, Walls } from '../../domain/types'
import { getCornerWorktopMetaByElementId } from '../../domain/catalog/cornerWorktop'
import { DEFAULT_OPTIONS } from '../options/config'
import type { OptionTab, OptionsValues } from '../options/types'
import { readStep3Snapshot, type Step3Snapshot } from './snapshot'
import type { Drawer, Subcat } from './types'

export const ORDER_PLACEHOLDER_MESSAGE = 'Slanje porudžbine još nije aktivirano u ovoj verziji aplikacije.'
export const DEFAULT_DECOR = 'Bela'
export const STEP3_SCENE_LOADING_MESSAGE = 'Učitavanje 3D scene, molimo sačekajte'
export const ITEM_LOADING_MESSAGE = 'Učitavanje, molimo sačekajte'
export const ITEM_ADD_ERROR_MESSAGE = 'Trenutno nije moguće dodati element. Pokušajte ponovo.'
export const MIN_SCENE_LOADING_MS = 1000
export const MIN_ITEM_LOADING_MS = 500

export type DecorGroup = Extract<Subcat, 'Donji' | 'Gornji' | 'Visoki'>
export type DecorByGroup = Record<DecorGroup, string>

export type Step3ViewState = {
  drawer: Drawer
  optionTab: OptionTab
  optionsValues: OptionsValues
  decorByGroup: DecorByGroup
  activeElementsSubcat: Subcat
  activeDecorGroup: DecorGroup
  targetWall: WallKey
  selectedItemId: string | null
  elementsScrollTop: number
  optionsScrollTop: number
}

export function isDecorGroup(value: Subcat): value is DecorGroup {
  return value === 'Donji' || value === 'Gornji' || value === 'Visoki'
}

export function getDecorGroupForItem(item: PlacedItem): DecorGroup | null {
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

export function applyDecorToGroup(items: PlacedItem[], group: DecorGroup, decor: string): { items: PlacedItem[]; changed: boolean } {
  let changed = false
  const nextItems = items.map((item) => {
    if (getDecorGroupForItem(item) !== group) return item
    if ((item.decor ?? DEFAULT_DECOR) === decor) return item
    changed = true
    return { ...item, decor }
  })
  return { items: nextItems, changed }
}

export function supportsWorktop(item: PlacedItem): boolean {
  const supportRole = item.supportRole
  if (supportRole === 'base') return true
  if (supportRole === 'wall') return false

  const catalogId = String(item.catalogId || '').toLowerCase()
  if (catalogId === 'base') return true
  if (catalogId !== 'corner') return false
  return String(item.category || '').toLowerCase() === 'base'
}

export function makeSupportPlaceholder(item: PlacedItem): PlacedItem {
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

export function buildInitialStep3View(shape: KitchenShape, walls: Walls): Step3ViewState {
  const snapshot = readStep3Snapshot(shape, walls)
  if (!snapshot) {
    return {
      drawer: 'none',
      optionTab: null,
      optionsValues: DEFAULT_OPTIONS,
      decorByGroup: { Donji: DEFAULT_DECOR, Gornji: DEFAULT_DECOR, Visoki: DEFAULT_DECOR },
      activeElementsSubcat: (shape === 'l-shape' ? 'Ugao' : 'Donji') as Subcat,
      activeDecorGroup: 'Donji',
      targetWall: 'A',
      selectedItemId: null,
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

export function createStep3SnapshotPayload(params: {
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
}): Step3Snapshot {
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

  return {
    version: 1,
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
  }
}
