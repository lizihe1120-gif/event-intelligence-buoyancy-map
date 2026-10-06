import notificationsJson from "../../../data/demo-runs/material-analysis-001/notifications.json";

import type {
  NotificationCenterItem,
  NotificationChangeType,
  NotificationFilters,
  NotificationsArtifact,
  RealNotification
} from "./notificationTypes";

const artifact = notificationsJson as NotificationsArtifact;

export const NOTIFICATION_READ_STORAGE_KEY = "event-intelligence:notification-read:v1";

function datePart(value: string): string {
  return value.slice(0, 10);
}

export function allRealNotifications(): RealNotification[] {
  return artifact.notifications;
}

export function notificationsAt(snapshotDate: string): RealNotification[] {
  return artifact.notifications.filter((notification) => datePart(notification.changed_at) <= snapshotDate);
}

export function notificationItemsAt(snapshotDate: string, readIds: Set<string>): NotificationCenterItem[] {
  return notificationsAt(snapshotDate).map((notification) => ({
    ...notification,
    is_read: readIds.has(notification.notification_id)
  }));
}

export function applyNotificationFilters(
  notifications: NotificationCenterItem[],
  filters: NotificationFilters
): NotificationCenterItem[] {
  return notifications.filter((notification) => {
    if (filters.company_id && !notification.company_ids.includes(filters.company_id)) return false;
    if (filters.event_id && notification.event_id !== filters.event_id) return false;
    if (filters.change_type && !notification.change_types.includes(filters.change_type as NotificationChangeType)) return false;
    if (filters.severity && notification.severity !== filters.severity) return false;
    if (filters.unread_only && notification.is_read) return false;
    return true;
  });
}

export function unreadCountAt(snapshotDate: string, readIds: Set<string>): number {
  return notificationsAt(snapshotDate).filter((notification) => !readIds.has(notification.notification_id)).length;
}

export function parseReadNotificationIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return new Set();
    const validIds = new Set(artifact.notifications.map((notification) => notification.notification_id));
    return new Set(Object.entries(parsed)
      .filter(([id, value]) => validIds.has(id) && value === true)
      .map(([id]) => id));
  } catch {
    return new Set();
  }
}

export function loadReadNotificationIds(storage: Pick<Storage, "getItem"> = window.localStorage): Set<string> {
  return parseReadNotificationIds(storage.getItem(NOTIFICATION_READ_STORAGE_KEY));
}

export function saveReadNotificationIds(
  ids: Set<string>,
  storage: Pick<Storage, "setItem"> = window.localStorage
): void {
  const safeIds = [...ids]
    .filter((id) => artifact.notifications.some((notification) => notification.notification_id === id))
    .sort((left, right) => left.localeCompare(right));
  storage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(Object.fromEntries(safeIds.map((id) => [id, true]))));
}

export function clearReadNotificationIds(storage: Pick<Storage, "removeItem"> = window.localStorage): void {
  storage.removeItem(NOTIFICATION_READ_STORAGE_KEY);
}

export function notificationArtifactSummary(): { runId: string; changeCount: number; notificationCount: number } {
  return { runId: artifact.run_id, changeCount: artifact.change_count, notificationCount: artifact.notification_count };
}
