import { describe, expect, it } from 'vitest'
import {
  readCornerCategory,
  readCornerHandedness,
  readPlacedCornerCategory,
  readPlacedCornerHandedness,
} from '../rules/corner'
import { computeActiveStatsShared } from '../shapes/shared/activeStats'

describe('corner rules', () => {
  it('reads corner metadata from catalog values only', () => {
    expect(readCornerHandedness({ cornerHandedness: 'left' } as const)).toBe('left')
    expect(readCornerHandedness({ cornerHandedness: 'desni' as unknown as 'right' } as const)).toBe('right')
    expect(readCornerHandedness({ cornerHandedness: undefined } as const)).toBeNull()

    expect(readCornerCategory({ category: 'base' } as const)).toBe('base')
    expect(readCornerCategory({ category: 'Gornji ugaoni' } as const)).toBe('wall')
    expect(readCornerCategory({ category: undefined } as const)).toBeNull()
  })

  it('does not fall back to legacy u1/u2/u3/u4 ids for placed items', () => {
    expect(readPlacedCornerHandedness({ cornerHandedness: undefined })).toBeNull()
    expect(readPlacedCornerCategory({ category: undefined })).toBeNull()
  })

  it('counts corner occupancy only when catalog-derived metadata exists', () => {
    const baseStats = computeActiveStatsShared({
      walls: { A: 3000, B: 2500 },
      activeWall: 'A',
      placedItems: [
        {
          uniqueId: 'corner-1',
          catalogId: 'corner',
          elementId: 'u1',
          width: 1000,
          depth: 600,
          x: 0,
          category: 'base',
          cornerHandedness: 'left',
          wallKey: 'A',
        },
      ],
    })

    expect(baseStats.freeBase).toBe(2000)
    expect(baseStats.freeWall).toBe(3000)

    const missingMetaStats = computeActiveStatsShared({
      walls: { A: 3000, B: 2500 },
      activeWall: 'A',
      placedItems: [
        {
          uniqueId: 'corner-legacy',
          catalogId: 'corner',
          elementId: 'u1',
          width: 1000,
          depth: 600,
          x: 0,
          wallKey: 'A',
        },
      ],
    })

    expect(missingMetaStats.freeBase).toBe(3000)
    expect(missingMetaStats.freeWall).toBe(3000)
  })
})
