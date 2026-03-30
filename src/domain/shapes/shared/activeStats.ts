// src/domain/shapes/shared/activeStats.ts
import type { PlacedItem, WallKey, Walls } from "../../types";
import { parseDim } from "../I/placementLogic";
import { isCornerType, readPlacedCornerCategory, readPlacedCornerHandedness } from "../../rules/corner";

function getItemWallKey(item: PlacedItem): WallKey {
  return item.wallKey ?? "A";
}

function getConsumedLength(item: PlacedItem, activeWall: WallKey): number {
  const handedness = readPlacedCornerHandedness(item);
  if (!handedness) return 0;

  if (activeWall === "A") {
    return handedness === "left" ? item.width : item.depth;
  }
  if (activeWall === "B") {
    return handedness === "left" ? item.depth : item.width;
  }
  return 0;
}

export function computeActiveStatsShared(params: {
  walls: Walls;
  activeWall: WallKey;
  placedItems: PlacedItem[];
}): { total: number; freeBase: number; freeWall: number } {
  const { walls, activeWall, placedItems } = params;

  const safeItems: PlacedItem[] = Array.isArray(placedItems) ? placedItems : [];
  const total = parseDim(walls[activeWall]);
  let usedBase = 0;
  let usedWall = 0;

  safeItems.forEach((item) => {
    const type = String(item.catalogId || "").toLowerCase();
    const isCorner = isCornerType(type);

    if (!isCorner) {
      if (getItemWallKey(item) === activeWall) {
        if (type === "base" || type === "tall") usedBase += item.width;
        if (type === "wall" || type === "tall") usedWall += item.width;
      }
      return;
    }

    const consumed = getConsumedLength(item, activeWall);
    if (consumed <= 0) return;

    const category = readPlacedCornerCategory(item);
    if (category === "base") usedBase += consumed;
    if (category === "wall") usedWall += consumed;
  });

  return {
    total,
    freeBase: Math.max(0, total - usedBase),
    freeWall: Math.max(0, total - usedWall),
  };
}
