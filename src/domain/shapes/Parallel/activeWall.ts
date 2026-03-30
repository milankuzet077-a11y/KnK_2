export type WallKey = "A" | "B";
export type Walls = Record<WallKey, { length: number }>;

export function computeActiveWallParallel(
  activeWall: WallKey | null | undefined,
  walls: Walls
): WallKey {
  return (activeWall ?? (walls.A.length >= walls.B.length ? "A" : "B")) as WallKey;
}

export function formatWallLengthParallel(walls: Walls, wallKey: WallKey): number {
  return walls[wallKey].length;
}
