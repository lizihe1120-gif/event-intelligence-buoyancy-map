import type { AnalysisRequestArtifact, ClusteringResult, DeduplicationResult, PipelineSource } from "./types";

interface TargetCompany {
  company_id: string;
  name: string;
  short_name?: string;
  ticker?: string;
  exchange?: string;
  aliases: string[];
  role_in_main_event?: string;
}

const companyImpactSchema = {
  type: "object",
  additionalProperties: false,
  required: ["company_id", "direction", "positive_factors", "negative_factors", "uncertainties", "confidence", "basis_claim_ids", "source_ids"],
  properties: {
    company_id: { type: "string" }, direction: { enum: ["positive", "negative", "mixed", "unclear"] },
    positive_factors: { type: "array", items: { type: "string" } }, negative_factors: { type: "array", items: { type: "string" } },
    uncertainties: { type: "array", items: { type: "string" } }, confidence: { type: "number", minimum: 0, maximum: 1 },
    basis_claim_ids: { type: "array", items: { type: "string" } }, source_ids: { type: "array", items: { type: "string" } }
  }
};

const versionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "label", "confirmation_status", "execution_status", "occurred_at", "disclosed_at", "analysis_updated_at", "conclusion", "relation_to_previous", "conclusion_delta", "source_ids", "claim_ids", "impact_by_company"],
  properties: {
    version: { type: "number" }, label: { type: "string" },
    confirmation_status: { enum: ["rumor", "pending_confirmation", "partially_confirmed", "confirmed", "denied", "corrected"] },
    execution_status: { enum: ["not_started", "planning", "pending_approval", "pending_execution", "implementing", "in_progress", "completed", "terminated", "expired", "unknown"] },
    occurred_at: { anyOf: [{ type: "string" }, { type: "null" }] }, occurred_at_note: { type: "string" },
    disclosed_at: { type: "string" }, analysis_updated_at: { type: "string" }, conclusion: { type: "string" },
    relation_to_previous: { anyOf: [{ enum: ["supports", "supplements", "updates", "denies", "corrects", "supersedes"] }, { type: "null" }] },
    conclusion_delta: { anyOf: [{ type: "string" }, { type: "null" }] },
    source_ids: { type: "array", items: { type: "string" } }, claim_ids: { type: "array", items: { type: "string" } },
    impact_by_company: { type: "array", items: companyImpactSchema }
  }
};

export const analysisResponseSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["run_id", "prompt_version", "model_name", "generated_at", "event_clusters", "claims", "warnings"],
  properties: {
    run_id: { type: "string" },
    prompt_version: { type: "string" },
    model_name: { const: "unknown" },
    generated_at: { type: "string", format: "date-time" },
    warnings: { type: "array", items: { type: "string" } },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim_id", "text", "claim_type", "source_ids", "basis_claim_ids", "verification"],
        properties: {
          claim_id: { type: "string" }, text: { type: "string" },
          claim_type: { enum: ["fact", "opinion", "inference", "rumor"] },
          source_ids: { type: "array", items: { type: "string" }, minItems: 1 },
          basis_claim_ids: { type: "array", items: { type: "string" } }, verification: { type: "string" }
        }
      }
    },
    event_clusters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["cluster_id", "event_id", "event_title", "company_ids", "current_conclusion", "confirmation_status", "execution_status", "relation_to_previous", "source_ids", "claim_ids", "versions", "impact_by_company", "confidence", "conclusion_delta", "warnings"],
        properties: {
          cluster_id: { type: "string" }, event_id: { type: "string" }, event_title: { type: "string" },
          company_ids: { type: "array", items: { type: "string" } }, current_conclusion: { type: "string" },
          confirmation_status: { enum: ["rumor", "pending_confirmation", "partially_confirmed", "confirmed", "denied", "corrected"] },
          execution_status: { enum: ["not_started", "planning", "pending_approval", "pending_execution", "implementing", "in_progress", "completed", "terminated", "expired", "unknown"] },
          relation_to_previous: { anyOf: [{ enum: ["supports", "supplements", "updates", "denies", "corrects", "supersedes"] }, { type: "null" }] },
          source_ids: { type: "array", items: { type: "string" } }, claim_ids: { type: "array", items: { type: "string" } },
          versions: { type: "array", items: versionSchema }, impact_by_company: { type: "array", items: companyImpactSchema }, confidence: { type: "number", minimum: 0, maximum: 1 },
          conclusion_delta: { anyOf: [{ type: "string" }, { type: "null" }] }, warnings: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
};

