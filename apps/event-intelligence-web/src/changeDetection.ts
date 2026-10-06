import type { AnalysisResponseArtifact, AnalysisVersion } from "./pipeline/types";
import type { EventRecord } from "./types";
import type { ChangeRelation, LifecycleChange, NotificationSeverity, VersionChange } from "./notificationTypes";

const supportedRelations = new Set<ChangeRelation>([
  "supports", "supplements", "updates", "denies", "corrects", "supersedes"
]);

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sameStrings(left: string[], right: string[]): boolean {
  return JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right));
}

function impactDirections(version: AnalysisVersion): Record<string, string> {
  return Object.fromEntries(version.impact_by_company
    .map((impact) => [impact.company_id, impact.direction] as const)
    .sort(([left], [right]) => left.localeCompare(right)));
}

function lifecycleChange(previous: AnalysisVersion, current: AnalysisVersion): LifecycleChange | null {
  if (previous.execution_status === current.execution_status) return null;
  if (["completed", "terminated", "expired"].includes(current.execution_status)) {
    return current.execution_status as LifecycleChange;
  }
  return null;
}

export function severityForChange(input: {
  relation: ChangeRelation;
  lifecycle: LifecycleChange | null;
  changedFields: string[];
}): NotificationSeverity {
  if (["denies", "corrects"].includes(input.relation) || ["terminated", "expired"].includes(input.lifecycle ?? "")) return "critical";
  if (input.lifecycle === "completed" || input.changedFields.includes("confirmation_status") || input.changedFields.includes("execution_status")) return "important";
  if (["updates", "supersedes"].includes(input.relation) || input.changedFields.includes("conclusion")) return "notable";
  return "info";
}

export function detectVersionChanges(
  events: EventRecord[],
  response: AnalysisResponseArtifact
): VersionChange[] {
  const changes: VersionChange[] = [];

  for (const analysisEvent of response.event_clusters) {
    const rawEvent = events.find((event) => event.event_id === analysisEvent.event_id);
    if (!rawEvent) continue;

    for (let index = 1; index < analysisEvent.versions.length; index += 1) {
      const previous = analysisEvent.versions[index - 1];
      const current = analysisEvent.versions[index];
      if (!previous || !current) continue;
      const rawCurrent = rawEvent.versions.find((version) => version.version === current.version);
      if (!rawCurrent) continue;

      const relation = current.relation_to_previous;
      if (relation === null || !supportedRelations.has(relation)) {
        throw new Error(`Unsupported relation for ${analysisEvent.event_id}/V${current.version}`);
      }

      const changedFields: string[] = [];
      if (previous.conclusion !== current.conclusion) changedFields.push("conclusion");
      if (previous.confirmation_status !== current.confirmation_status) changedFields.push("confirmation_status");
      if (previous.execution_status !== current.execution_status) changedFields.push("execution_status");
      if (!sameStrings(previous.source_ids, current.source_ids)) changedFields.push("source_ids");
      if (JSON.stringify(impactDirections(previous)) !== JSON.stringify(impactDirections(current))) changedFields.push("impact_by_company");

      const lifecycle = lifecycleChange(previous, current);
      const sourceIds = uniqueSorted([...rawCurrent.source_ids, ...current.source_ids]);
      const changeId = `chg-${analysisEvent.event_id}-v${previous.version}-v${current.version}`;

      changes.push({
        change_id: changeId,
        event_id: analysisEvent.event_id,
        event_title: rawEvent.title,
        previous_version: previous.version,
        current_version: current.version,
        current_version_label: current.label,
        relation,
        lifecycle_change: lifecycle,
        changed_at: rawCurrent.disclosed_at,
        previous_conclusion: previous.conclusion,
        current_conclusion: current.conclusion,
        changed_fields: changedFields,
        confirmation_status_before: previous.confirmation_status,
        confirmation_status_after: current.confirmation_status,
        execution_status_before: previous.execution_status,
        execution_status_after: current.execution_status,
        affected_company_ids: uniqueSorted(rawEvent.company_ids),
        source_ids: sourceIds,
        conclusion_delta: current.conclusion_delta ?? "新增材料补充了事件进展，历史版本仍保留。",
        severity: severityForChange({ relation, lifecycle, changedFields })
      });
    }
  }

  return changes.sort((left, right) => {
    const eventOrder = left.event_id.localeCompare(right.event_id);
    return eventOrder !== 0 ? eventOrder : left.current_version - right.current_version;
  });
}
