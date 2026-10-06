import { useEffect, useMemo, useRef, useState } from "react";

import { buildPageViewModel, snapshots, type SnapshotId } from "./dataAdapter";
import { buildEventDetailViewModel } from "./detailAdapter";
import { companyPoint, eventPoint, versionBubbleSize, versionPoint, type Point } from "./layout";
import { AnalysisProcessPanel } from "./AnalysisProcessPanel";
import { EventDetailDrawer } from "./EventDetailDrawer";
import { NotificationCenter } from "./NotificationCenter";
import { RelationLayer } from "./RelationLayer";
import {
  clearReadNotificationIds,
  loadReadNotificationIds,
  notificationItemsAt,
  saveReadNotificationIds,
  unreadCountAt
} from "./notificationAdapter";
import type { DetailTabId } from "./detailTypes";
import type { RealNotification } from "./notificationTypes";
import type { CompanyViewModel, EventViewModel, Impact, PageViewModel, VersionViewModel } from "./types";

type ActiveNode =
  | { kind: "company"; id: string }
  | { kind: "event"; id: string }
  | { kind: "version"; id: string; eventId: string };

function useReducedMotion(): boolean {
  const forced = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("motion") === "reduce";
  const [reduced, setReduced] = useState(() => forced || (
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));

  useEffect(() => {
    if (forced || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, [forced]);

  return reduced;
}

interface NodeInteractionProps {
  dimmed: boolean;
  highlighted: boolean;
  onHover: (node: ActiveNode | null) => void;
  onFocus: (node: ActiveNode | null) => void;
  onActivate?: (node: ActiveNode, trigger: HTMLElement) => void;
}

const impactLabels: Record<Impact, string> = {
  positive: "利好 / 正向",
  negative: "利空 / 负向",
  mixed: "混合影响",
  unclear: "暂不明确"
};

const confirmationLabels: Record<string, string> = {
  rumor: "传闻",
  pending_confirmation: "待确认",
  partially_confirmed: "部分确认",
  confirmed: "已确认",
  denied: "已否认"
};

const executionLabels: Record<string, string> = {
  not_started: "未开始",
  planning: "筹划中",
  pending_approval: "待审核",
  pending_execution: "待实施",
  implementing: "履行中",
  in_progress: "进行中",
  completed: "已完成",
  terminated: "已终止",
  expired: "已过期",
  unknown: "未知"
};

function interactionClass(dimmed: boolean, highlighted: boolean): string {
  if (highlighted) return " is-highlighted";
  if (dimmed) return " is-dimmed";
  return "";
}

function CompanyNode({
  company,
  dimmed,
  highlighted,
  onHover,
  onFocus
}: { company: CompanyViewModel } & NodeInteractionProps) {
  const point = companyPoint(company);
  if (!point) return null;
  const activeNode: ActiveNode = { kind: "company", id: company.id };

  return (
    <foreignObject
      x={point.x - company.size / 2}
      y={point.y - company.size / 2}
      width={company.size}
      height={company.size}
      className={`node-frame${interactionClass(dimmed, highlighted)}`}
    >
      <article
        className={`company-bubble company-bubble--${company.status} market-reaction--${company.marketReactionStatus}`}
        aria-label={`${company.name}，${company.statusLabel}`}
        data-node-id={company.id}
        data-attention-score={company.attentionScore}
        data-vertical-lift={company.verticalLift}
        tabIndex={0}
        onMouseEnter={() => onHover(activeNode)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onFocus(activeNode)}
        onBlur={() => onFocus(null)}
      >
        <span className="company-bubble__status">{company.statusLabel}</span>
        <h2>{company.name}</h2>
        <p className="company-bubble__ticker">{company.ticker}.{company.exchange}</p>
        <div className="company-bubble__price">
          <span>{company.priceLabel}</span>
          <strong>{company.price}</strong>
        </div>
        <p className="company-bubble__date">{company.priceDateLabel}</p>
        {company.marketObservation && (
          <span className={`market-observation market-observation--${company.marketDirection ?? "flat"}`}>
            {company.marketObservation}
          </span>
        )}
        <p className="company-bubble__role">{company.role}</p>
        <span className="company-bubble__sources">{company.sourceCount} 份已披露材料</span>
      </article>
    </foreignObject>
  );
}

function EventNode({
  event,
  dimmed,
  highlighted,
  onHover,
  onFocus,
  onActivate
}: { event: EventViewModel } & NodeInteractionProps) {
  const point = eventPoint(event);
  if (!point) return null;
  const activeNode: ActiveNode = { kind: "event", id: event.id };

  return (
    <foreignObject
      x={point.x - event.size / 2}
      y={point.y - event.size / 2}
      width={event.size}
      height={event.size}
      className={`node-frame${interactionClass(dimmed, highlighted)}`}
    >
      <article
        className={`event-bubble impact--${event.impact} relation--${event.relationStage}${event.isMain ? " event-bubble--main" : ""}${event.needsAttention ? " event-bubble--attention" : ""}`}
        aria-label={`${event.title}，${event.confirmationLabel}，${event.executionLabel}`}
        data-node-id={event.id}
        tabIndex={0}
        onMouseEnter={() => onHover(activeNode)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onFocus(activeNode)}
        onBlur={() => onFocus(null)}
        onClick={(event) => onActivate?.(activeNode, event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate?.(activeNode, event.currentTarget);
          }
        }}
      >
        <span className="event-bubble__eyebrow">{event.isMain ? "主事件" : "辅助事件"}</span>
        <h3>{event.title}</h3>
        <div className="event-bubble__statuses">
          <span>{event.confirmationLabel}</span>
          <i aria-hidden="true" />
          <span>{event.executionLabel}</span>
        </div>
        <p>{event.conclusion}</p>
        <span className="event-bubble__sources">{event.sourceCount} 份已披露来源</span>
      </article>
    </foreignObject>
  );
}

function VersionNode({
  version,
  eventId,
  point,
  dimmed,
  highlighted,
  onHover,
  onFocus,
  onActivate
}: { version: VersionViewModel; eventId: string; point: Point } & NodeInteractionProps) {
  const size = versionBubbleSize(version.relationStage);
  const activeNode: ActiveNode = { kind: "version", id: version.id, eventId };

  return (
    <foreignObject
      x={point.x - size / 2}
      y={point.y - size / 2}
      width={size}
      height={size}
      className={`node-frame${interactionClass(dimmed, highlighted)}`}
    >
      <article
        className={`version-bubble impact--${version.impact} relation--${version.relationStage}${version.isConfirmed ? " version-bubble--confirmed" : " version-bubble--open"}`}
        title={`${version.label} · ${version.timeLabel}`}
        aria-label={`版本${version.version}，${version.label}，${version.timeLabel}`}
        data-node-id={version.id}
        tabIndex={0}
        onMouseEnter={() => onHover(activeNode)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onFocus(activeNode)}
        onBlur={() => onFocus(null)}
        onClick={(event) => onActivate?.(activeNode, event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate?.(activeNode, event.currentTarget);
          }
        }}
      >
        <strong>V{version.version}</strong>
        <span>{version.label}</span>
        <small>{version.timeLabel === "实际发生时间未知" ? "时间未知" : `${version.sourceCount}证据`}</small>
      </article>
    </foreignObject>
  );
}

