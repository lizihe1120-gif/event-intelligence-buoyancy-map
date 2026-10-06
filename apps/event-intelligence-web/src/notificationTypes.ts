import type { DetailTabId } from "./detailTypes";

export type ChangeRelation =
  | "supports"
  | "supplements"
  | "updates"
  | "denies"
  | "corrects"
  | "supersedes";

export type LifecycleChange = "completed" | "terminated" | "expired";
export type NotificationChangeType = ChangeRelation | LifecycleChange;
export type NotificationSeverity = "info" | "notable" | "important" | "critical";

export interface VersionChange {
  change_id: string;
  event_id: string;
  event_title: string;
  previous_version: number;
  current_version: number;
  current_version_label: string;
  relation: ChangeRelation;
  lifecycle_change: LifecycleChange | null;
  changed_at: string;
  previous_conclusion: string;
  current_conclusion: string;
  changed_fields: string[];
  confirmation_status_before: string;
  confirmation_status_after: string;
  execution_status_before: string;
  execution_status_after: string;
  affected_company_ids: string[];
  source_ids: string[];
  conclusion_delta: string;
  severity: NotificationSeverity;
}

export interface RealNotification {
  notification_id: string;
  change_id: string;
  event_id: string;
  event_title: string;
  current_version: number;
  title: string;
  summary: string;
  reason: string;
  meaning: string;
  change_types: NotificationChangeType[];
  severity: NotificationSeverity;
  changed_at: string;
  company_ids: string[];
  company_names: string[];
  previous_state: string;
  current_state: string;
  source_ids: string[];
  source_count: number;
  changed_fields: string[];
  target_tab: DetailTabId;
  is_rule_fixture: false;
}

export interface NotificationsArtifact {
  run_id: string;
  generated_at: string;
  derivation: "deterministic_adjacent_version_diff";
  change_count: number;
  notification_count: number;
  changes: VersionChange[];
  notifications: RealNotification[];
}

export interface RuleNotificationFixture {
  notification_id: string;
  title: string;
  summary: string;
  change_type: "denies" | "corrects" | "expired";
  severity: "critical";
  previous_state: string;
  current_state: string;
  source_ids: string[];
  source_description: string;
  changed_fields: string[];
  handling: string[];
  boundary: string;
  is_rule_fixture: true;
}

export interface NotificationCenterItem extends RealNotification {
  is_read: boolean;
}

export interface NotificationFilters {
  company_id: string;
  event_id: string;
  change_type: string;
  severity: string;
  unread_only: boolean;
}
