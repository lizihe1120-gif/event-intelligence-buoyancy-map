import { detectVersionChanges } from "../changeDetection";
import type { NotificationChangeType, NotificationsArtifact, RealNotification, VersionChange } from "../notificationTypes";
import type { EventRecord } from "../types";
import type { AnalysisResponseArtifact } from "./types";

interface NotificationCompany {
  company_id: string;
  name: string;
  short_name?: string;
}

const confirmationLabels: Record<string, string> = {
  rumor: "传闻", pending_confirmation: "待确认", partially_confirmed: "部分确认",
  confirmed: "已确认", denied: "已否认", corrected: "已更正"
};

const executionLabels: Record<string, string> = {
  not_started: "未开始", planning: "筹划中", pending_approval: "待审核",
  pending_execution: "待实施", implementing: "履行中", in_progress: "进行中",
  completed: "已完成", terminated: "已终止", expired: "已过期", unknown: "未知"
};

const impactLabels: Record<string, string> = {
  positive: "利多", negative: "利空", mixed: "混合", unclear: "暂不明确"
};

function stateLabel(confirmation: string, execution: string): string {
  return `确认：${confirmationLabels[confirmation] ?? confirmation}；执行：${executionLabels[execution] ?? execution}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function notificationTitle(change: VersionChange): string {
  if (change.lifecycle_change === "terminated") return `交易终止：${change.current_version_label}`;
  if (change.lifecycle_change === "expired") return `事项到期：${change.current_version_label}`;
  if (change.lifecycle_change === "completed") return `实施完成：${change.current_version_label}`;
  if (change.relation === "denies") return `正式否认：${change.current_version_label}`;
  if (change.relation === "corrects") return `正式更正：${change.current_version_label}`;
  if (change.relation === "updates") return `参数或进展更新：${change.current_version_label}`;
  if (change.relation === "supersedes") return `阶段推进：${change.current_version_label}`;
  if (change.relation === "supports") return `新增支持证据：${change.current_version_label}`;
  return `信息补充：${change.current_version_label}`;
}

function reasonForChange(change: VersionChange): string {
  if (change.relation === "corrects") return change.conclusion_delta;
  return change.conclusion_delta.replaceAll("更正为", "重新评估为").replaceAll("正式更正", "正式更新");
}

function meaningForChange(
  change: VersionChange,
  response: AnalysisResponseArtifact,
  companies: NotificationCompany[]
): string {
  const event = response.event_clusters.find((candidate) => candidate.event_id === change.event_id);
  const version = event?.versions.find((candidate) => candidate.version === change.current_version);
  if (!version) return "影响方向仍需按公司分别查看，不能由事件状态直接推导。";
  const statements = version.impact_by_company.map((impact) => {
    const company = companies.find((candidate) => candidate.company_id === impact.company_id);
    return `${company?.short_name ?? company?.name ?? impact.company_id}：${impactLabels[impact.direction] ?? impact.direction}`;
  });
  return statements.length > 0
    ? `本版本的逐公司判断为${statements.join("；")}。重要程度只表示需要关注，不代表收益方向。`
    : "当前版本没有足够材料形成逐公司方向，保持暂不明确。";
}

export function buildNotificationsArtifact(input: {
  runId: string;
  generatedAt: string;
  events: EventRecord[];
  response: AnalysisResponseArtifact;
  companies: NotificationCompany[];
  validSourceIds: string[];
}): NotificationsArtifact {
  const changes = detectVersionChanges(input.events, input.response);
  const validSourceIds = new Set(input.validSourceIds);
  const notifications: RealNotification[] = [];

  for (const change of changes) {
    const sourceIds = change.source_ids.filter((sourceId) => validSourceIds.has(sourceId));
    if (sourceIds.length === 0) continue;
    const changeTypes = unique([
      change.relation,
      ...(change.lifecycle_change ? [change.lifecycle_change] : [])
    ]) as NotificationChangeType[];

    notifications.push({
      notification_id: `ntf-${change.change_id}`,
      change_id: change.change_id,
      event_id: change.event_id,
      event_title: change.event_title,
      current_version: change.current_version,
      title: notificationTitle(change),
      summary: change.current_conclusion,
      reason: reasonForChange(change),
      meaning: meaningForChange(change, input.response, input.companies),
      change_types: changeTypes,
      severity: change.severity,
      changed_at: change.changed_at,
      company_ids: change.affected_company_ids,
      company_names: change.affected_company_ids.map((companyId) => {
        const company = input.companies.find((candidate) => candidate.company_id === companyId);
        return company?.short_name ?? company?.name ?? companyId;
      }),
      previous_state: stateLabel(change.confirmation_status_before, change.execution_status_before),
      current_state: stateLabel(change.confirmation_status_after, change.execution_status_after),
      source_ids: sourceIds,
      source_count: sourceIds.length,
      changed_fields: change.changed_fields,
      target_tab: "versions",
      is_rule_fixture: false
    });
  }

  notifications.sort((left, right) => {
    const dateOrder = right.changed_at.localeCompare(left.changed_at);
    if (dateOrder !== 0) return dateOrder;
    const versionOrder = right.current_version - left.current_version;
    return versionOrder !== 0 ? versionOrder : left.notification_id.localeCompare(right.notification_id);
  });

  return {
    run_id: input.runId,
    generated_at: input.generatedAt,
    derivation: "deterministic_adjacent_version_diff",
    change_count: changes.length,
    notification_count: notifications.length,
    changes,
    notifications
  };
}
