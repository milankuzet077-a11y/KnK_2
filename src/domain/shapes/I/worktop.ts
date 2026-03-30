import type { PlacedItem } from "../../types";
import { makeWorktopVirtualItem } from "../shared/worktopVirtual";
import { computeWorktopRunsForWall } from "../shared/worktopRuns";

export function computeWorktopItemsI(placedItems: PlacedItem[]) {
  return computeWorktopRunsForWall(placedItems, "A").map((run) =>
    makeWorktopVirtualItem({ wallKey: "A", xMm: run.startMm, lengthMm: Math.max(0, run.endMm - run.startMm) }),
  );
}
