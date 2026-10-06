import { describe, expect, it } from "vitest";

import { availableDetailEventIds, buildEventDetailViewModel } from "./detailAdapter";
import { snapshots } from "./dataAdapter";

const finalSnapshot = snapshots[2];

describe("event detail view model", () => {
  it("opens all four visible events from the final snapshot", () => {
    const ids = availableDetailEventIds(finalSnapshot);
    expect(ids).toHaveLength(4);
    ids.forEach((id) => expect(buildEventDetailViewModel(id, finalSnapshot).eventId).toBe(id));
  });

  it("keeps traceable sources separate from independently weighted evidence", () => {
    const detail = buildEventDetailViewModel("evt-main-cssc-csic-merger", finalSnapshot);
    expect(detail.sourceCount).toBeGreaterThan(detail.weightedSourceCount);
    expect(detail.sources.some((source) => source.evidenceWeight === 0)).toBe(true);
    expect(detail.versions[0]?.conclusionDelta).toBe("起始版本，无上一版本可比较。");
  });

  it("preserves all four claim types and an unknown occurred_at", () => {
    const detail = buildEventDetailViewModel("evt-main-cssc-csic-merger", finalSnapshot);
    expect(new Set(detail.claims.map((claim) => claim.kind))).toEqual(new Set(["fact", "opinion", "inference", "rumor"]));
    expect(detail.versions[0]?.occurredAt).toBe("实际发生时间未知");
    expect(detail.claims.find((claim) => claim.kind === "rumor")?.appliesToCurrentConclusion).toBe(false);
  });

  it("labels first-party and repost sources and never reweights a repost", () => {
    const detail = buildEventDetailViewModel("evt-main-cssc-csic-merger", finalSnapshot);
    const firstParty = detail.sources.find((source) => source.sourceId === "src-010");
    expect(firstParty).toMatchObject({ isFirstParty: true, evidenceGrade: "A", evidenceWeight: 1 });
    const repost = detail.sources.find((source) => source.sourceId === "src-001");
    expect(repost).toMatchObject({ isReprint: true, evidenceGrade: "D", evidenceWeight: 0 });
    expect(repost?.weightNote).toContain("不重复增加证据权重");
  });

  it("expresses the final swap ratio as an update rather than a correction", () => {
    const detail = buildEventDetailViewModel("evt-main-cssc-csic-merger", finalSnapshot);
    const finalVersion = detail.versions.find((version) => version.version === 7);
    expect(finalVersion?.relationToPrevious).toBe("updates");
    expect(finalVersion?.conclusionDelta).toContain("1:0.1339替代预案比例1:0.1335");
    expect(finalVersion?.conclusionDelta).toContain("不表示预案披露错误");
  });

  it("keeps the diesel acquisition terminated and noncompete commitments implementing", () => {
    const diesel = buildEventDetailViewModel("evt-aux-power-diesel-acquisition", finalSnapshot);
    expect(diesel.executionStatus).toBe("terminated");
    expect(diesel.currentConclusion).toContain("终止");
    expect(diesel.conflicts.some((conflict) => conflict.title.includes("真实推进后终止"))).toBe(true);

    const noncompete = buildEventDetailViewModel("evt-aux-cssc-noncompete-change", finalSnapshot);
    expect(noncompete.executionStatus).toBe("implementing");
    expect(noncompete.currentConclusion).toContain("仍需");
    expect(noncompete.currentConclusion).toContain("不能表述为全部同业竞争已经彻底解决");
  });

  it("preserves mixed and unclear per-company impacts", () => {
    const detail = buildEventDetailViewModel("evt-main-cssc-csic-merger", finalSnapshot);
    expect(new Set(detail.impacts.map((impact) => impact.direction))).toEqual(new Set(["mixed", "unclear"]));
  });

  it("keeps every displayed key number traceable to raw fields and a source name or id", () => {
    const detail = buildEventDetailViewModel("evt-main-cssc-csic-merger", finalSnapshot);
    expect(detail.market.observations.length).toBeGreaterThan(0);
    detail.market.observations.forEach((observation) => {
      expect(observation.rawFieldPath).toMatch(/^market-reactions\.json#observations\[\d+\]$/);
      expect(observation.priceSourceIds.length + observation.dataSourceNames.length).toBeGreaterThan(0);
    });
  });

  it("does not leak future versions into an earlier detail snapshot", () => {
    const detail = buildEventDetailViewModel("evt-main-cssc-csic-merger", snapshots[0]);
    expect(detail.versions.map((version) => version.version)).toEqual([1, 2, 3, 4]);
    expect(detail.executionStatus).toBe("planning");
  });
});
