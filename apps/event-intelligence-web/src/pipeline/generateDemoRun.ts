import { describeProvider, OnlineAnalysisProvider, SavedAnalysisProvider } from "./analysisProvider";
import { buildAnalysisPrompt } from "./buildAnalysisPrompt";
import { buildVisualModel } from "./buildVisualModel";
import { buildNotificationsArtifact } from "./buildNotificationsArtifact";
import { clusterEvents } from "./clusterEvents";
import { deduplicateSources } from "./deduplicateSources";
import { generateAnalysisResponse } from "./generateAnalysisResponse";
import type { PipelineSource } from "./types";
import { validateAnalysisResponse } from "./validateAnalysisResponse";

const RUN_ID = "material-analysis-001";
const PROMPT_VERSION = "material-analysis-v1";
const STARTED_AT = "2026-10-05T16:18:00+08:00";
const COMPLETED_AT = "2026-10-05T16:28:01+08:00";

interface DatasetInput {
  companiesData: { companies: Array<{
    company_id: string;
    name: string;
    short_name?: string;
    ticker?: string;
    exchange?: string;
    aliases: string[];
    role_in_main_event?: string;
  }> };
  eventsData: { events: Array<any> };
  sourcesData: { sources: PipelineSource[]; [key: string]: unknown };
  analysisData: { source_analyses: Array<any>; [key: string]: unknown };
  marketData: Record<string, unknown>;
  toolCallsData: { availability: unknown[]; calls: unknown[]; [key: string]: unknown };
}

export async function generateDemoRun(input: DatasetInput) {
  const acquisitionOutput = {
    run_id: RUN_ID,
    acquisition_snapshot_id: "acquisition-001",
    mode: "saved_source_snapshot",
    captured_at: STARTED_AT,
    source_count: input.sourcesData.sources.length,
    sources: input.sourcesData.sources,
    tool_availability: input.toolCallsData.availability,
    tool_calls: input.toolCallsData.calls,
    limitations: [
      "本次未运行真实爬虫或外部采集Agent，18份来源复用封板材料快照。",
      "iFinD MCP和扶摇在原采集环境不可用，未编造成功调用。"
    ],
    elapsed_ms: 1
  };
  const deduplication = deduplicateSources(input.sourcesData.sources, RUN_ID);
  const clustering = clusterEvents(input.sourcesData.sources, input.eventsData.events, RUN_ID);
  const analysisRequest = buildAnalysisPrompt({
    runId: RUN_ID,
    promptVersion: PROMPT_VERSION,
    generatedAt: STARTED_AT,
    companies: input.companiesData.companies,
    sources: input.sourcesData.sources,
    deduplication,
    clustering
  });
  const preparedResponse = generateAnalysisResponse({
    runId: RUN_ID,
    promptVersion: PROMPT_VERSION,
    generatedAt: STARTED_AT,
    clustering,
    events: input.eventsData.events,
    sourceAnalyses: input.analysisData.source_analyses
  });
  const provider = new SavedAnalysisProvider(preparedResponse);
  const providerResult = await provider.analyze(analysisRequest);
  if (!providerResult.ok) {
    throw new Error(`Analysis provider failed: ${providerResult.error.code}`);
  }
  const analysisResponse = providerResult.response;
  const onlineProvider = new OnlineAnalysisProvider({
    provider: "unconfigured",
    base_url: "",
    model: "unknown",
    prompt_version: PROMPT_VERSION,
    request_format: "openai_compatible_json",
    timeout_ms: 30_000,
    server_proxy_url: null
  });
  const validation = validateAnalysisResponse({
    response: analysisResponse,
    runId: RUN_ID,
    validatedAt: COMPLETED_AT,
    companyIds: input.companiesData.companies.map((company) => company.company_id),
    eventIds: input.eventsData.events.map((event) => event.event_id),
    sourceIds: input.sourcesData.sources.map((source) => source.source_id)
  });
  const visualResult = buildVisualModel({
    response: analysisResponse,
    validation,
    generatedAt: COMPLETED_AT,
    sources: input.sourcesData.sources,
    companyIds: input.companiesData.companies.map((company) => company.company_id)
  });
  const notifications = buildNotificationsArtifact({
    runId: RUN_ID,
    generatedAt: COMPLETED_AT,
    events: input.eventsData.events,
    response: analysisResponse,
    companies: input.companiesData.companies,
    validSourceIds: input.sourcesData.sources.map((source) => source.source_id)
  });
  const run = {
    run_id: RUN_ID,
    acquisition_snapshot_id: "acquisition-001",
    started_at: STARTED_AT,
    completed_at: COMPLETED_AT,
    source_count: input.sourcesData.sources.length,
    canonical_evidence_count: deduplication.canonical_source_count,
    event_count: clustering.cluster_count,
    prompt_version: PROMPT_VERSION,
    model_name: "unknown",
    provider_mode: "saved_result",
    provider_runtime: describeProvider(provider),
    online_provider: describeProvider(onlineProvider),
    fallback: {
      used: false,
      from_provider_id: null,
      to_provider_id: null,
      reason_code: null,
      message: "默认直接使用保存结果，未发生 Provider 回退。"
    },
    status: validation.passed ? "completed" : "validation_failed",
    visual_result_applied: validation.passed,
    total_elapsed_ms: 21,
    stage_timings_ms: {
      acquisition_snapshot: acquisitionOutput.elapsed_ms,
      deduplication: deduplication.elapsed_ms,
      clustering: clustering.elapsed_ms,
      prompt_builder: analysisRequest.elapsed_ms,
      saved_analysis_provider: 5,
      validation: validation.elapsed_ms,
      visual_model: 3
    },
    limitations: [
      "来源采集使用已保存快照。",
      "AI结果是本次保存的分析运行产物，模型名称无法确认。",
      "未调用在线模型；未运行iFinD、扶摇、真实爬虫或外部Agent。",
      "行情变化不证明事件因果；分析不构成投资建议。"
    ]
  };
  return {
    "run.json": run,
    "acquisition-output.json": acquisitionOutput,
    "deduplication-result.json": deduplication,
    "clustering-result.json": clustering,
    "analysis-request.json": analysisRequest,
    "analysis-response.json": analysisResponse,
    "validation-result.json": validation,
    "visual-result.json": visualResult,
    "notifications.json": notifications
  };
}
