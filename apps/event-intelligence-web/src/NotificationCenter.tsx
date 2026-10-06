import { useEffect, useMemo, useRef, useState } from "react";

import { applyNotificationFilters } from "./notificationAdapter";
import { ruleNotificationFixtures } from "./notificationFixtures";
import type {
  NotificationCenterItem,
  NotificationFilters,
  RealNotification,
  RuleNotificationFixture
} from "./notificationTypes";

const relationLabels: Record<string, string> = {
  supports: "支持证据", supplements: "补充细节", updates: "更新", denies: "正式否认",
  corrects: "正式更正", supersedes: "整体替代", completed: "执行完成",
  terminated: "事项终止", expired: "到期"
};

const severityLabels: Record<string, string> = {
  info: "一般信息", notable: "值得关注", important: "重要变化", critical: "关键变化"
};

const initialFilters: NotificationFilters = {
  company_id: "", event_id: "", change_type: "", severity: "", unread_only: false
};

function formatDate(value: string): string {
  return value.replace("T", " ");
}

function RuleFixtureDetail({ fixture, onBack }: { fixture: RuleNotificationFixture; onBack: () => void }) {
  return (
    <section className="rule-fixture-detail" aria-label={`${fixture.title}说明`}>
      <button type="button" className="notification-back" onClick={onBack}>← 返回规则样例</button>
      <div className="fixture-boundary">{fixture.boundary}</div>
      <header>
        <div><span>{relationLabels[fixture.change_type]}</span><strong>{severityLabels[fixture.severity]}</strong></div>
        <h3>{fixture.title}</h3>
        <p>{fixture.summary}</p>
      </header>
      <div className="notification-state-change">
        <span>{fixture.previous_state}</span><b aria-hidden="true">→</b><strong>{fixture.current_state}</strong>
      </div>
      <article>
        <h4>触发来源</h4>
        <code>{fixture.source_ids.join("；")}</code>
        <p>{fixture.source_description}</p>
      </article>
      <article>
        <h4>系统处理规则</h4>
        <ul>{fixture.handling.map((item) => <li key={item}>{item}</li>)}</ul>
      </article>
      <small>变化字段：{fixture.changed_fields.join("、")}</small>
    </section>
  );
}

function RealNotificationCard({ item, onMarkRead, onOpen }: {
  item: NotificationCenterItem;
  onMarkRead: (notificationId: string) => void;
  onOpen: (notification: RealNotification) => void;
}) {
  return (
    <article className={`notification-card severity--${item.severity}${item.is_read ? " is-read" : " is-unread"}`}>
      <header>
        <div className="notification-card__badges">
          <span>真实事件</span>
          {item.change_types.map((type) => <span key={type}>{relationLabels[type] ?? type}</span>)}
          <strong>{severityLabels[item.severity]}</strong>
          {!item.is_read && <i>未读</i>}
        </div>
        <time>{formatDate(item.changed_at)}</time>
      </header>
      <h3>{item.title}</h3>
      <p className="notification-card__summary">{item.summary}</p>
      <dl>
        <div><dt>原来</dt><dd>{item.previous_state}</dd></div>
        <div><dt>现在</dt><dd>{item.current_state}</dd></div>
      </dl>
      <div className="notification-card__reason"><b>为什么变化</b><p>{item.reason}</p></div>
      <div className="notification-card__meaning"><b>对关注标的</b><p>{item.meaning}</p></div>
      <footer>
        <span>{item.company_names.join(" / ")}</span>
        <span>{item.source_count} 份触发来源</span>
        <div>
          {!item.is_read && <button type="button" onClick={() => onMarkRead(item.notification_id)}>标为已读</button>}
          <button type="button" className="notification-primary" onClick={() => onOpen(item)}>查看版本与依据</button>
        </div>
      </footer>
    </article>
  );
}

