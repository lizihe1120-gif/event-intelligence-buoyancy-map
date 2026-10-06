import { describe, expect, it } from "vitest";

import { aggregateImpact, buildPageViewModel } from "./dataAdapter";

function companyStatus(snapshotId: Parameters<typeof buildPageViewModel>[0], companyId: string) {
  return buildPageViewModel(snapshotId).companies.find((company) => company.id === companyId)?.status;
}

describe("event evolution snapshots", () => {
  it("derives the three company trading states from trading_status_history", () => {
    expect(companyStatus("planning-suspension", "cmp-cssc")).toBe("suspended");
    expect(companyStatus("planning-suspension", "cmp-csic")).toBe("suspended");
    expect(companyStatus("planning-suspension", "cmp-power")).toBe("normal_trading");

    expect(companyStatus("plan-resumption", "cmp-cssc")).toBe("resumed");
    expect(companyStatus("plan-resumption", "cmp-csic")).toBe("resumed");
    expect(companyStatus("plan-resumption", "cmp-power")).toBe("normal_trading");

    expect(companyStatus("implementation-complete", "cmp-cssc")).toBe("normal_trading");
    expect(companyStatus("implementation-complete", "cmp-csic")).toBe("delisted");
    expect(companyStatus("implementation-complete", "cmp-power")).toBe("normal_trading");
  });

  it("never exposes future versions in an earlier snapshot", () => {
    const planning = buildPageViewModel("planning-suspension");
    const planningMain = planning.events.find((event) => event.id === "evt-main-cssc-csic-merger");
    expect(planningMain?.versions.map((version) => version.version)).toEqual([1, 2, 3, 4]);
    expect(planningMain?.confirmationStatus).toBe("partially_confirmed");
    expect(planningMain?.executionStatus).toBe("planning");
    expect(planning.events.some((event) => event.id === "evt-aux-power-rights-change")).toBe(false);
    expect(planning.events.some((event) => event.id === "evt-aux-power-diesel-acquisition")).toBe(false);
    expect(planning.events.some((event) => event.relationStage === "stable_fusion" || event.relationStage === "cooling")).toBe(false);

    const resumption = buildPageViewModel("plan-resumption");
    const resumptionMain = resumption.events.find((event) => event.id === "evt-main-cssc-csic-merger");
    expect(resumptionMain?.versions.map((version) => version.version)).toEqual([1, 2, 3, 4, 5]);
    expect(resumptionMain?.executionStatus).toBe("pending_approval");
    expect(resumption.events.some((event) => event.relationStage === "stable_fusion" || event.relationStage === "cooling")).toBe(false);
  });

  it("keeps mixed and unclear as independent impact states", () => {
    expect(aggregateImpact(["positive", "negative"])).toBe("mixed");
    expect(aggregateImpact(["unclear", "unclear"])).toBe("unclear");

    const finalSnapshot = buildPageViewModel("implementation-complete");
    const mainEvent = finalSnapshot.events.find((event) => event.id === "evt-main-cssc-csic-merger");
    expect(mainEvent?.impact).toBe("mixed");
    expect(mainEvent?.versions[0]?.impact).toBe("unclear");
  });

  it("preserves unknown occurred_at and does not turn trading state into impact direction", () => {
    const planning = buildPageViewModel("planning-suspension");
    const mainEvent = planning.events.find((event) => event.id === "evt-main-cssc-csic-merger");
    expect(mainEvent?.versions[0]?.timeLabel).toBe("实际发生时间未知");

    const suspendedCssc = planning.companies.find((company) => company.id === "cmp-cssc");
    expect(suspendedCssc?.status).toBe("suspended");
    expect(suspendedCssc?.impact).not.toBe("negative");

    const finalSnapshot = buildPageViewModel("implementation-complete");
    const delistedCsic = finalSnapshot.companies.find((company) => company.id === "cmp-csic");
    expect(delistedCsic?.status).toBe("delisted");
    expect(delistedCsic?.impact).not.toBe("negative");
  });

  it("shows only observed, non-causal market changes on the resumption date", () => {
    const resumption = buildPageViewModel("plan-resumption");
    expect(resumption.companies.find((company) => company.id === "cmp-cssc")?.marketObservation).toBe("观察到 +3.32%");
    expect(resumption.companies.find((company) => company.id === "cmp-csic")?.marketObservation).toBe("观察到 -2.41%");
    expect(resumption.companies.find((company) => company.id === "cmp-power")?.marketObservation).toBe("观察到 -5.40%");
  });

  it("applies validated attention metrics to size and vertical lift without changing impact", () => {
    const planning = buildPageViewModel("planning-suspension");
    const final = buildPageViewModel("implementation-complete");
    const planningCssc = planning.companies.find((company) => company.id === "cmp-cssc")!;
    const finalCssc = final.companies.find((company) => company.id === "cmp-cssc")!;

    expect(finalCssc.attentionScore).toBeGreaterThan(planningCssc.attentionScore);
    expect(finalCssc.size).toBeGreaterThanOrEqual(planningCssc.size);
    expect(finalCssc.verticalLift).toBeGreaterThanOrEqual(planningCssc.verticalLift);
    expect(planningCssc.status).toBe("suspended");
    expect(planningCssc.impact).not.toBe("negative");
  });
});
