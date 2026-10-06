import { describe, expect, it } from "vitest";

import companiesJson from "../../../../data/demo/companies.json";
import eventsJson from "../../../../data/demo/events.json";
import sourcesJson from "../../../../data/demo/sources.json";
import analysisResponseJson from "../../../../data/demo-runs/material-analysis-001/analysis-response.json";
import clusteringJson from "../../../../data/demo-runs/material-analysis-001/clustering-result.json";
import deduplicationJson from "../../../../data/demo-runs/material-analysis-001/deduplication-result.json";
import visualJson from "../../../../data/demo-runs/material-analysis-001/visual-result.json";
import validationJson from "../../../../data/demo-runs/material-analysis-001/validation-result.json";
import { buildVisualModel } from "./buildVisualModel";
import { deduplicateSources } from "./deduplicateSources";
import type { AnalysisResponseArtifact, PipelineSource, ValidationResult } from "./types";
import { validateAnalysisResponse } from "./validateAnalysisResponse";

const sources = sourcesJson.sources as PipelineSource[];
const response = analysisResponseJson as AnalysisResponseArtifact;

function validate(candidate: AnalysisResponseArtifact) {
  return validateAnalysisResponse({
    response: candidate,
    runId: "material-analysis-001",
    validatedAt: "2026-10-05T16:28:01+08:00",
    companyIds: companiesJson.companies.map((company) => company.company_id),
    eventIds: eventsJson.events.map((event) => event.event_id),
    sourceIds: sources.map((source) => source.source_id)
  });
}

describe("saved material analysis pipeline", () => {
  it("loads all 18 sources and preserves folded reposts for traceability", () => {
    expect(sources).toHaveLength(18);
    expect(deduplicationJson.source_count).toBe(18);
    const repost = deduplicationJson.source_records.find((record) => record.source_id === "src-001");
    expect(repost).toMatchObject({ fold_reason: "reprint_or_mirror", evidence_weight: 0, traceable: true });
  });

  it("does not double-weight an exact duplicate", () => {
    const original = { ...sources[0]!, is_reprint: false };
    const duplicate = { ...original, source_id: "src-duplicate", url: `${original.url}?utm_source=mirror` };
    const result = deduplicateSources([original, duplicate], "test-run");
    expect(result.exact_duplicate_groups).toHaveLength(1);
    expect(result.source_records.map((record) => record.evidence_weight).reduce((sum, weight) => sum + weight, 0)).toBe(1);
    expect(result.source_records.every((record) => record.traceable)).toBe(true);
  });

  it("forms four structured event clusters and keeps silhouette diagnostic-only", () => {
    expect(clusteringJson.cluster_count).toBe(4);
    expect(clusteringJson.clusters.map((cluster) => cluster.event_id)).toEqual(eventsJson.events.map((event) => event.event_id));
    expect(clusteringJson.silhouette_coefficient).toMatchObject({
      role: "diagnostic_only",
      used_for_deduplication: false,
      used_for_cluster_assignment: false,
      selected_k_by_metric: false
    });
    const main = clusteringJson.clusters.find((cluster) => cluster.event_id === "evt-main-cssc-csic-merger");
    const diesel = clusteringJson.clusters.find((cluster) => cluster.event_id === "evt-aux-power-diesel-acquisition");
    expect(main?.cluster_id).not.toBe(diesel?.cluster_id);
  });

  it("resolves every source, event, company, claim and basis reference", () => {
    expect(validationJson.passed).toBe(true);
    expect(validate(response).errors).toEqual([]);
  });

  it("rejects missing source references and invalid impact or dual statuses", () => {
    const missingSource = structuredClone(response);
    missingSource.claims[0]!.source_ids = ["src-does-not-exist"];
    expect(validate(missingSource).passed).toBe(false);

    const invalidImpact = structuredClone(response);
    invalidImpact.event_clusters[0]!.impact_by_company[0]!.direction = "bullish" as never;
    expect(validate(invalidImpact).errors.some((error) => error.includes("非法impact"))).toBe(true);

    const invalidConfirmation = structuredClone(response);
    invalidConfirmation.event_clusters[0]!.confirmation_status = "done";
    expect(validate(invalidConfirmation).errors.some((error) => error.includes("非法confirmation_status"))).toBe(true);

    const invalidExecution = structuredClone(response);
    invalidExecution.event_clusters[0]!.execution_status = "confirmed";
    expect(validate(invalidExecution).errors.some((error) => error.includes("非法execution_status"))).toBe(true);
  });

  it("rejects AI-generated market prices and blocks failed results from visual generation", () => {
    const withPrice = structuredClone(response) as AnalysisResponseArtifact & { price?: number };
    withPrice.price = 99.99;
    const failed = validate(withPrice);
    expect(failed.passed).toBe(false);
    expect(failed.rejected_fields).toContain("$.price");
    expect(() => buildVisualModel({
      response: withPrice,
      validation: failed,
      generatedAt: "2026-10-05T16:28:01+08:00",
      sources,
      companyIds: companiesJson.companies.map((company) => company.company_id)
    })).toThrow(/blocked/);
  });

  it("preserves mixed and unclear and supports different impacts per company", () => {
    const main = response.event_clusters.find((event) => event.event_id === "evt-main-cssc-csic-merger")!;
    expect(new Set(main.impact_by_company.map((impact) => impact.direction))).toEqual(new Set(["mixed", "positive"]));
    const early = main.versions[0]!;
    expect(early.impact_by_company.every((impact) => impact.direction === "unclear")).toBe(true);
    expect(main.versions.some((version) => version.impact_by_company.some((impact) => impact.direction === "mixed"))).toBe(true);
    const newsVersion = main.versions.find((version) => version.version === 5)!;
    expect(new Set(newsVersion.impact_by_company.map((impact) => impact.direction)).size).toBeGreaterThan(1);
  });

  it("produces validated visual data for all three current snapshots", () => {
    expect((validationJson as ValidationResult).passed).toBe(true);
    expect(visualJson.snapshots.map((snapshot) => snapshot.snapshot_id)).toEqual([
      "planning-suspension", "plan-resumption", "implementation-complete"
    ]);
    expect(visualJson.snapshots.every((snapshot) => snapshot.events.length > 0)).toBe(true);
    expect(visualJson.snapshots.every((snapshot) => snapshot.companies.length === 3)).toBe(true);
    expect(visualJson.snapshots.flatMap((snapshot) => snapshot.companies).every((company) =>
      company.attention_score >= 0
      && company.bubble_size > 0
      && company.vertical_lift >= 0
    )).toBe(true);
    expect(visualJson.color_mapping).toMatchObject({ mixed: "red_green", unclear: "silver" });
  });
});