export function NotificationCenter({
  open,
  snapshotDate,
  snapshotLabel,
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onResetRead,
  onOpenNotification
}: {
  open: boolean;
  snapshotDate: string;
  snapshotLabel: string;
  notifications: NotificationCenterItem[];
  onClose: () => void;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: (notificationIds: string[]) => void;
  onResetRead: () => void;
  onOpenNotification: (notification: RealNotification) => void;
}) {
  const [section, setSection] = useState<"real" | "rules">("real");
  const [filters, setFilters] = useState<NotificationFilters>(initialFilters);
  const [selectedFixture, setSelectedFixture] = useState<RuleNotificationFixture | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => applyNotificationFilters(notifications, filters), [notifications, filters]);
  const companies = useMemo(() => {
    const entries = notifications.flatMap((notification) => notification.company_ids.map((id, index) => [id, notification.company_names[index] ?? id] as const));
    return [...new Map(entries).entries()].sort((left, right) => left[1].localeCompare(right[1], "zh-CN"));
  }, [notifications]);
  const events = useMemo(() => [...new Map(notifications.map((notification) => [notification.event_id, notification.event_title] as const)).entries()], [notifications]);

  const resetDemoState = () => {
    setFilters(initialFilters);
    setSection("real");
    setSelectedFixture(null);
    onResetRead();
  };

  useEffect(() => {
    if (!open) return;
    setSelectedFixture(null);
    window.setTimeout(() => closeRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedFixture) setSelectedFixture(null);
      else onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose, selectedFixture]);

  if (!open) return null;

  return (
    <div className="notification-shell">
      <aside id="notification-center" className="notification-center" role="dialog" aria-modal="false" aria-labelledby="notification-center-title">
        <header className="notification-center__header">
          <div><p>INTELLIGENCE UPDATES · {snapshotDate}</p><h2 id="notification-center-title">结论变化与站内通知</h2><small>{snapshotLabel}快照，只展示当时已经披露的变化</small></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭通知中心">×</button>
        </header>

        {selectedFixture ? <RuleFixtureDetail fixture={selectedFixture} onBack={() => setSelectedFixture(null)} /> : (
          <>
            <div className="notification-sections" role="tablist" aria-label="通知区域">
              <button type="button" role="tab" aria-selected={section === "real"} onClick={() => setSection("real")}>真实事件更新 <span>{notifications.length}</span></button>
              <button type="button" role="tab" aria-selected={section === "rules"} onClick={() => setSection("rules")}>状态规则样例 <span>{ruleNotificationFixtures.length}</span></button>
            </div>

            {section === "real" ? (
              <div className="notification-center__body">
                <section className="notification-controls" aria-label="通知筛选">
                  <label>公司<select aria-label="按公司筛选" value={filters.company_id} onChange={(event) => setFilters((current) => ({ ...current, company_id: event.target.value }))}><option value="">全部公司</option>{companies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
                  <label>事件<select aria-label="按事件筛选" value={filters.event_id} onChange={(event) => setFilters((current) => ({ ...current, event_id: event.target.value }))}><option value="">全部事件</option>{events.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
                  <label>变化<select aria-label="按变化类型筛选" value={filters.change_type} onChange={(event) => setFilters((current) => ({ ...current, change_type: event.target.value }))}><option value="">全部类型</option>{Object.entries(relationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label>程度<select aria-label="按重要程度筛选" value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}><option value="">全部程度</option>{Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="unread-toggle"><input type="checkbox" checked={filters.unread_only} onChange={(event) => setFilters((current) => ({ ...current, unread_only: event.target.checked }))} />只看未读</label>
                  <div className="notification-actions">
                    <button type="button" onClick={() => onMarkAllRead(filtered.map((item) => item.notification_id))} disabled={filtered.length === 0}>全部标记已读</button>
                    <button type="button" onClick={resetDemoState}>恢复初始演示状态</button>
                  </div>
                </section>
                <div className="notification-result-line"><span>{filtered.length} 条结果</span><small>按披露变化时间倒序；重要程度不代表利好或利空</small></div>
                <section className="notification-list" aria-label="真实事件通知">
                  {filtered.length > 0 ? filtered.map((item) => <RealNotificationCard key={item.notification_id} item={item} onMarkRead={onMarkRead} onOpen={onOpenNotification} />) : <p className="notification-empty">当前快照和筛选条件下没有通知。</p>}
                </section>
              </div>
            ) : (
              <div className="notification-center__body rule-fixture-list">
                <div className="fixture-boundary">规则演示样例，不属于中国船舶真实事件数据，不计入真实事件、来源或未读数量。</div>
                {ruleNotificationFixtures.map((fixture) => (
                  <article key={fixture.notification_id} className="rule-fixture-card">
                    <div><span>{relationLabels[fixture.change_type]}</span><strong>{severityLabels[fixture.severity]}</strong></div>
                    <h3>{fixture.title}</h3>
                    <p>{fixture.summary}</p>
                    <button type="button" onClick={() => setSelectedFixture(fixture)}>查看规则说明</button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        <footer className="notification-center__footer">站内演示通知 · 不发送邮件、短信或浏览器推送 · 不构成投资建议</footer>
      </aside>
    </div>
  );
}
