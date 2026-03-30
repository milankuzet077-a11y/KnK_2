import type { KitchenShape, Walls, WallKey } from "../../types";

export function computeTargetWall(params: {
  shape: KitchenShape;
  walls: Walls;
  activeWall: WallKey | null;
}): WallKey | null {
  const { shape, walls, activeWall } = params;
  // Preserve existing behavior: if one wall is zero-length, use the other; else prefer activeWall.
  if (shape === 'parallel') {
    const a = walls.A ?? 0;
    const b = walls.B ?? 0;
    return activeWall ?? (a >= b ? 'A' : 'B');
  }
  return activeWall ?? "A";
}
