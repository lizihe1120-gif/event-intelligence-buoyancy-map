import type { CompanyViewModel, EventViewModel, RelationStage, VersionViewModel } from "./types";

export interface Point {
  x: number;
  y: number;
}

export const companyPositions: Record<string, Point> = {
  "cmp-cssc": { x: 220, y: 148 },
  "cmp-csic": { x: 590, y: 148 },
  "cmp-power": { x: 955, y: 148 }
};

export const eventPositions: Record<string, Point> = {
  "evt-aux-cssc-noncompete-change": { x: 155, y: 418 },
  "evt-main-cssc-csic-merger": { x: 500, y: 388 },
  "evt-aux-power-rights-change": { x: 785, y: 430 },
  "evt-aux-power-diesel-acquisition": { x: 1030, y: 500 }
};

export const versionPositions: Record<string, Point[]> = {
  "evt-aux-cssc-noncompete-change": [
    { x: 70, y: 680 },
    { x: 155, y: 638 },
    { x: 240, y: 565 }
  ],
  "evt-main-cssc-csic-merger": [
    { x: 300, y: 684 },
    { x: 365, y: 664 },
    { x: 430, y: 644 },
    { x: 495, y: 624 },
    { x: 565, y: 610 },
    { x: 640, y: 585 },
    { x: 660, y: 505 }
  ],
  "evt-aux-power-rights-change": [
    { x: 790, y: 680 },
    { x: 850, y: 590 }
  ],
  "evt-aux-power-diesel-acquisition": [
    { x: 940, y: 680 },
    { x: 1035, y: 680 },
    { x: 1115, y: 650 }
  ]
};

const eventLiftByStage: Record<RelationStage, number> = {
  drifting: -2,
  lifting: 4,
  approaching: 10,
  stable_fusion: 17,
  cooling: -8
};

const versionApproachRatio: Record<RelationStage, number> = {
  drifting: 0,
  lifting: 0.035,
  approaching: 0.1,
  stable_fusion: 0.2,
  cooling: -0.025
};

export function companyPoint(company: Pick<CompanyViewModel, "id" | "verticalLift">): Point | null {
  const base = companyPositions[company.id];
  return base ? { x: base.x, y: base.y - company.verticalLift } : null;
}

export function eventPoint(event: Pick<EventViewModel, "id" | "relationStage">): Point | null {
  const base = eventPositions[event.id];
  return base ? { x: base.x, y: base.y - eventLiftByStage[event.relationStage] } : null;
}

export function versionPoint(
  event: Pick<EventViewModel, "id" | "relationStage">,
  version: Pick<VersionViewModel, "relationStage">,
  index: number
): Point | null {
  const base = versionPositions[event.id]?.[index];
  const target = eventPoint(event);
  if (!base || !target) return null;
  const ratio = versionApproachRatio[version.relationStage];
  return {
    x: base.x + (target.x - base.x) * ratio,
    y: base.y + (target.y - base.y) * ratio + (version.relationStage === "cooling" ? 7 : 0)
  };
}

export function versionBubbleSize(stage: RelationStage): number {
  return ({ drifting: 62, lifting: 66, approaching: 71, stable_fusion: 77, cooling: 68 })[stage];
}
