import type { Impact } from "../types";

export type ClaimType = "fact" | "opinion" | "inference" | "rumor";
export type RelationType = "supports" | "supplements" | "updates" | "denies" | "corrects" | "supersedes";
export type RelationStage = "drifting" | "lifting" | "approaching" | "stable_fusion" | "cooling";

export interface PipelineSource {
  source_id: string;
  source_type: string;
  source_name?: string;
  title: string;
  url: string | null;
  document_id: string | null;
  publisher: string;
  published_at: string | null;
  fetched_at?: string;
  is_first_party: boolean;
  is_reprint: boolean;
  original_source?: string;
  excerpt?: string;
  company_ids: string[];
  event_ids: string[];
}

export interface DeduplicationResult {
  run_id: string;
  source_count: number;
  canonical_source_count: number;
  exact_duplicate_groups: Array<{
    group_id: string;
    canonical_source_id: string;
    source_ids: string[];
    matched_by: string[];
  }>;
  near_duplicate_groups: Array<{
    group_id: string;
    canonical_source_id: string;
    source_ids: string[];
    title_similarity: number;
    text_similarity: number;
    time_distance_hours: number | null;
    reason: string;
  }>;
  source_records: Array<{
    source_id: string;
    canonical_source_id: string;
    normalized_url: string | null;
    content_hash: string;
    evidence_weight: number;
    fold_reason: "canonical" | "exact_duplicate" | "reprint_or_mirror";
    traceable: true;
  }>;
  rules: Record<string, unknown>;
  elapsed_ms: number;
}

export interface EventCluster {
  cluster_id: string;
  event_id: string;
  event_title: string;
  source_ids: string[];
  company_ids: string[];
  clustering_reasons: string[];
  confidence: number;
  diagnostics: {
    cohesion: number;
    structured_link_coverage: number;
  };
}

export interface ClusteringResult {
  run_id: string;
  cluster_count: number;
  assignment_method: string;
  clusters: EventCluster[];
  silhouette_coefficient: {
    value: number | null;
    method: string;
    role: "diagnostic_only";
    used_for_deduplication: false;
    used_for_cluster_assignment: false;
    selected_k_by_metric: false;
    limitation: string;
  };
  elapsed_ms: number;
}

export interface AnalysisRequestArtifact {
  run_id: string;
  prompt_version: string;
  model_name: "unknown";
  provider_mode: "saved_result";
  system_prompt: string;
  user_prompt: string;
  response_schema: Record<string, unknown>;
  created_at: string;
  elapsed_ms: number;
}

export interface AnalysisClaim {
  claim_id: string;
  text: string;
  claim_type: ClaimType;
  source_ids: string[];
  basis_claim_ids: string[];
  verification: string;
}

export interface CompanyImpactAnalysis {
  company_id: string;
  direction: Impact;
  positive_factors: string[];
  negative_factors: string[];
  uncertainties: string[];
  confidence: number;
  basis_claim_ids: string[];
  source_ids: string[];
}

export interface AnalysisVersion {
  version: number;
  label: string;
  confirmation_status: string;
  execution_status: string;
  occurred_at: string | null;
  occurred_at_note?: string;
  disclosed_at: string;
  analysis_updated_at: string;
  conclusion: string;
  relation_to_previous: RelationType | null;
  conclusion_delta: string | null;
  source_ids: string[];
  claim_ids: string[];
  impact_by_company: CompanyImpactAnalysis[];
}

export interface AnalysisEvent {
  cluster_id: string;
  event_id: string;
  event_title: string;
  company_ids: string[];
  current_conclusion: string;
  confirmation_status: string;
  execution_status: string;
  relation_to_previous: RelationType | null;
  source_ids: string[];
  claim_ids: string[];
  versions: AnalysisVersion[];
  impact_by_company: CompanyImpactAnalysis[];
  confidence: number;
  conclusion_delta: string | null;
  warnings: string[];
}

export interface AnalysisResponseArtifact {
  run_id: string;
  prompt_version: string;
  model_name: "unknown";
  generated_at: string;
  event_clusters: AnalysisEvent[];
  claims: AnalysisClaim[];
  warnings: string[];
}

export interface ValidationResult {
  run_id: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  validated_at: string;
  rejected_fields: string[];
  applicable_event_count: number;
  checks: Record<string, "passed" | "failed">;
  elapsed_ms: number;
}

export interface VisualVersion {
  version: number;
  impact: Impact;
  impact_by_company: Record<string, Impact>;
  relation_stage: RelationStage;
  evidence_level: "first_party" | "corroborated" | "reported";
}

export interface VisualEvent {
  event_id: string;
  impact: Impact;
  impact_by_company: Record<string, Impact>;
  confirmation_status: string;
  execution_status: string;
  relation_stage: RelationStage;
  evidence_level: "first_party" | "corroborated" | "reported";
  market_reaction_status: string;
  bubble_size: number;
  versions: VisualVersion[];
}

export interface VisualCompanyMetrics {
  company_id: string;
  attention_score: number;
  bubble_size: number;
  vertical_lift: number;
  market_reaction_status: string;
}

export interface VisualSnapshot {
  snapshot_id: string;
  date: string;
  companies: VisualCompanyMetrics[];
  events: VisualEvent[];
}

export interface VisualResultArtifact {
  run_id: string;
  generated_at: string;
  validation_run_passed: true;
  color_mapping: Record<Impact, string>;
  relation_stage_mapping: Record<string, RelationStage>;
  companies: VisualCompanyMetrics[];
  snapshots: VisualSnapshot[];
}