function LegendItem({ className, title, detail }: { className: string; title: string; detail: string }) {
  return (
    <li>
      <span className={`legend-mark ${className}`} aria-hidden="true" />
      <div><strong>{title}</strong><small>{detail}</small></div>
    </li>
  );
}

function Legend() {
  return (
    <aside className="legend-panel" aria-label="事件浮力图图例">
      <div className="legend-panel__header">
        <span>VISUAL KEY</span>
        <strong>图例</strong>
      </div>
      <ul>
        <LegendItem className="legend-mark--positive" title="红色 · 利好" detail="影响方向，不是交易状态" />
        <LegendItem className="legend-mark--negative" title="绿色 · 利空" detail="影响方向，不证明因果" />
        <LegendItem className="legend-mark--mixed" title="红绿双色 · 混合" detail="正负影响同时存在" />
        <LegendItem className="legend-mark--unclear" title="银白 · 暂不明确" detail="不强制判断方向" />
        <LegendItem className="legend-mark--normal" title="玻璃主体 · 正常交易" detail="材料价不是实时行情" />
        <LegendItem className="legend-mark--suspended" title="浅灰主体 · 停牌" detail="只表示当前不可交易" />
        <LegendItem className="legend-mark--delisted" title="深灰空心 · 终止上市" detail="与普通停牌严格区分" />
        <LegendItem className="legend-mark--attention" title="高亮边框 · 待推进" detail="待确认 / 待执行 / 待观察" />
      </ul>
      <div className="legend-panel__stages" aria-label="关系阶段图例">
        <strong>关系阶段</strong>
        <div><i className="stage-mark stage-mark--drifting" /><span>游离</span></div>
        <div><i className="stage-mark stage-mark--lifting" /><span>托举</span></div>
        <div><i className="stage-mark stage-mark--approaching" /><span>靠近</span></div>
        <div><i className="stage-mark stage-mark--stable_fusion" /><span>稳定融合</span></div>
        <div><i className="stage-mark stage-mark--cooling" /><span>冷却 / 断开</span></div>
      </div>
      <div className="legend-panel__rule">
        <span className="legend-size legend-size--large" />
        <span className="legend-size legend-size--small" />
        <p><strong>大小 = 活跃度 / 关注度</strong><br />不代表预测收益</p>
      </div>
    </aside>
  );
}

