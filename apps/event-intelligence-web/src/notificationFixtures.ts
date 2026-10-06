import type { RuleNotificationFixture } from "./notificationTypes";

export const ruleNotificationFixtures: RuleNotificationFixture[] = [
  {
    notification_id: "rule-denies-001",
    title: "正式否认规则样例",
    summary: "假设公司正式公告否认此前市场传闻，确认状态将变为已否认；历史传闻仍保留在版本链中。",
    change_type: "denies",
    severity: "critical",
    previous_state: "确认：待确认；执行：未开始",
    current_state: "确认：已否认；执行：未开始",
    source_ids: ["fixture-source-formal-denial-001"],
    source_description: "规则样例中的公司正式否认公告编号；不属于真实来源库。",
    changed_fields: ["confirmation_status", "conclusion"],
    handling: [
      "保留被否认的原始结论和传播时间，不删除历史版本。",
      "记录由哪一份正式来源完成否认。",
      "原有逐公司影响进入重新评估，不自动反转为相反方向。"
    ],
    boundary: "规则演示样例，不属于中国船舶真实事件数据。",
    is_rule_fixture: true
  },
  {
    notification_id: "rule-corrects-001",
    title: "正式更正规则样例",
    summary: "假设正式更正公告将错误值100亿元更正为10亿元，系统同时保留错误值、正确值和更正来源。",
    change_type: "corrects",
    severity: "critical",
    previous_state: "披露数值：100亿元",
    current_state: "披露数值：10亿元",
    source_ids: ["fixture-source-formal-correction-001"],
    source_description: "规则样例中的正式更正公告编号；不属于真实来源库。",
    changed_fields: ["reported_value", "conclusion"],
    handling: [
      "只有来源明确使用更正或勘误语义时，才允许关系为 corrects。",
      "原始错误版本继续保留，不能静默覆盖。",
      "普通参数更新仍使用 updates，不能因为数值变化就称为错误更正。"
    ],
    boundary: "规则演示样例，不属于中国船舶真实事件数据。",
    is_rule_fixture: true
  },
  {
    notification_id: "rule-expired-001",
    title: "到期失效规则样例",
    summary: "假设一项有明确截止日的承诺在到期后不再有效，执行状态变为已过期，但历史履行过程仍然保留。",
    change_type: "expired",
    severity: "critical",
    previous_state: "执行：履行中；有效期至2030-12-31",
    current_state: "执行：已过期；到期日2030-12-31",
    source_ids: ["fixture-source-expiry-trigger-001"],
    source_description: "规则样例中的期限条款和到期触发记录；不属于真实来源库。",
    changed_fields: ["execution_status", "expiry_at"],
    handling: [
      "记录到期时间和触发依据。",
      "到期不等于从未发生，历史有效期内的事实仍保留。",
      "如果后续存在延期或新承诺，应建立新版本而不是改写旧版本。"
    ],
    boundary: "规则演示样例，不属于中国船舶真实事件数据。",
    is_rule_fixture: true
  }
];
