import type { KitchenShape, PlacedItem, WallKey, Walls } from '../../domain/types'
import { canonicalizeWalls, normalizeWalls, parsePlacedItem, parseShape } from '../../domain/stateParsers'
import { DEFAULT_OPTIONS } from '../options/config'
import type { OptionTab, OptionTabId, OptionsValues } from '../options/types'
import type { Drawer, Subcat } from './types'
import { wallsSignature } from './storage'

const STEP3_SNAPSHOT_PREFIX = 'amk_step3_snapshot'
const DEFAULT_DECOR = 'Bela'

type DecorGroup = Extract<Subcat, 'Donji' | 'Gornji' | 'Visoki'>
type DecorByGroup = Record<DecorGroup, string>

export type Step3Snapshot = {
  version: 1
  shape: KitchenShape
  walls: Walls
  items: PlacedItem[]
  optionsValues: OptionsValues
  decorByGroup: DecorByGroup
  ui: {
    drawer: Drawer
    optionTab: OptionTab
    activeElementsSubcat: Subcat
    activeDecorGroup: DecorGroup
    targetWall: WallKey
    selectedItemId: string | null
    elementsScrollTop: number
    optionsScrollTop: number
  }
}

const VALID_DRAWERS: Drawer[] = ['none', 'elements', 'options']
const VALID_SUBCATS: Subcat[] = ['Donji', 'Gornji', 'Visoki', 'Ugao']
const VALID_OPTION_TABS = ['worktop', 'decor', 'handles', 'sink'] as const
const VALID_WALL_KEYS: WallKey[] = ['A', 'B', 'C']
const VALID_DECOR_GROUPS: DecorGroup[] = ['Donji', 'Gornji', 'Visoki']

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function normalizeOptionValue(tab: OptionTabId, value: unknown): string {
  const fallback = DEFAULT_OPTIONS[tab]
  return typeof value === 'string' && value.trim() ? value : fallback
}

function parseOptionsValues(value: unknown): OptionsValues {
  const record = isRecord(value) ? value : {}
  return {
    worktop: normalizeOptionValue('worktop', record.worktop),
    decor: normalizeOptionValue('decor', record.decor),
    handles: normalizeOptionValue('handles', record.handles),
    sink: normalizeOptionValue('sink', record.sink),
  }
}

function parseDecorByGroup(value: unknown): DecorByGroup {
  const record = isRecord(value) ? value : {}
  return {
    Donji: typeof record.Donji === 'string' && record.Donji.trim() ? record.Donji : DEFAULT_DECOR,
    Gornji: typeof record.Gornji === 'string' && record.Gornji.trim() ? record.Gornji : DEFAULT_DECOR,
    Visoki: typeof record.Visoki === 'string' && record.Visoki.trim() ? record.Visoki : DEFAULT_DECOR,
  }
}

function parseDrawer(value: unknown): Drawer {
  return VALID_DRAWERS.includes(value as Drawer) ? (value as Drawer) : 'none'
}

function parseSubcat(value: unknown, fallback: Subcat = 'Donji'): Subcat {
  return VALID_SUBCATS.includes(value as Subcat) ? (value as Subcat) : fallback
}

function parseOptionTab(value: unknown): OptionTab {
  return VALID_OPTION_TABS.includes(value as (typeof VALID_OPTION_TABS)[number])
    ? (value as (typeof VALID_OPTION_TABS)[number])
    : null
}

function parseWallKey(value: unknown): WallKey {
  return VALID_WALL_KEYS.includes(value as WallKey) ? (value as WallKey) : 'A'
}

function parseDecorGroup(value: unknown): DecorGroup {
  return VALID_DECOR_GROUPS.includes(value as DecorGroup) ? (value as DecorGroup) : 'Donji'
}