function Inspector({ active, page }: { active: ActiveNode | null; page: PageViewModel }) {
  if (!active) return null;

  if (active.kind === "company") {
    const company = page.companies.find((candidate) => candidate.id === active.id);
    if (!company) return null;
    return (
      <aside className="node-inspector" role="status" aria-live="polite">
        <span>公司节点</span>
        <strong>{company.name}</strong>
        <dl>
          <div><dt>状态</dt><dd>{company.statusLabel}</dd></div>
          <div><dt>影响</dt><dd>{impactLabels[company.impact]}</dd></div>
          <div><dt>关注度</dt><dd>{company.attentionScore} / 上浮 {company.verticalLift}</dd></div>
          <div><dt>关键时间</dt><dd>{company.statusTimeLabel}</dd></div>
          <div><dt>来源</dt><dd>{company.sourceCount} 份</dd></div>
        </dl>
      </aside>
    );
  }

  const eventId = active.kind === "event" ? active.id : active.eventId;
  const event = page.events.find((candidate) => candidate.id === eventId);
  if (!event) return null;

  if (active.kind === "version") {
    const version = event.versions.find((candidate) => candidate.id === active.id);
    if (!version) return null;
    return (
      <aside className="node-inspector" role="status" aria-live="polite">
        <span>事件版本 V{version.version}</span>
        <strong>{version.label}</strong>
        <dl>
          <div><dt>状态</dt><dd>{confirmationLabels[version.confirmationStatus] ?? version.confirmationStatus} / {executionLabels[version.executionStatus] ?? version.executionStatus}</dd></div>
          <div><dt>影响</dt><dd>{impactLabels[version.impact]}</dd></div>
          <div><dt>关键时间</dt><dd>{version.timeLabel}</dd></div>
          <div><dt>来源</dt><dd>{version.sourceCount} 份</dd></div>
        </dl>
      </aside>
    );
  }

  return (
    <aside className="node-inspector" role="status" aria-live="polite">
      <span>{event.isMain ? "主事件" : "辅助事件"}</span>
      <strong>{event.title}</strong>
      <dl>
        <div><dt>状态</dt><dd>{event.confirmationLabel} / {event.executionLabel}</dd></div>
        <div><dt>影响</dt><dd>{impactLabels[event.impact]}</dd></div>
        <div><dt>关键时间</dt><dd>{event.keyTimeLabel}</dd></div>
        <div><dt>来源</dt><dd>{event.sourceCount} 份</dd></div>
      </dl>
    </aside>
  );
}

