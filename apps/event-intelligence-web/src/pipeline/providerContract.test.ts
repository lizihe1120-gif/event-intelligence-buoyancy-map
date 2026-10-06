import { beforeEach, describe, expect, it } from "vitest";

import companiesJson from "../../../../data/demo/companies.json";
import eventsJson from "../../../../data/demo/events.json";
import sourcesJson from "../../../../data/demo/sources.json";
import analysisResponseJson from "../../../../data/demo-runs/material-analysis-001/analysis-response.json";
import clusteringJson from "../../../../data/demo-runs/material-analysis-001/clustering-result.json";
import deduplicationJson from "../../../../data/demo-runs/material-analysis-001/deduplication-result.json";
import notificationsJson from "../../../../data/demo-runs/material-analysis-001/notifications.json";
import visualJson from "../../../../data/demo-runs/material-analysis-001/visual-result.json";
import {
  analyzeWithExplicitSavedFallback,
  type AnalysisProvider,
  OnlineAnalysisProvider,
  SavedAnalysisProvider
} from "./analysisProvider";
import { buildAnalysisPrompt } from "./buildAnalysisPrompt";
import type {
  AnalysisResponseArtifact,
  ClusteringResult,
  DeduplicationResult,
  PipelineSource
} from "./types";
import { validateAnalysisResponse } from "./validateAnalysisResponse";

const response = analysisResponseJson as AnalysisResponseArtifact;
const sources = sourcesJson.sources as PipelineSource[];

function request() {
  return buildAnalysisPrompt({
    runId: "material-analysis-001",
    promptVersion: "material-analysis-v1",
    generatedAt: "2026-10-05T16:18:00+08:00",
    companies: companiesJson.companies,
    sources,
    deduplication: deduplicationJson as DeduplicationResult,
    clustering: clusteringJson as ClusteringResult
  });
}

function onlineProvider() {
  return new OnlineAnalysisProvider({
    provider: "unconfigured",
    base_url: "",
    model: "unknown",
    prompt_version: "material-analysis-v1",
    request_format: "openai_compatible_json",
    timeout_ms: 30_000,
    server_proxy_url: null
  });
}

describe("Phase 7 analysis provider contract", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps saved and online implementations on the same interface", () => {
    const providers: AnalysisProvider[] = [new SavedAnalysisProvider(response), onlineProvider()];
    providers.forEach((provider) => {
      expect(provider.provider_id).toBeTruthy();
      expect(provider.provider_name).toBeTruthy();
      expect(["saved_result", "online"]).toContain(provider.mode);
      expect(provider.model).toBeTruthy();
      expect(provider.prompt_version).toBe("material-analysis-v1");
      expect(provider.timeout_ms).toBeGreaterThan(0);
      expect(provider.capability.strict_json).toBe(true);
      expect(typeof provider.analyze).toBe("function");
    });
  });

  it("reads a stable saved result and keeps run and prompt traceability", async () => {
    const provider = new SavedAnalysisProvider(response);
    const first = await provider.analyze(request());
    const second = await provider.analyze(request());
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.response).not.toBe(response);
    expect(first.response.run_id).toBe("material-analysis-001");
    expect(first.response.prompt_version).toBe("material-analysis-v1");
  });

  it("builds the same fixed request for the same input and includes the contract boundaries", () => {
    const first = request();
    expect(request()).toEqual(first);
    const user = JSON.parse(first.user_prompt) as Record<string, unknown>;
    expect(user.run_id).toBe("material-analysis-001");
    expect(user.prompt_version).toBe("material-analysis-v1");
    expect(user).toHaveProperty("deduplication_context");
    expect(user).toHaveProperty("company_relationships");
    expect(user).toHaveProperty("allowed_enums");
    expect(first.system_prompt).toContain("不得输出买入、卖出、目标价或收益预测");
    expect(first.system_prompt).toContain("不得决定A-D证据等级");
  });

  it("runs the saved response through the complete validation gate", async () => {
    const result = await new SavedAnalysisProvider(response).analyze(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const validation = validateAnalysisResponse({
      response: result.response,
      runId: request().run_id,
      validatedAt: "2026-10-05T16:28:01+08:00",
      companyIds: companiesJson.companies.map((company) => company.company_id),
      eventIds: eventsJson.events.map((event) => event.event_id),
      sourceIds: sources.map((source) => source.source_id)
    });
    expect(validation.passed).toBe(true);
    expect(Object.values(validation.checks).every((status) => status === "passed")).toBe(true);
  });

  it("returns structured failures for a missing saved file and an unconfigured online provider", async () => {
    const missing = await new SavedAnalysisProvider(null).analyze(request());
    expect(missing).toMatchObject({ ok: false, error: { code: "SAVED_ANALYSIS_RESULT_NOT_FOUND" } });

    const online = await onlineProvider().analyze(request());
    expect(online).toMatchObject({
      ok: false,
      mode: "online",
      error: { code: "ONLINE_PROVIDER_REQUIRES_SERVER_PROXY", fallback_allowed: true }
    });
  });

  it("never disguises online failure and labels an explicitly requested saved fallback", async () => {
    const noFallback = await analyzeWithExplicitSavedFallback({ primary: onlineProvider(), request: request() });
    expect(noFallback.result.ok).toBe(false);
    expect(noFallback.fallback).toMatchObject({ used: false, message: "Provider 失败；未执行静默回退。" });

    const explicitFallback = await analyzeWithExplicitSavedFallback({
      primary: onlineProvider(),
      request: request(),
      savedFallback: new SavedAnalysisProvider(response),
      allowFallback: true
    });
    expect(explicitFallback.result.ok).toBe(true);
    expect(explicitFallback.fallback).toMatchObject({
      used: true,
      reason_code: "ONLINE_PROVIDER_REQUIRES_SERVER_PROXY",
      message: "已明确切换至保存结果。"
    });
  });

  it("does not accept or persist API credentials in browser state or demo artifacts", async () => {
    const provider = onlineProvider();
    await provider.analyze(request());
    expect(Object.keys(provider.config).some((key) => /api.?key|authorization/i.test(key))).toBe(false);
    expect(window.localStorage.length).toBe(0);
    const publicArtifacts = JSON.stringify({ request: request(), response, config: provider.config });
    expect(publicArtifacts).not.toMatch(/api[_-]?key|authorization|bearer\s/i);
  });

  it("preserves the three snapshots, four conclusions, 15 notifications and relation stages", () => {
    expect(visualJson.snapshots).toHaveLength(3);
    expect(response.event_clusters).toHaveLength(4);
    expect(notificationsJson.notification_count).toBe(15);
    expect(new Set(visualJson.snapshots.flatMap((snapshot) => snapshot.events.flatMap((event) => [
      event.relation_stage,
      ...event.versions.map((version) => version.relation_stage)
    ])))).toEqual(
      new Set(["drifting", "lifting", "approaching", "stable_fusion", "cooling"])
    );
  });
});
