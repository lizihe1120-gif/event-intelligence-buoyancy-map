import { describe, expect, it } from "vitest";

import eventsJson from "../../../data/demo/events.json";
import analysisResponseJson from "../../../data/demo-runs/material-analysis-001/analysis-response.json";

import { detectVersionChanges } from "./changeDetection";
import { buildNotificationsArtifact } from "./pipeline/buildNotificationsArtifact";
import type { AnalysisResponseArtifact } from "./pipeline/types";
import type { EventRecord } from "./types";

const events = eventsJson.events as EventRecord[];
const response = analysisResponseJson as AnalysisResponseArtifact;

describe("adjacent version change detection", () => {
  it("generates one stable change for every adjacent real version pair", () => {
    const first = detectVersionChanges(events, response);
    const second = detectVersionChanges(events, response);
    expect(first).toHaveLength(15);
    expect(second).toEqual(first);
    expect(new Set(first.map((change) => change.change_id)).size).toBe(first.length);
  });

  it("keeps supports as evidence support when the conclusion and states do not change", () => {
    const raw = events[0];
    const analysis = response.event_clusters[0];
    if (!raw || !analysis) throw new Error("Missing fixture input");
    const previous = { ...analysis.versions[0]!, version: 1, source_ids: ["src-001"] };
    const current = {
      ...previous,
      version: 2,
      label: "新增支持材料",
      disclosed_at: "2024-01-02",
      relation_to_previous: "supports" as const,
      source_ids: ["src-002"],
      conclusion_delta: "仅增加支持证据，结论不变。"
    };
    const syntheticResponse: AnalysisResponseArtifact = {
      ...response,
      event_clusters: [{ ...analysis, versions: [previous, current] }]
    };
    const syntheticEvent: EventRecord = {
      ...raw,
      versions: [
        { ...raw.versions[0]!, version: 1, disclosed_at: "2024-01-01", source_ids: ["src-001"] },
        { ...raw.versions[0]!, version: 2, label: current.label, disclosed_at: current.disclosed_at, source_ids: ["src-002"] }
      ]
    };
    const [change] = detectVersionChanges([syntheticEvent], syntheticResponse);
    expect(change?.relation).toBe("supports");
    expect(change?.changed_fields).not.toContain("conclusion");
    expect(change?.severity).toBe("info");
  });

  it("distinguishes the final ratio update from a correction", () => {
    const change = detectVersionChanges(events, response).find((item) => item.event_id === "evt-main-cssc-csic-merger" && item.current_version === 7);
    expect(change).toMatchObject({ relation: "updates", lifecycle_change: "completed" });
    expect(change?.conclusion_delta).toContain("1:0.1339替代预案比例1:0.1335");
    expect(change?.conclusion_delta).toContain("不表示预案披露错误");
  });

  it("marks the diesel acquisition as terminated while noncompete remains implementing", () => {
    const changes = detectVersionChanges(events, response);
    expect(changes.find((item) => item.event_id === "evt-aux-power-diesel-acquisition" && item.current_version === 7)).toMatchObject({
      lifecycle_change: "terminated", execution_status_after: "terminated", severity: "critical"
    });
    expect(changes.find((item) => item.event_id === "evt-aux-cssc-noncompete-change" && item.current_version === 3)).toMatchObject({
      execution_status_before: "implementing", execution_status_after: "implementing", lifecycle_change: null
    });
  });

  it("does not generate a notification without a resolvable source", () => {
    const artifact = buildNotificationsArtifact({
      runId: "test",
      generatedAt: "2026-01-01T00:00:00+08:00",
      events,
      response,
      companies: [],
      validSourceIds: []
    });
    expect(artifact.change_count).toBe(15);
    expect(artifact.notification_count).toBe(0);
  });
});
