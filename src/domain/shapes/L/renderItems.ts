import type { PlacedItem } from "../../types";
import { stableSortByXWithinWall } from "../shared/renderSort";
import { fillMissingXByCumulativeWidth } from "../shared/renderAutoX";
import type { OptionsValues } from "../../../ui/options/types";
import { computeWorktopItemsL } from "./worktop";

/**
 * L-shape – render normalization.
 *
 * IMPORTANT: Must not change observable behavior.
 * - Stable sort by X within the same wallKey
 * - Fill missing/invalid X values conservatively per wall
 */
export function computeRenderItemsL(placedItems: PlacedItem[], options: OptionsValues): PlacedItem[] {
  const items = Array.isArray(placedItems) ? placedItems : [];
  const sorted = stableSortByXWithinWall(items);
  const normalized = fillMissingXByCumulativeWidth(sorted);
  const visibleItems = normalized.filter((item) => String(item.catalogId ?? '').toLowerCase() !== '__support__')

  if (options?.worktop && options.worktop !== 'Bez Radne ploče') {
    const wt = computeWorktopItemsL(normalized);
    return [...visibleItems, ...wt];
  }

  return visibleItems;
}