function SnapshotTabs({ activeId, onChange }: { activeId: SnapshotId; onChange: (id: SnapshotId) => void }) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % snapshots.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + snapshots.length) % snapshots.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = snapshots.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = snapshots[nextIndex];
    if (!next) return;
    onChange(next.id);
    document.querySelector<HTMLButtonElement>(`[data-snapshot-index="${nextIndex}"]`)?.focus();
  };

  return (
    <div className="snapshot-tabs" role="tablist" aria-label="演化快照">
      {snapshots.map((snapshot, index) => (
        <button
          key={snapshot.id}
          type="button"
          role="tab"
          aria-selected={snapshot.id === activeId}
          data-snapshot-index={index}
          onClick={() => onChange(snapshot.id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          <time>{snapshot.date}</time>
          <span>{snapshot.label}</span>
        </button>
      ))}
    </div>
  );
}

export function App() {
  const reducedMotion = useReducedMotion();
  const [snapshotId, setSnapshotId] = useState<SnapshotId>("implementation-complete");
  const [hoveredNode, setHoveredNode] = useState<ActiveNode | null>(null);
  const [focusedNode, setFocusedNode] = useState<ActiveNode | null>(null);
  const [processOpen, setProcessOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => loadReadNotificationIds());
  const [detailTarget, setDetailTarget] = useState<{ eventId: string; version: number | null; tab?: DetailTabId } | null>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const notificationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const page = useMemo(() => buildPageViewModel(snapshotId), [snapshotId]);
  const detail = useMemo(() => detailTarget ? buildEventDetailViewModel(detailTarget.eventId, page.snapshot) : null, [detailTarget, page.snapshot]);
  const notificationItems = useMemo(() => notificationItemsAt(page.snapshot.date, readNotificationIds), [page.snapshot.date, readNotificationIds]);
  const notificationUnreadCount = useMemo(() => unreadCountAt(page.snapshot.date, readNotificationIds), [page.snapshot.date, readNotificationIds]);
  const activeNode = hoveredNode ?? focusedNode;

  const relation = useMemo(() => {
    const eventIds = new Set<string>();
    const companyIds = new Set<string>();
    if (!activeNode) return { eventIds, companyIds };

    if (activeNode.kind === "company") {
      companyIds.add(activeNode.id);
      page.events
        .filter((event) => event.companyIds.includes(activeNode.id))
        .forEach((event) => eventIds.add(event.id));
    } else {
      const eventId = activeNode.kind === "event" ? activeNode.id : activeNode.eventId;
      eventIds.add(eventId);
      page.events
        .find((event) => event.id === eventId)
        ?.companyIds.forEach((companyId) => companyIds.add(companyId));
    }

    return { eventIds, companyIds };
  }, [activeNode, page]);

  const changeSnapshot = (id: SnapshotId) => {
    setSnapshotId(id);
    setHoveredNode(null);
    setFocusedNode(null);
    setDetailTarget(null);
  };

  const openDetail = (node: ActiveNode, trigger: HTMLElement) => {
    if (node.kind === "company") return;
    setNotificationOpen(false);
    detailTriggerRef.current = trigger;
    setDetailTarget({
      eventId: node.kind === "event" ? node.id : node.eventId,
      version: node.kind === "version" ? Number(node.id.split("-v").at(-1)) : null,
      tab: node.kind === "version" ? "versions" : "overview"
    });
  };

  const closeDetail = () => {
    detailTriggerRef.current?.focus();
    setDetailTarget(null);
  };

  const commitReadIds = (update: (current: Set<string>) => Set<string>) => {
    setReadNotificationIds((current) => {
      const next = update(current);
      saveReadNotificationIds(next);
      return next;
    });
  };

  const markNotificationRead = (notificationId: string) => {
    commitReadIds((current) => new Set([...current, notificationId]));
  };

  const markNotificationsRead = (notificationIds: string[]) => {
    commitReadIds((current) => new Set([...current, ...notificationIds]));
  };

  const resetNotificationReadState = () => {
    clearReadNotificationIds();
    setReadNotificationIds(new Set());
  };

  const closeNotificationCenter = () => {
    setNotificationOpen(false);
    window.setTimeout(() => notificationTriggerRef.current?.focus(), 0);
  };

  const openNotificationDetail = (notification: RealNotification) => {
    markNotificationRead(notification.notification_id);
    setNotificationOpen(false);
    detailTriggerRef.current = notificationTriggerRef.current;
    setDetailTarget({
      eventId: notification.event_id,
      version: notification.current_version,
      tab: notification.target_tab
    });
  };

  return (
    <main className={`app-shell${reducedMotion ? " is-reduced-motion" : ""}`} data-motion-preference={reducedMotion ? "reduce" : "full"}>
      <header className="masthead">
        <div className="masthead__title">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <p>EVENT INTELLIGENCE / 事件证据层</p>
            <h1>事件浮力图</h1>
          </div>
        </div>
        <div className="masthead__center">
          <p className="masthead__subtitle">中国船舶集团重大重组</p>
          <SnapshotTabs activeId={snapshotId} onChange={changeSnapshot} />
        </div>
        <div className="masthead__actions">
          <button
            ref={notificationTriggerRef}
            type="button"
            className="notification-trigger"
            aria-expanded={notificationOpen}
            aria-controls="notification-center"
            onClick={() => { setNotificationOpen(true); setProcessOpen(false); setDetailTarget(null); }}
          >事件更新 <span aria-label={`${notificationUnreadCount}条未读`}>{notificationUnreadCount}</span></button>
          <button type="button" className="process-trigger" onClick={() => { setProcessOpen(true); setNotificationOpen(false); }}>查看分析过程</button>
          <div className="snapshot-badge">
            <span>DEMO</span>
            <strong>演示快照</strong>
            <small>{page.snapshot.date} · {page.sourceCount} 份已披露来源</small>
          </div>
        </div>
      </header>

      <section className={`map-shell${activeNode ? " has-active-node" : ""}`} aria-label="证据、事件与公司的浮力关系图">
        <div className="map-canvas">
          <div className="layer-label layer-label--asset"><span>01</span> 公司 / ASSET</div>
          <div className="layer-label layer-label--event"><span>02</span> 事件 / EVENT</div>
          <div className="layer-label layer-label--evidence"><span>03</span> 证据版本 / EVIDENCE</div>

          <svg viewBox="0 0 1160 720" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${page.snapshot.date} ${page.snapshot.label}事件浮力图`}>
            <defs>
              <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <g className="map-grid" aria-hidden="true">
              <line x1="44" y1="270" x2="1124" y2="270" />
              <line x1="44" y1="548" x2="1124" y2="548" />
            </g>

            <RelationLayer
              page={page}
              activeEventIds={relation.eventIds}
              activeCompanyIds={relation.companyIds}
              interactionActive={activeNode !== null}
            />

            <g>
              {page.companies.map((company) => (
                <CompanyNode
                  key={company.id}
                  company={company}
                  dimmed={activeNode !== null && !relation.companyIds.has(company.id)}
                  highlighted={relation.companyIds.has(company.id)}
                  onHover={setHoveredNode}
                  onFocus={setFocusedNode}
                />
              ))}
            </g>
            <g>
              {page.events.map((event) => (
                <EventNode
                  key={event.id}
                  event={event}
                  dimmed={activeNode !== null && !relation.eventIds.has(event.id)}
                  highlighted={relation.eventIds.has(event.id)}
                  onHover={setHoveredNode}
                  onFocus={setFocusedNode}
                  onActivate={openDetail}
                />
              ))}
            </g>
            <g>
              {page.events.flatMap((event) => {
                return event.versions.map((version, index) => {
                  const point = versionPoint(event, version, index);
                  return point ? (
                    <VersionNode
                      key={version.id}
                      version={version}
                      eventId={event.id}
                      point={point}
                      dimmed={activeNode !== null && !relation.eventIds.has(event.id)}
                      highlighted={relation.eventIds.has(event.id)}
                      onHover={setHoveredNode}
                      onFocus={setFocusedNode}
                      onActivate={openDetail}
                    />
                  ) : null;
                });
              })}
            </g>
          </svg>
          <Inspector active={activeNode} page={page} />
        </div>
        <Legend />
      </section>

      <footer className="page-footer">
        <p><span aria-hidden="true">◆</span> 证据 / 版本 → 事件 → 公司</p>
        <p>价格为材料快照中的历史观察值；“观察到”只描述时间相关变化</p>
        <strong>不构成投资建议</strong>
      </footer>
      <AnalysisProcessPanel open={processOpen} onClose={() => setProcessOpen(false)} />
      <NotificationCenter
        open={notificationOpen}
        snapshotDate={page.snapshot.date}
        snapshotLabel={page.snapshot.label}
        notifications={notificationItems}
        onClose={closeNotificationCenter}
        onMarkRead={markNotificationRead}
        onMarkAllRead={markNotificationsRead}
        onResetRead={resetNotificationReadState}
        onOpenNotification={openNotificationDetail}
      />
      {detail && detailTarget && (
        <EventDetailDrawer detail={detail} selectedVersion={detailTarget.version} initialTab={detailTarget.tab} onClose={closeDetail} />
      )}
    </main>
  );
}
