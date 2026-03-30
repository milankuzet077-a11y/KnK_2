import type { PlacedItem, WallKey } from "../../types";
import { makeWorktopVirtualItem } from "../shared/worktopVirtual";
import { computeWorktopRunsForWall } from "../shared/worktopRuns";

export function computeWorktopItemsParallel(placedItems: PlacedItem[]) {
  const walls: WallKey[] = ["A", "B"];
  const out: ReturnType<typeof makeWorktopVirtualItem>[] = [];
  for (const wk of walls) {
    const runs = computeWorktopRunsForWall(placedItems, wk);
    for (const run of runs) {
      const len = Math.max(0, run.endMm - run.startMm);
      if (len > 0) out.push(makeWorktopVirtualItem({ wallKey: wk, xMm: run.startMm, lengthMm: len }));
    }
  }
  return out;
}