export function buildAnalysisPrompt(input: {
  runId: string;
  promptVersion: string;
  generatedAt: string;
  companies: TargetCompany[];
  sources: PipelineSource[];
  deduplication: DeduplicationResult;
  clustering: ClusteringResult;
}): AnalysisRequestArtifact {
  const systemPrompt = [
    "你是中国上市公司事件情报分析器，只能基于输入来源生成严格JSON。",
    "逐项判断材料是否属于同一事件；区分fact、opinion、inference、rumor。",
    "关系只允许supports、supplements、updates、denies、corrects、supersedes。",
    "confirmation_status与execution_status必须独立；completed不表示市场已完全定价。",
    "对每个事件—公司分别输出positive、negative、mixed或unclear，以及正面、负面和不确定因素。",
    "必须引用输入中真实存在的source_id，不得生成股票价格、涨跌幅或不存在的来源。",
    "不得把观点或传闻当成事实，不得把停牌直接解释为利空。",
    "不得输出买入、卖出、目标价或收益预测；不得把披露附近的行情变化写成事件因果。",
    "不得决定A-D证据等级、转载计权或relation_stage；这些字段由确定性程序派生和校验。"
  ].join("\n");
  const targetCompanies = input.companies.map(({ company_id, name, short_name, ticker, exchange, aliases, role_in_main_event }) => ({
    company_id, name, short_name, ticker, exchange, aliases, role_in_main_event
  }));
  const compactSources = input.sources.map(({ source_id, source_type, title, publisher, published_at, is_first_party, is_reprint, original_source, company_ids, event_ids, excerpt }) => ({
    source_id, source_type, title, publisher, published_at, is_first_party, is_reprint, original_source, company_ids, event_ids, excerpt
  }));
  const userPrompt = JSON.stringify({
    task: "从保存的来源快照生成事件簇、主张、版本、双状态和逐公司影响判断。",
    run_id: input.runId,
    prompt_version: input.promptVersion,
    target_companies: targetCompanies,
    company_relationships: targetCompanies.map(({ company_id, role_in_main_event }) => ({ company_id, role_in_main_event })),
    deduplicated_sources: compactSources,
    deduplication_context: {
      exact_duplicate_groups: input.deduplication.exact_duplicate_groups,
      near_duplicate_groups: input.deduplication.near_duplicate_groups,
      rule: "折叠来源仍须可追溯；同一公告镜像和转载不得重复增加证据权重。"
    },
    evidence_weights: input.deduplication.source_records,
    candidate_clusters: input.clustering.clusters,
    allowed_enums: {
      claim_type: ["fact", "opinion", "inference", "rumor"],
      relation_to_previous: ["supports", "supplements", "updates", "denies", "corrects", "supersedes"],
      confirmation_status: ["rumor", "pending_confirmation", "partially_confirmed", "confirmed", "denied", "corrected"],
      execution_status: ["not_started", "planning", "pending_approval", "pending_execution", "implementing", "in_progress", "completed", "terminated", "expired", "unknown"],
      impact: ["positive", "negative", "mixed", "unclear"]
    },
    citation_requirement: "每条主张、事件版本和逐公司影响必须引用输入中存在的source_id；逐公司影响还必须引用可解析的basis_claim_ids。",
    deterministic_program_responsibilities: ["A-D证据等级", "转载与镜像计权", "状态合法性", "引用完整性", "relation_stage", "行情计算"],
    output_constraint: "仅返回符合response_schema的JSON，不要Markdown，不要新增行情字段。"
  }, null, 2);
  return {
    run_id: input.runId,
    prompt_version: input.promptVersion,
    model_name: "unknown",
    provider_mode: "saved_result",
    system_prompt: systemPrompt,
    user_prompt: userPrompt,
    response_schema: analysisResponseSchema,
    created_at: input.generatedAt,
    elapsed_ms: 2
  };
}
