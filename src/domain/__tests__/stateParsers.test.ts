import { describe, expect, it } from "vitest"
import { normalizeWalls, parsePlacedItem, parseShape } from "../stateParsers"

describe("stateParsers", () => {
  it("accepts only supported shapes", () => {
    expect(parseShape("straight")).toBe("straight")
    expect(parseShape("unknown")).toBeNull()
  })

  it("normalizes wall payloads from storage", () => {
    expect(normalizeWalls({ A: "3600", B: 2400, C: "bad" })).toEqual({
      A: 3600,
      B: 2400,
      C: 2400,
      D: undefined,
    })
  })

  it("rejects malformed placed items", () => {
    expect(parsePlacedItem({ uniqueId: "1" })).toBeNull()
    expect(parsePlacedItem({
      uniqueId: "1",
      catalogId: "base",
      elementId: "b60",
      width: 600,
      depth: 560,
      x: 0,
      wallKey: "A",
    })).toMatchObject({ uniqueId: "1", x: 0, wallKey: "A" })
  })
})
