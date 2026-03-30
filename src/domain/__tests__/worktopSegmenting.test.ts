import { describe, expect, it } from 'vitest'
import { computeWorktopItemsI } from '../shapes/I/worktop'
import { computeWorktopItemsL } from '../shapes/L/worktop'
import type { PlacedItem } from '../types'

describe('worktop segmenting around tall elements', () => {
  it('splits straight worktop into separate segments around tall blockers', () => {
    const items: PlacedItem[] = [
      { uniqueId: 'b1', catalogId: 'base', elementId: 'r1', width: 600, depth: 600, x: 0, wallKey: 'A' },
      { uniqueId: 't1', catalogId: 'tall', elementId: 'k1', width: 600, depth: 600, x: 600, wallKey: 'A' },
      { uniqueId: 'b2', catalogId: 'base', elementId: 'r2', width: 800, depth: 600, x: 1200, wallKey: 'A' },
    ]

    const result = computeWorktopItemsI(items)
    expect(result).toHaveLength(2)
    expect(result.map((item) => [item.x, item.width])).toEqual([
      [0, 600],
      [1200, 800],
    ])
  })

  it('splits L-shape worktop runs after a tall element on the corner wall using real placement coordinates', () => {
    const items: PlacedItem[] = [
      { uniqueId: 'corner', catalogId: 'corner', elementId: 'u1', width: 1100, depth: 650, x: 0, wallKey: 'A', category: 'base', cornerHandedness: 'left' },
      // wall A stores right edge after placement
      { uniqueId: 'b1', catalogId: 'base', elementId: 'r1', width: 600, depth: 600, x: 1750, wallKey: 'A' },
      { uniqueId: 't1', catalogId: 'tall', elementId: 'k1', width: 600, depth: 600, x: 2350, wallKey: 'A' },
      { uniqueId: 'b2', catalogId: 'base', elementId: 'r2', width: 800, depth: 600, x: 3150, wallKey: 'A' },
    ]

    const result = computeWorktopItemsL(items).filter((item) => item.wallKey === 'A')
    expect(result).toHaveLength(2)
    expect(result.map((item) => [item.x, item.width])).toEqual([
      [0, 1750],
      [2350, 800],
    ])
  })
})
