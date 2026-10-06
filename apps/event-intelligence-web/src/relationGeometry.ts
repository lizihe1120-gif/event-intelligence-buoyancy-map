import type { RelationStage } from "./types";

export interface GeometryPoint {
  x: number;
  y: number;
}

export interface RelationCircle {
  center: GeometryPoint;
  radius: number;
}

export interface RelationVisualSpec {
  stage: RelationStage;
  bodyWidth: number;
  maxSurfaceGap: number;
  opacity: number;
  shapeCue: "trace" | "narrow_neck" | "wide_neck" | "metaball" | "broken_residue";
}

export interface LiquidBridgeGeometry {
  stage: RelationStage;
  guidePath: string;
  solidPath: string | null;
  residuePaths: string[];
  centerDistance: number;
  surfaceGap: number;
  withinSolidRange: boolean;
}

export const relationVisualSpecs: Record<RelationStage, RelationVisualSpec> = {
  drifting: { stage: "drifting", bodyWidth: 0, maxSurfaceGap: 0, opacity: 0.24, shapeCue: "trace" },
  lifting: { stage: "lifting", bodyWidth: 7, maxSurfaceGap: 190, opacity: 0.5, shapeCue: "narrow_neck" },
  approaching: { stage: "approaching", bodyWidth: 13, maxSurfaceGap: 240, opacity: 0.68, shapeCue: "wide_neck" },
  stable_fusion: { stage: "stable_fusion", bodyWidth: 21, maxSurfaceGap: 300, opacity: 0.86, shapeCue: "metaball" },
  cooling: { stage: "cooling", bodyWidth: 6, maxSurfaceGap: 260, opacity: 0.34, shapeCue: "broken_residue" }
};

