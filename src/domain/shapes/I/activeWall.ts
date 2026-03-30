export type WallKey = "A" | "B";
export type Walls = Record<WallKey, { length: number }>;

export function computeActiveWallI(activeWall: WallKey | null | undefined): WallKey {
  return (activeWall ?? "A") as WallKey;
}

export function formatWallLengthI(walls: Walls, wallKey: WallKey): number {
  return walls[wallKey].length;
}
