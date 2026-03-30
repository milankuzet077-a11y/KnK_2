import type { PlacedItem, Walls } from "../../types";
import type { WallKey } from "../../placement/types";
import type { OptionsValues } from "../../../ui/options/types";

import { computeRenderItemsI } from "../I/renderItems";
import { computeRenderItemsL } from "../L/renderItems";
import { computeRenderItemsParallel } from "../Parallel/renderItems";

import { computeActiveStatsI } from "../I/activeStats";
import { computeActiveStatsL } from "../L/activeStats";
import { computeActiveStatsParallel } from "../Parallel/activeStats";

export function computeRenderItemsByShape(
  shape: string,
  placedItems: PlacedItem[],
  options: OptionsValues
): PlacedItem[] {
  switch (shape) {
    case "straight":
      return computeRenderItemsI(placedItems, options);
    case "l-shape":
      return computeRenderItemsL(placedItems, options);
    case "parallel":
      return computeRenderItemsParallel(placedItems, options);
    default:
      return placedItems ?? [];
  }
}

export function computeActiveStatsByShape(
  shape: string,
  params: { walls: Walls; activeWall: WallKey; placedItems: PlacedItem[] }
) {
  switch (shape) {
    case "l-shape":
      return computeActiveStatsL(params);
    case "parallel":
      return computeActiveStatsParallel(params);
    case "straight":
    default:
      return computeActiveStatsI(params);
  }
}
