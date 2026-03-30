export type WallKey = "A" | "B";
export type Walls = Record<WallKey, { length: number }>;

export function computeActiveWallL(activeWall: WallKey | null | undefined): WallKey {
  return (activeWall ?? "A") as WallKey;
}

export function formatWallLengthL(walls: Walls, wallKey: WallKey): number {
  return walls[wallKey].length;
}
