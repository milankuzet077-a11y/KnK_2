import type { PlacedItem, WallKey } from "../../types";
import { getLCornersState } from "../L/placementLogic";

export function getShapeFlags(shape: string) {
  const isIShape = shape === 'straight';
  const isParallelShape = shape === 'parallel';
  const isLShape = shape === 'l-shape';
  return { isIShape, isParallelShape, isLShape };
}

export function getAvailableWalls(shape: string): Array<'A'|'B'> {
  if (shape === 'parallel') return ['A','B'];
  // straight + l-shape effectively render on wall A (legacy behavior)
  return ['A'];
}

// Accept broader wall keys because UI can carry 'C' (future shapes) in state.
// Runtime behavior remains identical for existing shapes.
export function getActiveWall(shape: string, targetWall: WallKey | null): WallKey {
  return shape === 'straight' ? 'A' : (targetWall ?? 'A');
}

export function getCornersState(shape: string, placedItems: PlacedItem[]) {
  if (shape === 'l-shape') return getLCornersState(placedItems);
  // Legacy default: allow non-corner groups (no locking).
  return { hasLower: true, hasUpper: true, ready: true };
}