function number(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function safeCircle(circle: RelationCircle): RelationCircle {
  if (![circle.center.x, circle.center.y, circle.radius].every(Number.isFinite)) {
    throw new Error("Relation geometry requires finite circle coordinates and radii.");
  }
  return { center: circle.center, radius: Math.max(1, circle.radius) };
}

function curvePath(from: GeometryPoint, to: GeometryPoint): string {
  const dy = to.y - from.y;
  const bend = Math.max(34, Math.min(118, Math.abs(dy) * 0.38));
  return `M ${number(from.x)} ${number(from.y)} C ${number(from.x)} ${number(from.y - bend)}, ${number(to.x)} ${number(to.y + bend)}, ${number(to.x)} ${number(to.y)}`;
}

function ribbonPath(
  from: RelationCircle,
  to: RelationCircle,
  width: number,
  centerDistance: number,
  ux: number,
  uy: number
): string {
  const px = -uy;
  const py = ux;
  const startOffset = Math.min(from.radius * 0.86, centerDistance * 0.39);
  const endOffset = Math.min(to.radius * 0.86, centerDistance * 0.39);
  let sx = from.center.x + ux * startOffset;
  let sy = from.center.y + uy * startOffset;
  let ex = to.center.x - ux * endOffset;
  let ey = to.center.y - uy * endOffset;
  let span = Math.hypot(ex - sx, ey - sy);

  if (span < 8) {
    const mx = (from.center.x + to.center.x) / 2;
    const my = (from.center.y + to.center.y) / 2;
    sx = mx - ux * 4;
    sy = my - uy * 4;
    ex = mx + ux * 4;
    ey = my + uy * 4;
    span = 8;
  }

  const startWidth = Math.min(width, from.radius * 0.34);
  const endWidth = Math.min(width * 1.08, to.radius * 0.3);
  const control = Math.max(5, span * 0.38);

  return [
    `M ${number(sx + px * startWidth)} ${number(sy + py * startWidth)}`,
    `C ${number(sx + ux * control + px * startWidth)} ${number(sy + uy * control + py * startWidth)}, ${number(ex - ux * control + px * endWidth)} ${number(ey - uy * control + py * endWidth)}, ${number(ex + px * endWidth)} ${number(ey + py * endWidth)}`,
    `Q ${number(ex + ux * endWidth * 0.5)} ${number(ey + uy * endWidth * 0.5)}, ${number(ex - px * endWidth)} ${number(ey - py * endWidth)}`,
    `C ${number(ex - ux * control - px * endWidth)} ${number(ey - uy * control - py * endWidth)}, ${number(sx + ux * control - px * startWidth)} ${number(sy + uy * control - py * startWidth)}, ${number(sx - px * startWidth)} ${number(sy - py * startWidth)}`,
    `Q ${number(sx - ux * startWidth * 0.45)} ${number(sy - uy * startWidth * 0.45)}, ${number(sx + px * startWidth)} ${number(sy + py * startWidth)}`,
    "Z"
  ].join(" ");
}

function residuePath(origin: GeometryPoint, ux: number, uy: number, length: number, width: number): string {
  const px = -uy;
  const py = ux;
  const tipX = origin.x + ux * length;
  const tipY = origin.y + uy * length;
  return [
    `M ${number(origin.x + px * width)} ${number(origin.y + py * width)}`,
    `C ${number(origin.x + ux * length * 0.42 + px * width)} ${number(origin.y + uy * length * 0.42 + py * width)}, ${number(tipX - ux * length * 0.18 + px * 1.4)} ${number(tipY - uy * length * 0.18 + py * 1.4)}, ${number(tipX)} ${number(tipY)}`,
    `C ${number(tipX - ux * length * 0.18 - px * 1.4)} ${number(tipY - uy * length * 0.18 - py * 1.4)}, ${number(origin.x + ux * length * 0.42 - px * width)} ${number(origin.y + uy * length * 0.42 - py * width)}, ${number(origin.x - px * width)} ${number(origin.y - py * width)}`,
    "Z"
  ].join(" ");
}

export function buildLiquidBridge(
  rawFrom: RelationCircle,
  rawTo: RelationCircle,
  stage: RelationStage
): LiquidBridgeGeometry {
  const from = safeCircle(rawFrom);
  const to = safeCircle(rawTo);
  const spec = relationVisualSpecs[stage];
  const dx = to.center.x - from.center.x;
  const dy = to.center.y - from.center.y;
  const centerDistance = Math.max(0.001, Math.hypot(dx, dy));
  const ux = dx / centerDistance;
  const uy = dy / centerDistance;
  const surfaceGap = centerDistance - from.radius - to.radius;
  const withinSolidRange = surfaceGap <= spec.maxSurfaceGap;
  const guidePath = curvePath(from.center, to.center);

  if (stage === "drifting") {
    return { stage, guidePath, solidPath: null, residuePaths: [], centerDistance, surfaceGap, withinSolidRange: false };
  }

  if (stage === "cooling") {
    const gapForResidue = Math.max(18, Math.min(76, Math.max(0, surfaceGap) * 0.32));
    const fromEdge = {
      x: from.center.x + ux * Math.min(from.radius * 0.84, centerDistance * 0.38),
      y: from.center.y + uy * Math.min(from.radius * 0.84, centerDistance * 0.38)
    };
    const toEdge = {
      x: to.center.x - ux * Math.min(to.radius * 0.84, centerDistance * 0.38),
      y: to.center.y - uy * Math.min(to.radius * 0.84, centerDistance * 0.38)
    };
    return {
      stage,
      guidePath,
      solidPath: null,
      residuePaths: [
        residuePath(fromEdge, ux, uy, gapForResidue, spec.bodyWidth),
        residuePath(toEdge, -ux, -uy, gapForResidue, spec.bodyWidth * 0.82)
      ],
      centerDistance,
      surfaceGap,
      withinSolidRange
    };
  }

  return {
    stage,
    guidePath,
    solidPath: withinSolidRange ? ribbonPath(from, to, spec.bodyWidth, centerDistance, ux, uy) : null,
    residuePaths: [],
    centerDistance,
    surfaceGap,
    withinSolidRange
  };
}

export function geometryContainsOnlyFiniteNumbers(geometry: LiquidBridgeGeometry): boolean {
  const serialized = [geometry.guidePath, geometry.solidPath ?? "", ...geometry.residuePaths].join(" ");
  return !/NaN|Infinity/.test(serialized)
    && [geometry.centerDistance, geometry.surfaceGap].every(Number.isFinite);
}
