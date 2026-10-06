import { describe, expect, it } from "vitest";

import {
  buildLiquidBridge,
  geometryContainsOnlyFiniteNumbers,
  relationVisualSpecs
} from "./relationGeometry";
import type { RelationStage } from "./types";

const from = { center: { x: 100, y: 520 }, radius: 34 };
const to = { center: { x: 180, y: 360 }, radius: 92 };

describe("liquid relation geometry", () => {
  it("maps all five relation stages to distinct static visual cues", () => {
    const stages: RelationStage[] = ["drifting", "lifting", "approaching", "stable_fusion", "cooling"];
    expect(Object.keys(relationVisualSpecs).sort()).toEqual([...stages].sort());
    expect(new Set(stages.map((stage) => relationVisualSpecs[stage].shapeCue)).size).toBe(5);
  });

  it("never emits NaN or Infinity for separated, touching or overlapping circles", () => {
    const cases = [
      [from, to],
      [{ center: { x: 10, y: 10 }, radius: 40 }, { center: { x: 70, y: 10 }, radius: 30 }],
      [{ center: { x: 10, y: 10 }, radius: 60 }, { center: { x: 30, y: 10 }, radius: 55 }]
    ] as const;
    for (const stage of Object.keys(relationVisualSpecs) as RelationStage[]) {
      for (const [start, end] of cases) {
        expect(geometryContainsOnlyFiniteNumbers(buildLiquidBridge(start, end, stage))).toBe(true);
      }
    }
  });

  it("keeps distant relationships as guides instead of forcing a solid bridge", () => {
    const geometry = buildLiquidBridge(
      { center: { x: 0, y: 0 }, radius: 20 },
      { center: { x: 900, y: 700 }, radius: 20 },
      "stable_fusion"
    );
    expect(geometry.solidPath).toBeNull();
    expect(geometry.guidePath).toMatch(/^M /);
    expect(geometry.withinSolidRange).toBe(false);
  });

  it("generates a deterministic closed metaball bridge for stable fusion", () => {
    const first = buildLiquidBridge(from, to, "stable_fusion");
    const second = buildLiquidBridge(from, to, "stable_fusion");
    expect(first.solidPath).toBeTruthy();
    expect(first.solidPath).toBe(second.solidPath);
    expect(first.solidPath?.endsWith("Z")).toBe(true);
    expect(first.residuePaths).toEqual([]);
  });

  it("renders cooling as two residual traces without deleting the relationship", () => {
    const cooling = buildLiquidBridge(from, to, "cooling");
    expect(cooling.solidPath).toBeNull();
    expect(cooling.residuePaths).toHaveLength(2);
    expect(cooling.guidePath).toBeTruthy();
  });
});
