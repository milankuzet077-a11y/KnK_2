import { describe, expect, it } from "vitest"
import { removePlacedItem, tryPlaceItemStrict, validateLayout } from "../placementService"
import type { CatalogItemLike } from "../../shapes/common/catalogItemHelpers"
import type { PlacedItem, Walls } from "../../types"

const walls: Walls = { A: 2000, B: 2000, C: 2000 }

const base80: CatalogItemLike = {
  id: "b80",
  name: "Base 80",
  type: "base",
  dims: { w: 800, h: 720, d: 560 },
  glb: "/b80.glb",
  price: 100,
}

describe("placementService", () => {
  it("places first straight item on wall A at x=0", () => {
    const result = tryPlaceItemStrict({
      shape: "straight",
      walls,
      placedItems: [],
      catalogItem: base80,
      uniqueId: "u1",
      targetWall: "A",
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.item.x).toBe(0)
      expect(result.item.wallKey).toBe("A")
      expect(result.item.width).toBe(800)
    }
  })

  it("rejects invalid layout state before placement", () => {
    const invalid: PlacedItem[] = [{
      uniqueId: "bad",
      catalogId: "base",
      elementId: "bad",
      width: 800,
      depth: 560,
      x: -10,
      wallKey: "A",
    }]

    expect(validateLayout("straight", walls, invalid)).toEqual({
      ok: false,
      message: "Element bad ima neispravnu poziciju.",
    })

    const result = tryPlaceItemStrict({
      shape: "straight",
      walls,
      placedItems: invalid,
      catalogItem: base80,
      uniqueId: "u2",
    })
    expect(result.ok).toBe(false)
  })

  it("removes selected item without mutating others", () => {
    const items: PlacedItem[] = [
      { uniqueId: "1", catalogId: "base", elementId: "a", width: 600, depth: 560, x: 0, wallKey: "A" },
      { uniqueId: "2", catalogId: "base", elementId: "b", width: 600, depth: 560, x: 600, wallKey: "A" },
    ]
    const next = removePlacedItem(items, "1")
    expect(next).toHaveLength(1)
    expect(next[0]?.uniqueId).toBe("2")
    expect(items).toHaveLength(2)
  })
})
