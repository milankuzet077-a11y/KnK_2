import type { PlacedItem, WallKey } from "../../types";

export type { WallKey };

export function defaultWallKeyOf(item: PlacedItem): WallKey {
  return item.wallKey ?? "A";
}

export function stableSortByX(items: PlacedItem[]): PlacedItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const indexed = items.map((it, i) => ({ it, i }));
  indexed.sort((a, b) => {
    const ax = Number(a.it.x) || 0;
    const bx = Number(b.it.x) || 0;
    if (ax !== bx) return ax - bx;
    return a.i - b.i;
  });
  return indexed.map((x) => x.it);
}

export function stableSortByXWithinWall(items: PlacedItem[]): PlacedItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const indexed = items.map((it, i) => ({ it, i, wk: defaultWallKeyOf(it) }));
  indexed.sort((a, b) => {
    if (a.wk === b.wk) {
      const ax = Number(a.it.x) || 0;
      const bx = Number(b.it.x) || 0;
      if (ax !== bx) return ax - bx;
    }
    return a.i - b.i;
  });
  return indexed.map((x) => x.it);
}
