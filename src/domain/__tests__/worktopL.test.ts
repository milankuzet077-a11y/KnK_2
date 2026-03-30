import { describe, expect, it } from 'vitest'
import { computeWorktopItemsL } from '../shapes/L/worktop'
import type { PlacedItem } from '../types'

describe('L-shape worktop metadata', () => {
  it('uses fixed other-wall worktop start for left-corner layouts', () => {
    const items: PlacedItem[] = [
      { uniqueId: 'corner', catalogId: 'corner', elementId: 'u1', width: 1100, depth: 650, x: 0, wallKey: 'A', category: 'base', cornerHandedness: 'left' as const },
      // wall A stores right edge after placement: left edge is x - width = 1150
      { uniqueId: 'a1', catalogId: 'base', elementId: 'r1', width: 600, depth: 600, x: 1750, wallKey: 'A' as const },
      // wall B stores left edge after placement
      { uniqueId: 'b1', catalogId: 'base', elementId: 'r2', width: 800, depth: 600, x: 700, wallKey: 'B' as const },
    ]

    const result = computeWorktopItemsL(items)
    expect(result).toHaveLength(2)
    const segA = result.find((item) => item.wallKey === 'A')
    const segB = result.find((item) => item.wallKey === 'B')
    expect(segA?.x).toBe(0)
    expect(segA?.width).toBe(1750)
    expect(segB?.x).toBe(600)
    expect(segB?.width).toBe(900)
  })

  it('uses fixed other-wall worktop start for mirrored right-corner layouts', () => {
    const items: PlacedItem[] = [
      { uniqueId: 'corner', catalogId: 'corner', elementId: 'u2', width: 1100, depth: 650, x: 0, wallKey: 'B', category: 'base', cornerHandedness: 'right' as const },
      // wall A stores right edge after placement
      { uniqueId: 'a1', catalogId: 'base', elementId: 'r1', width: 900, depth: 600, x: 1600, wallKey: 'A' as const },
      // wall B stores left edge after placement
      { uniqueId: 'b1', catalogId: 'base', elementId: 'r2', width: 700, depth: 600, x: 1150, wallKey: 'B' as const },
    ]

    const result = computeWorktopItemsL(items)
    expect(result).toHaveLength(2)
    const segA = result.find((item) => item.wallKey === 'A')
    const segB = result.find((item) => item.wallKey === 'B')
    expect(segA?.x).toBe(600)
    expect(segA?.width).toBe(1000)
    expect(segB?.x).toBe(0)
    expect(segB?.width).toBe(1850)
  })
})