function parseScrollTop(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function parseItems(value: unknown): PlacedItem[] {
  if (!Array.isArray(value)) return []
  const result: PlacedItem[] = []
  for (const item of value) {
    const parsed = parsePlacedItem(item)
    if (parsed) result.push(parsed)
  }
  return result
}

export function makeStep3SnapshotKey(shape: KitchenShape, walls: Walls): string {
  const canonicalWalls = canonicalizeWalls(shape, walls) ?? walls
  return `${STEP3_SNAPSHOT_PREFIX}::${shape}|${wallsSignature(canonicalWalls)}`
}

function findCompatibleStep3SnapshotKey(shape: KitchenShape, walls: Walls): string | null {
  const wanted = wallsSignature(canonicalizeWalls(shape, walls) ?? walls)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key !== STEP3_SNAPSHOT_PREFIX && !key.startsWith(`${STEP3_SNAPSHOT_PREFIX}::`)) continue

      const raw = localStorage.getItem(key)
      if (!raw) continue

      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed)) continue

      const snapshotShape = parseShape(parsed.shape)
      const snapshotWalls = snapshotShape ? canonicalizeWalls(snapshotShape, parsed.walls) : null
      if (!snapshotShape || !snapshotWalls) continue
      if (snapshotShape !== shape) continue
      if (wallsSignature(snapshotWalls) !== wanted) continue

      return key
    }
  } catch {}
  return null
}

export function readStep3Snapshot(shape: KitchenShape, walls: Walls): Step3Snapshot | null {
  try {
    const primaryKey = makeStep3SnapshotKey(shape, walls)
    const matchedKey = localStorage.getItem(primaryKey) ? primaryKey : findCompatibleStep3SnapshotKey(shape, walls)
    const raw = matchedKey ? localStorage.getItem(matchedKey) : null
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    const snapshotShape = parseShape(parsed.shape)
    const snapshotWalls = snapshotShape ? canonicalizeWalls(snapshotShape, parsed.walls) : null
    if (!snapshotShape || !snapshotWalls) return null
    if (snapshotShape !== shape) return null
    if (wallsSignature(snapshotWalls) !== wallsSignature(walls)) return null

    const optionsValues = parseOptionsValues(parsed.optionsValues)
    const decorByGroup = parseDecorByGroup(parsed.decorByGroup)
    const uiRecord = isRecord(parsed.ui) ? parsed.ui : {}

    const snapshot: Step3Snapshot = {
      version: 1,
      shape: snapshotShape,
      walls: snapshotWalls,
      items: parseItems(parsed.items),
      optionsValues,
      decorByGroup,
      ui: {
        drawer: parseDrawer(uiRecord.drawer),
        optionTab: parseOptionTab(uiRecord.optionTab),
        activeElementsSubcat: parseSubcat(uiRecord.activeElementsSubcat, shape === 'l-shape' ? 'Ugao' : 'Donji'),
        activeDecorGroup: parseDecorGroup(uiRecord.activeDecorGroup),
        targetWall: parseWallKey(uiRecord.targetWall),
        selectedItemId: typeof uiRecord.selectedItemId === 'string' ? uiRecord.selectedItemId : null,
        elementsScrollTop: parseScrollTop(uiRecord.elementsScrollTop),
        optionsScrollTop: parseScrollTop(uiRecord.optionsScrollTop),
      },
    }

    const hasSelected = snapshot.ui.selectedItemId
      ? snapshot.items.some((item) => item.uniqueId === snapshot.ui.selectedItemId)
      : false
    if (!hasSelected) snapshot.ui.selectedItemId = null

    const activeDecor = snapshot.decorByGroup[snapshot.ui.activeDecorGroup]
    if (snapshot.optionsValues.decor !== activeDecor) {
      snapshot.optionsValues = { ...snapshot.optionsValues, decor: activeDecor }
    }

    return snapshot
  } catch {
    return null
  }
}

export function writeStep3Snapshot(snapshot: Step3Snapshot) {
  try {
    const canonicalWalls = canonicalizeWalls(snapshot.shape, snapshot.walls) ?? snapshot.walls
    localStorage.setItem(makeStep3SnapshotKey(snapshot.shape, canonicalWalls), JSON.stringify({ ...snapshot, walls: canonicalWalls }))
  } catch {}
}

export function clearStep3Snapshot(shape: KitchenShape, walls: Walls) {
  try {
    localStorage.removeItem(makeStep3SnapshotKey(shape, walls))
  } catch {}
}

export function clearAllStep3Snapshots() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key === STEP3_SNAPSHOT_PREFIX || key.startsWith(`${STEP3_SNAPSHOT_PREFIX}::`)) {
        localStorage.removeItem(key)
      }
    }
  } catch {}
}
