import type { PlacedItem, Walls } from '../../types'
import { computeActiveStatsShared } from '../shared/activeStats'

export function computeActiveStatsParallel(params: { walls: Walls; activeWall: 'A'|'B'|'C'; placedItems: PlacedItem[] }) {
  return computeActiveStatsShared(params)
}
