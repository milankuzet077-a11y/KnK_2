import type { PlacedItem } from "../../types";
import { defaultWallKeyOf, type WallKey } from "./renderSort";

export function fillMissingXByCumulativeWidth(items: PlacedItem[]): PlacedItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const cursors: Record<string, number> = Object.create(null);
  const out: PlacedItem[] = [];

  for (const item of items) {
    const wk: WallKey = defaultWallKeyOf(item);
    const key = wk;
    const rawX = item.x;
    const hasValidX = Number.isFinite(Number(rawX));

    if (!Number.isFinite(cursors[key])) cursors[key] = 0;

    if (hasValidX) {
      out.push(item);
      const w = Number(item.width) || 0;
      const endX = Number(rawX) + w;
      if (endX > cursors[key]) cursors[key] = endX;
      continue;
    }

    const x = cursors[key] || 0;
    const w = Number(item.width) || 0;
    cursors[key] = x + w;
    out.push({ ...item, x });
  }

  return out;
}
