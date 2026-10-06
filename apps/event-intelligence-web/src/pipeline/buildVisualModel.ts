import type { Impact } from "../types";
import type {
  AnalysisResponseArtifact,
  RelationStage,
  ValidationResult,
  VisualCompanyMetrics,
  VisualEvent,
  VisualResultArtifact
} from "./types";

interface SourceLike { source_id: string; is_first_party: boolean }

function aggregateImpact(values: Impact[]): Impact {
  const meaningful = values.filter((value) => value !== "unclear");
  if (meaningful.length === 0) return "unclear";
  if (meaningful.includes("mixed") || (meaningful.includes("positive") && meaningful.includes("negative"))) return "mixed";
  return meaningful.every((value) => value === "positive") ? "positive" : meaningful.every((value) => value === "negative") ? "negative" : "mixed";
}

const snapshotDefinitions = [
  { snapshot_id: "planning-suspension", date: "2024-09-03" },
  { snapshot_id: "plan-resumption", date: "2024-09-19" },
  { snapshot_id: "implementation-complete", date: "2025-09-16" }
];

export function relationStage(confirmationStatus: string, executionStatus: string): RelationStage {
  if (["terminated", "expired"].includes(executionStatus)) return "cooling";
  if (confirmationStatus === "denied") return "cooling";
  if (executionStatus === "completed") return "stable_fusion";
  if (confirmationStatus === "confirmed") return "approaching";
  if (confirmationStatus === "partially_confirmed") return "lifting";
  return "drifting";
}

const reactionPriority: Record<string, number> = {
  not_checked: 0,
  not_observed: 1,
  no_obvious_reaction: 2,
  initial_reaction: 3,
  significant_reaction: 4,
  reaction_then_pullback: 5,
  indistinguishable_from_market: 2
};

function companyMetrics(
  companyId: string,
  snapshotDate: string,
  events: VisualEvent[],
  response: AnalysisResponseArtifact
): VisualCompanyMetrics {
  const relatedEvents = events.filter((event) => companyId in event.impact_by_company);
  const relatedAnalyses = response.event_clusters.filter((event) => event.company_ids.includes(companyId));
  const visibleVersions = relatedAnalyses.flatMap((event) =>
    event.versions.filter((version) => version.disclosed_at.slice(0, 10) <= snapshotDate)
  );
  const sourceCount = new Set(visibleVersions.flatMap((version) => version.source_ids)).size;
  const settledCount = relatedEvents.filter((event) => ["completed", "terminated", "expired"].includes(event.execution_status)).length;
  const attentionScore = Math.min(100, Math.round(
    34
    + relatedEvents.length * 9
    + Math.min(27, sourceCount * 2.4)
    + Math.min(22, visibleVersions.length * 1.7)
    + settledCount * 4
  ));
  const reaction = relatedEvents
    .map((event) => event.market_reaction_status)
    .sort((a, b) => (reactionPriority[b] ?? 0) - (reactionPriority[a] ?? 0))[0] ?? "not_checked";

  return {
    company_id: companyId,
    attention_score: attentionScore,
    bubble_size: Math.min(208, 182 + Math.round(attentionScore * 0.25)),
    vertical_lift: Math.max(2, Math.min(14, Math.round((attentionScore - 38) * 0.18))),
    market_reaction_status: reaction
  };
}

function evidenceLevel(sourceIds: string[], sources: SourceLike[]): "first_party" | "corroborated" | "reported" {
  const matching = sources.filter((source) => sourceIds.includes(source.source_id));
  if (matching.some((source) => source.is_first_party)) return "first_party";
  if (matching.length >= 2) return "corroborated";
  return "reported";
}

function reactionStatus(eventId: string, date: string): string {
  if (eventId !== "evt-main-cssc-csic-merger") return "not_checked";
  if (date < "2024-09-19") return "not_observed";
  if (date === "2024-09-19") return "initial_reaction";
  return "reaction_then_pullback";
}

export function buildVisualModel(input: {
  response: AnalysisResponseArtifact;
  validation: ValidationResult;
  generatedAt: string;
  sources: SourceLike[];
  companyIds: string[];
}): VisualResultArtifact {
  if (!input.validation.passed) throw new Error("Validation failed; visual model generation is blocked.");
  const snapshots = snapshotDefinitions.map((snapshot) => {
    const events = input.response.event_clusters.flatMap((event) => {
      const visible = event.versions.filter((version) => version.disclosed_at.slice(0, 10) <= snapshot.date);
      const latest = visible.at(-1);
      if (!latest) return [];
      const impactByCompany = Object.fromEntries(latest.impact_by_company.map((impact) => [impact.company_id, impact.direction]));
      const combined = aggregateImpact(Object.values(impactByCompany) as Impact[]);
      return [{
        event_id: event.event_id,
        impact: combined,
        impact_by_company: impactByCompany,
        confirmation_status: latest.confirmation_status,
        execution_status: latest.execution_status,
        relation_stage: relationStage(latest.confirmation_status, latest.execution_status),
        evidence_level: evidenceLevel(visible.flatMap((version) => version.source_ids), input.sources),
        market_reaction_status: reactionStatus(event.event_id, snapshot.date),
        bubble_size: Math.min(226, 158 + new Set(visible.flatMap((version) => version.source_ids)).size * 5 + visible.length * 3),
        versions: visible.map((version) => {
          const perCompany = Object.fromEntries(version.impact_by_company.map((impact) => [impact.company_id, impact.direction]));
          return {
            version: version.version,
            impact: aggregateImpact(Object.values(perCompany) as Impact[]),
            impact_by_company: perCompany,
            relation_stage: relationStage(version.confirmation_status, version.execution_status),
            evidence_level: evidenceLevel(version.source_ids, input.sources)
          };
        })
      }];
    });
    return {
      ...snapshot,
      companies: input.companyIds.map((companyId) => companyMetrics(companyId, snapshot.date, events, input.response)),
      events
    };
  });

  const companies = snapshots.at(-1)?.companies ?? [];

  return {
    run_id: input.response.run_id,
    generated_at: input.generatedAt,
    validation_run_passed: true,
    color_mapping: { positive: "red", negative: "green", mixed: "red_green", unclear: "silver" },
    relation_stage_mapping: {
      pending_confirmation: "drifting",
      partially_confirmed: "lifting",
      confirmed: "approaching",
      completed: "stable_fusion",
      terminated: "cooling",
      denied: "cooling",
      expired: "cooling"
    },
    companies,
    snapshots
  };
}
