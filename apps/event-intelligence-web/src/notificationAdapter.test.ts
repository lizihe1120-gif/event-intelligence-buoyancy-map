import { describe, expect, it } from "vitest";
import sourcesJson from "../../../data/demo/sources.json";

import {
  allRealNotifications,
  applyNotificationFilters,
  notificationItemsAt,
  notificationsAt,
  parseReadNotificationIds
} from "./notificationAdapter";
import { ruleNotificationFixtures } from "./notificationFixtures";

describe("notification adapter", () => {
  it("keeps notification IDs stable, unique and free of rule fixtures", () => {
    const notifications = allRealNotifications();
    expect(notifications).toHaveLength(15);
    expect(new Set(notifications.map((item) => item.notification_id)).size).toBe(15);
    expect(notifications.every((item) => item.is_rule_fixture === false)).toBe(true);
    expect(notifications.some((item) => item.change_types.includes("denies") || item.change_types.includes("corrects") || item.change_types.includes("expired"))).toBe(false);
    expect(JSON.stringify(notifications)).not.toContain("正式更正");
  });

  it("hides future notifications from historical snapshots", () => {
    const planning = notificationsAt("2024-09-03");
    const resumption = notificationsAt("2024-09-19");
    const final = notificationsAt("2025-09-16");
    expect(planning).toHaveLength(3);
    expect(resumption).toHaveLength(4);
    expect(final).toHaveLength(15);
    expect(planning.every((item) => item.changed_at.slice(0, 10) <= "2024-09-03")).toBe(true);
    expect(resumption.some((item) => item.title.includes("监管注册"))).toBe(false);
    expect(resumption.some((item) => item.title.includes("终止上市"))).toBe(false);
  });

  it("filters by company, event, relation, severity and unread state", () => {
    const unrelatedReadId = allRealNotifications().find((notification) => notification.event_id !== "evt-aux-power-diesel-acquisition")?.notification_id;
    const items = notificationItemsAt("2025-09-16", new Set(unrelatedReadId ? [unrelatedReadId] : []));
    const filtered = applyNotificationFilters(items, {
      company_id: "cmp-power",
      event_id: "evt-aux-power-diesel-acquisition",
      change_type: "terminated",
      severity: "critical",
      unread_only: true
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.current_version).toBe(7);
  });

  it("stores only known notification IDs with a true read flag", () => {
    const known = allRealNotifications()[0]!.notification_id;
    const parsed = parseReadNotificationIds(JSON.stringify({ [known]: true, unknown: true, injected: "source text" }));
    expect([...parsed]).toEqual([known]);
  });

  it("isolates denies, corrects and expired fixtures from real data", () => {
    expect(ruleNotificationFixtures.map((fixture) => fixture.change_type)).toEqual(["denies", "corrects", "expired"]);
    expect(ruleNotificationFixtures.every((fixture) => fixture.boundary === "规则演示样例，不属于中国船舶真实事件数据。")).toBe(true);
    expect(ruleNotificationFixtures.every((fixture) => fixture.is_rule_fixture)).toBe(true);
  });

  it("contains no trading advice or return prediction language", () => {
    const text = JSON.stringify([...allRealNotifications(), ...ruleNotificationFixtures]);
    expect(text).not.toMatch(/建议买入|建议卖出|目标价|收益预测/);
  });

  it("keeps every real notification traceable to existing sources", () => {
    const sourceIds = new Set(sourcesJson.sources.map((source) => source.source_id));
    expect(allRealNotifications().every((notification) => notification.source_ids.length > 0 && notification.source_ids.every((sourceId) => sourceIds.has(sourceId)))).toBe(true);
  });
});
