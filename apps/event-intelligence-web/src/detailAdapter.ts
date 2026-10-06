import companiesJson from "../../../data/demo/companies.json";
import eventsJson from "../../../data/demo/events.json";
import marketJson from "../../../data/demo/market-reactions.json";
import sourcesJson from "../../../data/demo/sources.json";
import toolCallsJson from "../../../data/demo/tool-calls.json";
import analysisResponseJson from "../../../data/demo-runs/material-analysis-001/analysis-response.json";
import clusteringJson from "../../../data/demo-runs/material-analysis-001/clustering-result.json";
import deduplicationJson from "../../../data/demo-runs/material-analysis-001/deduplication-result.json";
import runJson from "../../../data/demo-runs/material-analysis-001/run.json";
import validationJson from "../../../data/demo-runs/material-analysis-001/validation-result.json";

import type { AnalysisEvent, AnalysisResponseArtifact } from "./pipeline/types";
import type {
  ClaimKind,
  DetailAiRecord,
  DetailClaim,
  DetailCompanyImpact,
  DetailConflict,
  DetailMarketModel,
  DetailMarketObservation,
  DetailSourceRef,
  DetailVersion,
  EvidenceGrade,
  EventDetailViewModel
} from "./detailTypes";
import type { CompanyRecord, EventRecord, EventVersionRecord, Impact, SnapshotDefinition } from "./types";

interface FullSource {
  source_id: string;
  source_type: string;
  source_name: string;
  title: string;
  url: string | null;
  document_id: string | null;
  publisher: string;
  published_at: string | null;
  fetched_at: string | null;
  is_first_party: boolean;
  is_reprint: boolean;
  original_source?: string;
  excerpt: string;
  company_ids: string[];
  event_ids: string[];
}

const companies = companiesJson.companies as CompanyRecord[];
const events = eventsJson.events as EventRecord[];
const sources = sourcesJson.sources as FullSource[];
const response = analysisResponseJson as AnalysisResponseArtifact;

const confirmationLabels: Record<string, string> = {
  rumor: "传闻", pending_confirmation: "待确认", partially_confirmed: "部分确认",
  confirmed: "已确认", denied: "已否认", corrected: "已更正"
};

const executionLabels: Record<string, string> = {
  not_started: "未开始", planning: "筹划中", pending_approval: "待审核",
  pending_execution: "待实施", implementing: "实施中", in_progress: "履行中",
  completed: "已完成", terminated: "已终止", expired: "已过期", unknown: "未知"
};

const impactLabels: Record<Impact, string> = {
  positive: "利多", negative: "利空", mixed: "混合", unclear: "暂不明确"
};

const claimLabels: Record<ClaimKind, string> = {
  fact: "已确认事实", opinion: "机构或专家观点", inference: "基于材料的推测", rumor: "尚未证实的传闻"
};

