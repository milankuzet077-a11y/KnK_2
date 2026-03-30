import type { PlacedItem } from "../../types";
import { stableSortByX } from "../shared/renderSort";
import { fillMissingXByCumulativeWidth } from "../shared/renderAutoX";
import type { OptionsValues } from "../../../ui/options/types";
import { computeWorktopItemsI } from "./worktop";

/**
 * Shape I (straight) – render/placement normalization.
 *
 * Strangler-pattern entrypoint used by Step3Configurator.
 *
 * IMPORTANT: Must not change observable behavior.
 * - We only normalize ordering (stable sort by X)
 * - We only fill missing/invalid X values (guarded), without touching existing X.
 */
export function computeRenderItemsI(placedItems: PlacedItem[], options: OptionsValues): PlacedItem[] {
  const items = Array.isArray(placedItems) ? placedItems : [];
  const sorted = stableSortByX(items);
  const normalized = fillMissingXByCumulativeWidth(sorted);
  const visibleItems = normalized.filter((item) => String(item.catalogId ?? '').toLowerCase() !== '__support__')

  if (options?.worktop && options.worktop !== 'Bez Radne ploče') {
    const wt = computeWorktopItemsI(normalized);
    return [...visibleItems, ...wt];
  }

  return visibleItems;
}
