import type { PlacedItem, WallKey } from "../../types";

export const WORKTOP_THICKNESS_MM = 40;
export const WORKTOP_DEPTH_MM = 600;
export const WORKTOP_DEFAULT_BOTTOM_Y_MM = 820; // iznad donjih elemenata (+10cm) // iznad donjih elemenata (standardna visina korpusa)

export type WorktopVirtualItem = PlacedItem & {
  /**
   * Poseban marker da Canvas3D može da renderuje ploču bez GLB-a.
   */
  __virtualType: "worktop";
  thicknessMm: number;
  depthMm: number;
};

export function makeWorktopVirtualItem(params: {
  wallKey: WallKey;
  xMm: number; // levi rub (mm) u koordinatnom sistemu tog zida
  lengthMm: number;
  bottomYmm?: number;
}): WorktopVirtualItem {
  const { wallKey, xMm, lengthMm, bottomYmm } = params;
  const safeLen = Math.max(0, Math.round(Number(lengthMm) || 0));
  const safeX = Math.max(0, Math.round(Number(xMm) || 0));
  return {
    uniqueId: `__worktop__${wallKey}__${safeX}__${safeLen}`,
    catalogId: "__virtual__",
    elementId: "worktop",
    category: "worktop",
    width: safeLen,
    depth: WORKTOP_DEPTH_MM,
    x: safeX,
    wallKey,
    mountingHeight: Number(bottomYmm ?? WORKTOP_DEFAULT_BOTTOM_Y_MM),
    price: 0,
    __virtualType: "worktop",
    thicknessMm: WORKTOP_THICKNESS_MM,
    depthMm: WORKTOP_DEPTH_MM,
  };
}