function datePart(value: string): string {
  return value.slice(0, 10);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function evidenceGrade(source: FullSource): { grade: EvidenceGrade; reason: string } {
  if (source.is_first_party) return { grade: "A", reason: "监管、交易所、公司公告或公司正式披露的直接证据。" };
  if (source.source_type === "news_and_market_rumor") return { grade: "D", reason: "市场传闻或无法确认最初传播者的早期线索。" };
  if (["research_view", "news_and_expert_view"].includes(source.source_type)) return { grade: "C", reason: "研报、专家观点或行业分析，不作为已经兑现的事实。" };
  if (["news_market_reaction", "historical_market_data"].includes(source.source_type)) return { grade: "B", reason: "可交叉验证的权威新闻或历史数据材料。" };
  return { grade: "B", reason: "来源可追溯，但不是监管、交易所或公司直接披露。" };
}

function maxGrade(sourcesToGrade: FullSource[]): EvidenceGrade {
  const rank: Record<EvidenceGrade, number> = { A: 4, B: 3, C: 2, D: 1 };
  return sourcesToGrade.map((source) => evidenceGrade(source).grade).sort((a, b) => rank[b] - rank[a])[0] ?? "D";
}

function sourceRelation(sourceId: string, event: AnalysisEvent): string {
  const version = [...event.versions].reverse().find((item) => item.source_ids.includes(sourceId));
  return version?.relation_to_previous ?? (event.source_ids.includes(sourceId) ? "supplements" : "未识别");
}

function toSource(source: FullSource, event: AnalysisEvent): DetailSourceRef {
  const grade = evidenceGrade(source);
  const record = deduplicationJson.source_records.find((item) => item.source_id === source.source_id);
  const claimIds = response.claims.filter((claim) => claim.source_ids.includes(source.source_id) && event.claim_ids.includes(claim.claim_id)).map((claim) => claim.claim_id);
  return {
    sourceId: source.source_id,
    title: source.title,
    publisher: source.publisher,
    sourceType: source.source_type,
    publishedAt: source.published_at,
    fetchedAt: source.fetched_at,
    url: source.url,
    documentId: source.document_id,
    isFirstParty: source.is_first_party,
    isReprint: source.is_reprint,
    originalSource: source.original_source ?? null,
    excerpt: source.excerpt,
    evidenceGrade: grade.grade,
    evidenceGradeReason: grade.reason,
    evidenceWeight: record?.evidence_weight ?? 1,
    weightNote: record?.evidence_weight === 0 ? "保留追溯，但不重复增加证据权重。" : "作为独立计权证据。",
    claimIds,
    relationToPrevious: sourceRelation(source.source_id, event)
  };
}

function rawVersionFor(event: EventRecord, versionNumber: number): EventVersionRecord | undefined {
  return event.versions.find((version) => version.version === versionNumber);
}

function toVersion(rawEvent: EventRecord, analysisEvent: AnalysisEvent, versionNumber: number): DetailVersion {
  const raw = rawVersionFor(rawEvent, versionNumber);
  const analysis = analysisEvent.versions.find((version) => version.version === versionNumber);
  if (!raw || !analysis) throw new Error(`Missing version ${rawEvent.event_id}/V${versionNumber}`);
  return {
    version: raw.version,
    label: raw.label,
    occurredAt: raw.occurred_at ?? "实际发生时间未知",
    disclosedAt: raw.disclosed_at,
    fetchedAt: raw.fetched_at,
    analysisUpdatedAt: raw.analysis_updated_at,
    confirmationStatus: analysis.confirmation_status,
    confirmationLabel: confirmationLabels[analysis.confirmation_status] ?? analysis.confirmation_status,
    executionStatus: analysis.execution_status,
    executionLabel: executionLabels[analysis.execution_status] ?? analysis.execution_status,
    conclusion: analysis.conclusion,
    conclusionDelta: raw.version === 1
      ? "起始版本，无上一版本可比较。"
      : (analysis.conclusion_delta ?? "补充证据，核心结论未发生结构性变化。"),
    relationToPrevious: analysis.relation_to_previous,
    sourceIds: analysis.source_ids,
    claimIds: analysis.claim_ids
  };
}

function claimApplicability(kind: ClaimKind, sourceIds: string[], visibleVersions: DetailVersion[]): { label: string; applies: boolean } {
  if (kind === "rumor") return { label: "仅适用于历史传闻阶段，不能倒写成早期已确认事实。", applies: false };
  if (kind === "opinion") return { label: "仍是观点，不作为已经兑现的经营事实。", applies: false };
  if (kind === "inference") return { label: "仍是基于材料的推测，不作为已确认事实。", applies: false };
  const lastIndex = Math.max(...sourceIds.flatMap((id) => visibleVersions.map((version, index) => version.sourceIds.includes(id) ? index : -1)));
  const changedLater = visibleVersions.slice(lastIndex + 1).some((version) => ["updates", "corrects", "denies", "supersedes"].includes(version.relationToPrevious ?? ""));
  return changedLater
    ? { label: "这是历史阶段的已确认事实，当前结论已被后续版本更新或替代。", applies: false }
    : { label: "仍适用于当前结论或作为当前结论的有效历史事实。", applies: true };
}

function toClaim(claim: AnalysisResponseArtifact["claims"][number], visibleSources: DetailSourceRef[], versions: DetailVersion[]): DetailClaim {
  const kind = claim.claim_type as ClaimKind;
  const gradeRank: Record<EvidenceGrade, number> = { A: 4, B: 3, C: 2, D: 1 };
  const grades = visibleSources.filter((source) => claim.source_ids.includes(source.sourceId)).map((source) => source.evidenceGrade).sort((a, b) => gradeRank[b] - gradeRank[a]);
  const applicability = claimApplicability(kind, claim.source_ids, versions);
  return {
    claimId: claim.claim_id,
    text: claim.text,
    kind,
    kindLabel: claimLabels[kind],
    verification: claim.verification,
    sourceIds: claim.source_ids,
    evidenceGrade: grades[0] ?? "D",
    applicability: applicability.label,
    appliesToCurrentConclusion: applicability.applies
  };
}

function derivedConflicts(eventId: string, versions: DetailVersion[], claims: DetailClaim[]): DetailConflict[] {
  const conflicts: DetailConflict[] = versions
    .filter((version) => ["updates", "denies", "corrects", "supersedes"].includes(version.relationToPrevious ?? ""))
    .map((version) => ({
      conflictId: `${eventId}-v${version.version}-${version.relationToPrevious}`,
      title: `V${version.version} ${version.label}`,
      description: version.conclusionDelta,
      resolution: version.conclusion,
      relation: version.relationToPrevious ?? "updates",
      sourceIds: version.sourceIds
    }));

  if (eventId === "evt-main-cssc-csic-merger") {
    conflicts.unshift({
      conflictId: `${eventId}-scope`,
      title: "集团战略重组不等于上市公司吸并",
      description: "早期材料只确认集团层面的战略重组筹划，不能倒推为当时已经决定由中国船舶吸收合并中国重工。",
      resolution: "直到2024年公司公告披露后，上市公司吸并方向才进入正式确认阶段。",
      relation: "scope_clarification",
      sourceIds: ["src-001", "src-003"]
    });
    if (claims.some((claim) => claim.kind === "opinion")) conflicts.push({
      conflictId: `${eventId}-opinion`,
      title: "协同预期不是已兑现经营事实",
      description: "专家和研报对订单、协同和央企整合的判断属于观点。",
      resolution: "页面保留为 opinion，不用于单独确认当前经营结果。",
      relation: "evidence_boundary",
      sourceIds: ["src-004", "src-005"]
    });
  }
  if (eventId === "evt-aux-power-diesel-acquisition") conflicts.push({
    conflictId: `${eventId}-terminated`,
    title: "真实推进后终止，不等于从未发生",
    description: "资产收购曾进入草案和申报阶段，后续材料终止并撤回申请。",
    resolution: "当前执行状态为已终止，同时保留此前真实推进的版本事实。",
    relation: "supersedes",
    sourceIds: ["src-013", "src-014"]
  });
  if (eventId === "evt-aux-cssc-noncompete-change") conflicts.push({
    conflictId: `${eventId}-scope`,
    title: "核心冲突处理不等于全部同业竞争完成",
    description: "主合并处理了中国船舶与中国重工之间的核心冲突，但其他集团资产和业务仍在承诺安排中。",
    resolution: "当前状态保持履行中，不能标记为全部完成。",
    relation: "scope_clarification",
    sourceIds: ["src-002", "src-015"]
  });
  return unique(conflicts.map((conflict) => JSON.stringify(conflict))).map((item) => JSON.parse(item) as DetailConflict);
}

function toImpact(impact: AnalysisEvent["impact_by_company"][number]): DetailCompanyImpact {
  const company = companies.find((item) => item.company_id === impact.company_id);
  return {
    companyId: impact.company_id,
    companyName: company?.short_name ?? impact.company_id,
    ticker: company ? `${company.ticker}.${company.exchange}` : "—",
    direction: impact.direction,
    directionLabel: impactLabels[impact.direction],
    confidence: impact.confidence,
    positiveFactors: impact.positive_factors,
    negativeFactors: impact.negative_factors,
    uncertainties: impact.uncertainties,
    basisClaimIds: impact.basis_claim_ids,
    sourceIds: impact.source_ids
  };
}

function priceSourceIds(companyId: string, observationId: string): string[] {
  const company = companies.find((item) => item.company_id === companyId);
  return unique((company?.trading_status_history ?? []).filter((entry) => entry.market_observation_id === observationId).flatMap((entry) => entry.price_source_ids ?? []));
}

function marketDataSourceNames(companyId: string): string[] {
  if (companyId === "cmp-csic") return marketJson.data_sources.slice(1).map((source) => source.name);
  return marketJson.data_sources.filter((source) => source.name.includes("Yahoo")).map((source) => source.name);
}

function marketFor(eventId: string, snapshotDate: string): DetailMarketModel {
  const available = eventId === marketJson.event_id;
  const observations: DetailMarketObservation[] = available ? marketJson.observations
    .filter((observation) => observation.after.date <= snapshotDate)
    .map((observation, index) => {
      const company = companies.find((item) => item.company_id === observation.company_id);
      return {
        observationId: observation.observation_id,
        companyId: observation.company_id,
        companyName: company?.short_name ?? observation.company_id,
        window: observation.window,
        beforeDate: observation.before.date,
        afterDate: observation.after.date,
        beforeClose: observation.before.close_cny,
        afterClose: observation.after.close_cny,
        returnPct: observation.calculated.return_pct,
        volumeRatio: "volume_ratio" in observation.calculated ? observation.calculated.volume_ratio ?? null : null,
        turnoverAmountRatio: "turnover_amount_ratio" in observation.calculated ? observation.calculated.turnover_amount_ratio ?? null : null,
        benchmarkReturnPct: observation.benchmark.return_pct ?? null,
        excessVsBenchmarkPp: observation.calculated.excess_vs_benchmark_pp ?? null,
        reactionLabel: observation.reaction_label,
        interpretation: observation.interpretation,
        priceSourceIds: priceSourceIds(observation.company_id, observation.observation_id),
        dataSourceNames: marketDataSourceNames(observation.company_id),
        rawFieldPath: `market-reactions.json#observations[${index}]`
      };
    }) : [];
  return {
    available,
    disclosureAnchor: available ? marketJson.disclosure_anchor : null,
    reactionStatus: available ? marketJson.market_reaction_status : "not_checked",
    statusNote: available ? marketJson.status_note : "当前材料未为该辅助事件建立独立市场反应观察。",
    frequency: available ? marketJson.frequency : "未检查",
    benchmarkName: available ? marketJson.benchmark.name : null,
    minuteDataStatus: available ? marketJson.minute_data_status : "unavailable",
    minuteDataNote: available ? marketJson.minute_data_note : "没有分钟行情，不生成5分钟、30分钟或1小时结论。",
    observations,
    formulae: available ? marketJson.formulae : {},
    limitations: available ? marketJson.limitations : ["当前材料未为该辅助事件建立独立行情窗口。"],
    fixedDisclaimer: "市场反应只表示披露时间附近观察到的变化，不证明该事件造成价格变化。"
  };
}

function aiRecord(event: AnalysisEvent, visibleSourceIds: string[]): DetailAiRecord {
  const calls = toolCallsJson.calls.filter((call) => call.source_ids.some((sourceId) => visibleSourceIds.includes(sourceId)));
  return {
    runId: response.run_id,
    promptVersion: response.prompt_version,
    currentMode: "保存结果",
    provider: runJson.provider_mode,
    providerId: runJson.provider_runtime.provider_id,
    providerName: runJson.provider_runtime.provider_name,
    modelName: response.model_name,
    analysisTime: response.generated_at,
    validationStatus: validationJson.passed ? "passed" : "failed",
    schemaValidation: validationJson.checks.json_schema_shape,
    referenceValidation: validationJson.checks.reference_integrity,
    businessValidation: Object.entries(validationJson.checks)
      .filter(([name]) => !["json_schema_shape", "reference_integrity"].includes(name))
      .every(([, status]) => status === "passed") ? "passed" : "failed",
    visualWriteAllowed: validationJson.passed && runJson.visual_result_applied,
    onlineProviderStatus: runJson.online_provider.capability.status,
    onlineProviderMessage: "在线模型接口已预留，本次演示使用保存并通过验证的 AI 分析结果。",
    fallbackStatus: runJson.fallback.message,
    validationChecks: Object.entries(validationJson.checks).map(([name, status]) => ({ name, status })),
    warnings: unique([...response.warnings, ...event.warnings, ...validationJson.warnings]),
    toolAvailability: toolCallsJson.availability.map((item) => ({ tool: item.tool, available: item.available, reason: "reason" in item ? item.reason ?? null : null })),
    relatedToolCalls: calls.map((call) => ({ callId: call.call_id, tool: call.tool, status: call.status, query: call.query, sourceIds: call.source_ids })),
    dataLimitations: unique([...marketJson.limitations, ...runJson.limitations])
  };
}

function visibleEventSources(analysisEvent: AnalysisEvent, snapshotDate: string, visibleVersionSourceIds: string[]): FullSource[] {
  const cluster = clusteringJson.clusters.find((item) => item.event_id === analysisEvent.event_id);
  const candidateIds = new Set([...(cluster?.source_ids ?? []), ...visibleVersionSourceIds]);
  return sources.filter((source) => candidateIds.has(source.source_id) && (source.published_at === null || datePart(source.published_at) <= snapshotDate));
}

export function buildEventDetailViewModel(eventId: string, snapshot: SnapshotDefinition): EventDetailViewModel {
  const rawEvent = events.find((event) => event.event_id === eventId);
  const analysisEvent = response.event_clusters.find((event) => event.event_id === eventId);
  if (!rawEvent || !analysisEvent) throw new Error(`Unknown event detail: ${eventId}`);
  const visibleAnalysisVersions = analysisEvent.versions.filter((version) => datePart(version.disclosed_at) <= snapshot.date);
  const versions = visibleAnalysisVersions.map((version) => toVersion(rawEvent, analysisEvent, version.version));
  const latest = visibleAnalysisVersions.at(-1);
  if (!latest) throw new Error(`Event ${eventId} is not visible at ${snapshot.date}`);
  const visibleSourceIdsFromVersions = unique(versions.flatMap((version) => version.sourceIds));
  const rawSources = visibleEventSources(analysisEvent, snapshot.date, visibleSourceIdsFromVersions);
  const detailSources = rawSources.map((source) => toSource(source, analysisEvent)).sort((left, right) => (left.publishedAt ?? "9999").localeCompare(right.publishedAt ?? "9999"));
  const visibleSourceIds = detailSources.map((source) => source.sourceId);
  const claims = response.claims
    .filter((claim) => claim.source_ids.some((sourceId) => visibleSourceIds.includes(sourceId)) && analysisEvent.claim_ids.includes(claim.claim_id))
    .map((claim) => toClaim(claim, detailSources, versions));
  const latestVersionImpact = latest.impact_by_company.length > 0 ? latest.impact_by_company : analysisEvent.impact_by_company;
  const earliestSource = detailSources[0] ?? null;
  const unknowns = unique([
    ...latestVersionImpact.flatMap((impact) => impact.uncertainties),
    ...(versions.some((version) => version.occurredAt === "实际发生时间未知") ? ["部分阶段的实际发生时间未知。"] : []),
    ...(marketFor(eventId, snapshot.date).observations.length === 0 ? ["当前快照没有可展示的独立市场反应观察。"] : []),
    ...rawEvent.current_conclusion.split("。").filter((sentence) => /尚无|未知|仍需|不能/.test(sentence)).map((sentence) => `${sentence}。`)
  ]);
  return {
    eventId,
    title: rawEvent.title,
    isMain: rawEvent.is_main_event,
    snapshotDate: snapshot.date,
    snapshotLabel: snapshot.label,
    currentConclusion: latest.conclusion,
    confirmationStatus: latest.confirmation_status,
    confirmationLabel: confirmationLabels[latest.confirmation_status] ?? latest.confirmation_status,
    executionStatus: latest.execution_status,
    executionLabel: executionLabels[latest.execution_status] ?? latest.execution_status,
    earliestSource,
    earliestSourceCaveat: earliestSource?.evidenceGrade === "D"
      ? "目前只能确认这是现有材料中最早可验证的来源，真正最初传播者仍然未知。"
      : "这里展示的是现有材料中最早可验证的来源，不等同于证明其为市场最初首发者。",
    companies: rawEvent.company_ids.map((companyId) => {
      const company = companies.find((item) => item.company_id === companyId);
      return { companyId, name: company?.short_name ?? companyId, ticker: company ? `${company.ticker}.${company.exchange}` : "—" };
    }),
    sourceCount: detailSources.length,
    weightedSourceCount: detailSources.filter((source) => source.evidenceWeight > 0).length,
    evidenceGrade: maxGrade(rawSources),
    latestConclusionDelta: latest.conclusion_delta ?? "当前版本补充证据，核心结论未发生结构性变化。",
    unknowns,
    versions,
    claims,
    sources: detailSources,
    conflicts: derivedConflicts(eventId, versions, claims),
    impacts: latestVersionImpact.map(toImpact),
    market: marketFor(eventId, snapshot.date),
    ai: aiRecord(analysisEvent, visibleSourceIds)
  };
}

export function availableDetailEventIds(snapshot: SnapshotDefinition): string[] {
  return events.filter((event) => event.versions.some((version) => datePart(version.disclosed_at) <= snapshot.date)).map((event) => event.event_id);
}
