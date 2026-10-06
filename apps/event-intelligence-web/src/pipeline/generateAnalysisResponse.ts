import type { Impact } from "../types";
import type {
  AnalysisClaim,
  AnalysisEvent,
  AnalysisResponseArtifact,
  AnalysisVersion,
  ClusteringResult,
  CompanyImpactAnalysis,
  RelationType
} from "./types";

interface SourceAnalysisLike {
  source_id: string;
  event_id: string;
  claims: Array<{ text: string; type: string; verification: string }>;
  relation_to_previous: RelationType;
  relation_note?: string;
  impact: Record<string, Impact>;
  impact_basis: string;
  landing_status: string;
  status_basis: string;
  conclusion_delta: string;
}

interface EventLike {
  event_id: string;
  title: string;
  company_ids: string[];
  confirmation_status: string;
  execution_status: string;
  current_conclusion: string;
  source_ids?: string[];
  versions: Array<{
    version: number;
    label: string;
    confirmation_status: string;
    execution_status: string;
    occurred_at: string | null;
    occurred_at_note?: string;
    disclosed_at: string;
    analysis_updated_at: string;
    conclusion: string;
    change_from_previous?: string | null;
    source_ids: string[];
  }>;
}

function aggregateImpact(values: Impact[]): Impact {
  const meaningful = values.filter((value) => value !== "unclear");
  if (meaningful.length === 0) return "unclear";
  if (meaningful.includes("mixed") || (meaningful.includes("positive") && meaningful.includes("negative"))) return "mixed";
  return meaningful.every((value) => value === "positive") ? "positive" : meaningful.every((value) => value === "negative") ? "negative" : "mixed";
}

function claimsForSources(sourceIds: string[], sourceClaimIds: Map<string, string[]>): string[] {
  return [...new Set(sourceIds.flatMap((id) => sourceClaimIds.get(id) ?? []))];
}

function factors(direction: Impact, bases: string[]): Pick<CompanyImpactAnalysis, "positive_factors" | "negative_factors" | "uncertainties"> {
  const clean = [...new Set(bases.filter(Boolean))];
  if (direction === "positive") return { positive_factors: clean, negative_factors: [], uncertainties: [] };
  if (direction === "negative") return { positive_factors: [], negative_factors: clean, uncertainties: [] };
  if (direction === "mixed") return {
    positive_factors: clean.slice(0, 1),
    negative_factors: clean.slice(1, 2).length ? clean.slice(1, 2) : ["材料同时保留执行、定价或整合风险。"],
    uncertainties: ["正负因素并存，不能合并为单一方向。"]
  };
  return { positive_factors: [], negative_factors: [], uncertainties: clean.length ? clean : ["现有材料不足以确定影响方向。"] };
}

function companyImpact(
  companyId: string,
  analyses: SourceAnalysisLike[],
  sourceClaimIds: Map<string, string[]>
): CompanyImpactAnalysis {
  const values = analyses.map((item) => item.impact[companyId]).filter((value): value is Impact => value !== undefined);
  const direction = aggregateImpact(values);
  const sources = analyses.filter((item) => item.impact[companyId] !== undefined).map((item) => item.source_id);
  return {
    company_id: companyId,
    direction,
    ...factors(direction, analyses.map((item) => item.impact_basis)),
    confidence: direction === "unclear" ? 0.56 : direction === "mixed" ? 0.78 : 0.82,
    basis_claim_ids: claimsForSources(sources, sourceClaimIds),
    source_ids: [...new Set(sources)]
  };
}

export function generateAnalysisResponse(input: {
  runId: string;
  promptVersion: string;
  generatedAt: string;
  clustering: ClusteringResult;
  events: EventLike[];
  sourceAnalyses: SourceAnalysisLike[];
}): AnalysisResponseArtifact {
  const claims: AnalysisClaim[] = [];
  const sourceClaimIds = new Map<string, string[]>();
  input.sourceAnalyses.forEach((analysis) => {
    const ids = analysis.claims.map((claim, index) => {
      const claimId = `claim-${analysis.source_id}-${String(index + 1).padStart(2, "0")}`;
      claims.push({
        claim_id: claimId,
        text: claim.text,
        claim_type: claim.type as AnalysisClaim["claim_type"],
        source_ids: [analysis.source_id],
        basis_claim_ids: [],
        verification: claim.verification
      });
      return claimId;
    });
    sourceClaimIds.set(analysis.source_id, ids);
  });

  const eventClusters = input.clustering.clusters.map((cluster): AnalysisEvent => {
    const event = input.events.find((candidate) => candidate.event_id === cluster.event_id);
    if (!event) throw new Error(`Missing event ${cluster.event_id}`);
    const eventAnalyses = input.sourceAnalyses.filter((analysis) => cluster.source_ids.includes(analysis.source_id));
    const versions = event.versions.map((version, index): AnalysisVersion => {
      const versionAnalyses = eventAnalyses.filter((analysis) => version.source_ids.includes(analysis.source_id));
      const relation = index === 0 ? null : versionAnalyses.at(-1)?.relation_to_previous ?? "supplements";
      const result: AnalysisVersion = {
        version: version.version,
        label: version.label,
        confirmation_status: version.confirmation_status,
        execution_status: version.execution_status,
        occurred_at: version.occurred_at,
        disclosed_at: version.disclosed_at,
        analysis_updated_at: version.analysis_updated_at,
        conclusion: version.conclusion,
        relation_to_previous: relation,
        conclusion_delta: version.change_from_previous ?? versionAnalyses.at(-1)?.conclusion_delta ?? null,
        source_ids: version.source_ids,
        claim_ids: claimsForSources(version.source_ids, sourceClaimIds),
        impact_by_company: event.company_ids.map((companyId) => companyImpact(companyId, versionAnalyses, sourceClaimIds))
      };
      if (version.occurred_at_note !== undefined) result.occurred_at_note = version.occurred_at_note;
      return result;
    });
    const finalAnalysis = eventAnalyses.at(-1);
    return {
      cluster_id: cluster.cluster_id,
      event_id: event.event_id,
      event_title: event.title,
      company_ids: event.company_ids,
      current_conclusion: event.current_conclusion,
      confirmation_status: event.confirmation_status,
      execution_status: event.execution_status,
      relation_to_previous: finalAnalysis?.relation_to_previous ?? null,
      source_ids: cluster.source_ids,
      claim_ids: claimsForSources(cluster.source_ids, sourceClaimIds),
      versions,
      impact_by_company: event.company_ids.map((companyId) => companyImpact(companyId, eventAnalyses, sourceClaimIds)),
      confidence: cluster.confidence,
      conclusion_delta: finalAnalysis?.conclusion_delta ?? null,
      warnings: [
        "影响方向是基于材料的演示性判断，不是收益预测。",
        "市场反应仅表示披露附近观察，不能证明事件因果或已完全定价。"
      ]
    };
  });

  return {
    run_id: input.runId,
    prompt_version: input.promptVersion,
    model_name: "unknown",
    generated_at: input.generatedAt,
    event_clusters: eventClusters,
    claims,
    warnings: [
      "本响应由已封板材料整理为保存的AI分析运行产物，未调用在线模型。",
      "iFinD与扶摇在本次采集环境不可用。",
      "行情变化不证明事件因果，分析不构成投资建议。"
    ]
  };
}
