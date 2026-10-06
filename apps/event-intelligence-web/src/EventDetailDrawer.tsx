import { useEffect, useMemo, useRef, useState } from "react";

import type { DetailTabId, EventDetailViewModel } from "./detailTypes";

const tabs: Array<{ id: DetailTabId; label: string }> = [
  { id: "overview", label: "事件概览" },
  { id: "versions", label: "版本演化" },
  { id: "evidence", label: "证据与冲突" },
  { id: "impact", label: "标的影响与市场反应" },
  { id: "ai", label: "AI分析记录" }
];

const relationLabels: Record<string, string> = {
  supports: "支持", supplements: "补充", updates: "更新/替代", denies: "否认",
  corrects: "更正错误", supersedes: "替代旧版本", scope_clarification: "范围澄清",
  evidence_boundary: "证据边界"
};

function formatDate(value: string | null): string {
  if (!value) return "未知";
  return value.replace("T", " ");
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function OverviewTab({ detail }: { detail: EventDetailViewModel }) {
  return (
    <section className="detail-section detail-overview" aria-label="事件概览内容">
      <div className="detail-lead-card">
        <span>当前结论</span>
        <p>{detail.currentConclusion}</p>
        <div className="detail-status-row">
          <span>确认状态 <strong>{detail.confirmationLabel}</strong></span>
          <span>执行状态 <strong>{detail.executionLabel}</strong></span>
          <span>证据等级 <strong>{detail.evidenceGrade}</strong></span>
        </div>
      </div>

      <dl className="detail-facts-grid">
        <div><dt>演示快照</dt><dd>{detail.snapshotDate} · {detail.snapshotLabel}</dd></div>
        <div><dt>关联公司</dt><dd>{detail.companies.map((company) => `${company.name} ${company.ticker}`).join("；")}</dd></div>
        <div><dt>相关来源</dt><dd>{detail.sourceCount} 份可追溯材料；{detail.weightedSourceCount} 份独立计权证据</dd></div>
        <div><dt>最近结论变化</dt><dd>{detail.latestConclusionDelta}</dd></div>
      </dl>

      <article className="detail-card">
        <div className="detail-card__heading"><h3>最早可验证来源</h3><span className={`grade grade--${detail.earliestSource?.evidenceGrade ?? "D"}`}>{detail.earliestSource?.evidenceGrade ?? "—"}</span></div>
        {detail.earliestSource ? (
          <>
            <strong>{detail.earliestSource.title}</strong>
            <p>{detail.earliestSource.publisher} · {formatDate(detail.earliestSource.publishedAt)} · {detail.earliestSource.sourceId}</p>
            <small>{detail.earliestSourceCaveat}</small>
          </>
        ) : <p>当前快照没有可验证来源。</p>}
      </article>

      <article className="detail-card">
        <div className="detail-card__heading"><h3>当前仍然未知</h3><span>{detail.unknowns.length} 项</span></div>
        {detail.unknowns.length > 0 ? <ul>{detail.unknowns.map((item) => <li key={item}>{item}</li>)}</ul> : <p>当前材料未识别到额外未知事项。</p>}
      </article>
    </section>
  );
}

function VersionsTab({ detail, selectedVersion, onSource }: {
  detail: EventDetailViewModel;
  selectedVersion: number | null;
  onSource: (sourceId: string) => void;
}) {
  return (
    <section className="detail-section version-timeline" aria-label="完整版本演化">
      <p className="detail-explainer">完整版本链按披露时间排列；发生时间未知时保持未知，不使用披露时间补齐。</p>
      {detail.versions.map((version) => (
        <article
          key={version.version}
          id={`detail-${detail.eventId}-v${version.version}`}
          className={`version-card${selectedVersion === version.version ? " is-selected" : ""}`}
          tabIndex={-1}
        >
          <div className="version-card__rail"><span>V{version.version}</span><i /></div>
          <div className="version-card__content">
            <header><h3>{version.label}</h3><span>{relationLabels[version.relationToPrevious ?? ""] ?? (version.relationToPrevious ?? "起始版本")}</span></header>
            <div className="version-card__statuses">
              <span>确认：{version.confirmationLabel}</span><span>执行：{version.executionLabel}</span>
            </div>
            <dl className="time-grid">
              <div><dt>事件发生</dt><dd>{formatDate(version.occurredAt)}</dd></div>
              <div><dt>对外披露</dt><dd>{formatDate(version.disclosedAt)}</dd></div>
              <div><dt>系统抓取</dt><dd>{formatDate(version.fetchedAt)}</dd></div>
              <div><dt>分析更新</dt><dd>{formatDate(version.analysisUpdatedAt)}</dd></div>
            </dl>
            <p className="version-card__conclusion">{version.conclusion}</p>
            <div className="version-delta"><strong>相比上一版本</strong><p>{version.conclusionDelta}</p></div>
            <div className="reference-buttons">
              <span>支撑来源</span>
              {version.sourceIds.map((sourceId) => <button type="button" key={sourceId} onClick={() => onSource(sourceId)}>{sourceId}</button>)}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function EvidenceTab({ detail, onClaim, onSource }: {
  detail: EventDetailViewModel;
  onClaim: (claimId: string) => void;
  onSource: (sourceId: string) => void;
}) {
  const claimGroups = (["fact", "opinion", "inference", "rumor"] as const).map((kind) => ({ kind, claims: detail.claims.filter((claim) => claim.kind === kind) }));
  return (
    <section className="detail-section evidence-section" aria-label="证据与冲突内容">
      <p className="detail-explainer">观点和传闻不会因后续事件落地而被倒写成早期已确认事实。证据等级由确定性规则生成，用户不能修改。</p>

      <div className="claim-groups">
        {claimGroups.map((group) => (
          <section key={group.kind} className={`claim-group claim-group--${group.kind}`}>
            <header><h3>{group.claims[0]?.kindLabel ?? ({ fact: "已确认事实", opinion: "机构或专家观点", inference: "基于材料的推测", rumor: "尚未证实的传闻" }[group.kind])}</h3><span>{group.claims.length}</span></header>
            {group.claims.length === 0 ? <p className="empty-note">当前快照没有此类主张。</p> : group.claims.map((claim) => (
              <article key={claim.claimId} id={`detail-claim-${claim.claimId}`} className="claim-card" tabIndex={-1}>
                <div><span className={`claim-type claim-type--${claim.kind}`}>{claim.kind}</span><span className={`grade grade--${claim.evidenceGrade}`}>{claim.evidenceGrade}</span><code>{claim.claimId}</code></div>
                <strong>{claim.text}</strong>
                <p><b>核验：</b>{claim.verification}</p>
                <p><b>当前适用性：</b>{claim.applicability}</p>
                <div className="reference-buttons"><span>来源</span>{claim.sourceIds.map((sourceId) => <button type="button" key={sourceId} onClick={() => onSource(sourceId)}>{sourceId}</button>)}</div>
              </article>
            ))}
          </section>
        ))}
      </div>

      <section className="conflict-section">
        <header><h3>证据冲突与结论变化</h3><span>{detail.conflicts.length}</span></header>
        {detail.conflicts.length === 0 ? <p className="empty-note">当前未识别到直接否认或事实冲突。</p> : detail.conflicts.map((conflict) => (
          <article key={conflict.conflictId} className="conflict-card">
            <div><strong>{conflict.title}</strong><span>{relationLabels[conflict.relation] ?? conflict.relation}</span></div>
            <p>{conflict.description}</p>
            <small><b>当前处理：</b>{conflict.resolution}</small>
            <div className="reference-buttons"><span>来源</span>{conflict.sourceIds.map((sourceId) => <button type="button" key={sourceId} onClick={() => onSource(sourceId)}>{sourceId}</button>)}</div>
          </article>
        ))}
      </section>

      <section className="source-list">
        <header><h3>来源列表</h3><span>{detail.sources.length} 份</span></header>
        {detail.sources.map((source) => (
          <article key={source.sourceId} id={`detail-source-${source.sourceId}`} className="source-card" tabIndex={-1}>
            <div className="source-card__top">
              <span className={`grade grade--${source.evidenceGrade}`}>{source.evidenceGrade}</span>
              <div><code>{source.sourceId}</code><h4>{source.title}</h4></div>
              {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">原文 ↗</a> : <span>无原文链接</span>}
            </div>
            <dl>
              <div><dt>发布主体</dt><dd>{source.publisher}</dd></div>
              <div><dt>来源类型</dt><dd>{source.sourceType}</dd></div>
              <div><dt>发布时间</dt><dd>{formatDate(source.publishedAt)}</dd></div>
              <div><dt>抓取时间</dt><dd>{formatDate(source.fetchedAt)}</dd></div>
              <div><dt>第一手</dt><dd>{source.isFirstParty ? "是" : "否"}</dd></div>
              <div><dt>转载</dt><dd>{source.isReprint ? "是" : "否"}</dd></div>
              <div><dt>原始来源</dt><dd>{source.originalSource ?? "未提供"}</dd></div>
              <div><dt>与前文关系</dt><dd>{relationLabels[source.relationToPrevious] ?? source.relationToPrevious}</dd></div>
            </dl>
            <p className="source-card__excerpt">{source.excerpt}</p>
            <div className={`weight-note${source.evidenceWeight === 0 ? " is-folded" : ""}`}>
              权重 {source.evidenceWeight} · {source.weightNote}
            </div>
            <div className="reference-buttons"><span>支撑主张</span>{source.claimIds.map((claimId) => <button type="button" key={claimId} onClick={() => onClaim(claimId)}>{claimId}</button>)}</div>
          </article>
        ))}
      </section>
    </section>
  );
}

function ImpactTab({ detail, onClaim, onSource }: {
  detail: EventDetailViewModel;
  onClaim: (claimId: string) => void;
  onSource: (sourceId: string) => void;
}) {
  return (
    <section className="detail-section impact-section" aria-label="标的影响与市场反应内容">
      <section className="impact-list">
        <header><h3>逐公司影响</h3><span>不提供买卖建议或目标价</span></header>
        {detail.impacts.map((impact) => (
          <article key={impact.companyId} className={`impact-card impact-card--${impact.direction}`}>
            <header><div><h3>{impact.companyName}</h3><small>{impact.ticker}</small></div><span>{impact.directionLabel}</span><strong>{Math.round(impact.confidence * 100)}%</strong></header>
            <div className="factor-columns">
              <div><h4>正面因素</h4>{impact.positiveFactors.length ? <ul>{impact.positiveFactors.map((factor) => <li key={factor}>{factor}</li>)}</ul> : <p>无已识别正面因素。</p>}</div>
              <div><h4>负面因素</h4>{impact.negativeFactors.length ? <ul>{impact.negativeFactors.map((factor) => <li key={factor}>{factor}</li>)}</ul> : <p>无已识别负面因素。</p>}</div>
            </div>
            <div className="uncertainty-list"><h4>不确定因素</h4>{impact.uncertainties.length ? <ul>{impact.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul> : <p>当前未记录额外不确定因素。</p>}</div>
            <div className="reference-buttons"><span>依据主张</span>{impact.basisClaimIds.map((claimId) => <button type="button" key={claimId} onClick={() => onClaim(claimId)}>{claimId}</button>)}</div>
            <div className="reference-buttons"><span>依据来源</span>{impact.sourceIds.map((sourceId) => <button type="button" key={sourceId} onClick={() => onSource(sourceId)}>{sourceId}</button>)}</div>
          </article>
        ))}
      </section>

      <section className="market-detail">
        <header><h3>市场反应与关键数字</h3><span>{detail.market.reactionStatus}</span></header>
        <p className="market-disclaimer">{detail.market.fixedDisclaimer}</p>
        <dl className="detail-facts-grid compact">
          <div><dt>披露锚点</dt><dd>{formatDate(detail.market.disclosureAnchor)}</dd></div>
          <div><dt>数据频率</dt><dd>{detail.market.frequency}</dd></div>
          <div><dt>基准指数</dt><dd>{detail.market.benchmarkName ?? "未建立"}</dd></div>
          <div><dt>分钟数据</dt><dd>{detail.market.minuteDataStatus}</dd></div>
        </dl>
        <p className="detail-explainer">{detail.market.minuteDataNote}</p>
        {detail.market.observations.length === 0 ? <p className="empty-note">当前快照没有可展示的市场观察，不生成伪实时价格或短时窗口结论。</p> : detail.market.observations.map((observation) => (
          <article key={observation.observationId} className="market-observation-card">
            <header><div><h4>{observation.companyName}</h4><code>{observation.observationId}</code></div><strong className={observation.returnPct >= 0 ? "number-up" : "number-down"}>{formatPercent(observation.returnPct)}</strong></header>
            <p>{observation.window}</p>
            <div className="market-number-grid">
              <div><span>观察前</span><strong>¥{observation.beforeClose.toFixed(2)}</strong><small>{observation.beforeDate}</small></div>
              <div><span>观察后</span><strong>¥{observation.afterClose.toFixed(2)}</strong><small>{observation.afterDate}</small></div>
              <div><span>基准变化</span><strong>{formatPercent(observation.benchmarkReturnPct)}</strong><small>{detail.market.benchmarkName ?? "基准"}</small></div>
              <div><span>超额变化</span><strong>{formatPercent(observation.excessVsBenchmarkPp)}</strong><small>百分点</small></div>
            </div>
            <p>{observation.interpretation}</p>
            <div className="ratio-row">
              {observation.volumeRatio !== null && <span>成交量比 {observation.volumeRatio.toFixed(2)}×</span>}
              {observation.turnoverAmountRatio !== null && <span>成交额比 {observation.turnoverAmountRatio.toFixed(2)}×</span>}
              <span>原始字段：{observation.rawFieldPath}</span>
            </div>
            <div className="reference-buttons"><span>price_source_ids</span>{observation.priceSourceIds.length ? observation.priceSourceIds.map((sourceId) => <button type="button" key={sourceId} onClick={() => onSource(sourceId)}>{sourceId}</button>) : <em>未配置；使用下列数据来源名称追溯</em>}</div>
            <p className="source-names">数据来源：{observation.dataSourceNames.join("；") || "未单独配置"}</p>
          </article>
        ))}

        {Object.keys(detail.market.formulae).length > 0 && <article className="formula-card"><h4>计算公式</h4><dl>{Object.entries(detail.market.formulae).map(([name, formula]) => <div key={name}><dt>{name}</dt><dd><code>{formula}</code></dd></div>)}</dl></article>}
        <article className="detail-card"><h3>数据限制</h3><ul>{detail.market.limitations.map((item) => <li key={item}>{item}</li>)}</ul></article>
      </section>
    </section>
  );
}

function AiTab({ detail }: { detail: EventDetailViewModel }) {
  return (
    <section className="detail-section ai-record" aria-label="AI分析记录内容">
      <div className="ai-boundaries">
        <article><span>来源原始事实</span><p>来自公告、监管、新闻、研报与行情材料中的原始字段。</p></article>
        <article><span>程序计算结果</span><p>去重权重、聚类、收益率、相对基准和引用校验由确定性程序生成。</p></article>
        <article><span>保存的AI分析</span><p>主张分类、版本关系和逐公司影响来自本次保存运行产物。</p></article>
        <article><span>未验证观点/推测</span><p>opinion、inference 和 rumor 保持原类型，不提升为事实。</p></article>
      </div>
      <dl className="detail-facts-grid">
        <div><dt>当前运行模式</dt><dd>{detail.ai.currentMode}</dd></div>
        <div><dt>run_id</dt><dd>{detail.ai.runId}</dd></div>
        <div><dt>Prompt版本</dt><dd>{detail.ai.promptVersion}</dd></div>
        <div><dt>Provider</dt><dd>{detail.ai.providerName} · {detail.ai.provider}</dd></div>
        <div><dt>provider_id</dt><dd>{detail.ai.providerId}</dd></div>
        <div><dt>模型名称</dt><dd>{detail.ai.modelName}</dd></div>
        <div><dt>分析时间</dt><dd>{formatDate(detail.ai.analysisTime)}</dd></div>
        <div><dt>validation_status</dt><dd>{detail.ai.validationStatus}</dd></div>
        <div><dt>Schema校验</dt><dd>{detail.ai.schemaValidation}</dd></div>
        <div><dt>引用校验</dt><dd>{detail.ai.referenceValidation}</dd></div>
        <div><dt>业务校验</dt><dd>{detail.ai.businessValidation}</dd></div>
        <div><dt>允许写入视觉结果</dt><dd>{detail.ai.visualWriteAllowed ? "是" : "否"}</dd></div>
      </dl>
      <article className="detail-card"><div className="detail-card__heading"><h3>在线 Provider 状态</h3><span>{detail.ai.onlineProviderStatus}</span></div><p>{detail.ai.onlineProviderMessage}</p><small>{detail.ai.fallbackStatus}</small></article>
      <article className="detail-card"><div className="detail-card__heading"><h3>引用与结构校验</h3><span>{detail.ai.validationChecks.length} 项</span></div><ul className="check-list">{detail.ai.validationChecks.map((check) => <li key={check.name}><code>{check.name}</code><strong>{check.status}</strong></li>)}</ul></article>
      <article className="detail-card"><div className="detail-card__heading"><h3>警告</h3><span>{detail.ai.warnings.length}</span></div><ul>{detail.ai.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></article>
      <article className="detail-card"><div className="detail-card__heading"><h3>工具可用性</h3><span>{detail.ai.toolAvailability.length}</span></div><ul className="tool-list">{detail.ai.toolAvailability.map((tool) => <li key={tool.tool}><strong>{tool.tool}</strong><span className={tool.available ? "is-available" : "is-unavailable"}>{tool.available ? "可用" : "不可用"}</span>{tool.reason && <small>{tool.reason}</small>}</li>)}</ul></article>
      <article className="detail-card"><div className="detail-card__heading"><h3>相关工具调用</h3><span>{detail.ai.relatedToolCalls.length}</span></div>{detail.ai.relatedToolCalls.length ? <ul className="call-list">{detail.ai.relatedToolCalls.map((call) => <li key={call.callId}><code>{call.callId}</code><strong>{call.tool}</strong><span>{call.status}</span><p>{call.query}</p></li>)}</ul> : <p>当前事件在本快照没有单独关联的工具调用记录。</p>}</article>
      <article className="detail-card"><div className="detail-card__heading"><h3>已知数据限制</h3><span>{detail.ai.dataLimitations.length}</span></div><ul>{detail.ai.dataLimitations.map((item) => <li key={item}>{item}</li>)}</ul></article>
    </section>
  );
}

export function EventDetailDrawer({ detail, selectedVersion, initialTab, onClose }: {
  detail: EventDetailViewModel;
  selectedVersion: number | null;
  initialTab?: DetailTabId | undefined;
  onClose: () => void;
}) {
  const defaultTab = initialTab ?? (selectedVersion ? "versions" : "overview");
  const [activeTab, setActiveTab] = useState<DetailTabId>(defaultTab);
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(selectedVersion ? `detail-${detail.eventId}-v${selectedVersion}` : null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setActiveTab(initialTab ?? (selectedVersion ? "versions" : "overview"));
    setPendingAnchor(selectedVersion ? `detail-${detail.eventId}-v${selectedVersion}` : null);
    window.setTimeout(() => closeRef.current?.focus(), 0);
  }, [detail.eventId, initialTab, selectedVersion]);

  useEffect(() => {
    if (!pendingAnchor) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(pendingAnchor);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus({ preventScroll: true });
      setPendingAnchor(null);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [activeTab, pendingAnchor]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const navigateTo = (kind: "claim" | "source", id: string) => {
    setActiveTab("evidence");
    setPendingAnchor(`detail-${kind}-${id}`);
  };

  const activePanel = useMemo(() => {
    if (activeTab === "overview") return <OverviewTab detail={detail} />;
    if (activeTab === "versions") return <VersionsTab detail={detail} selectedVersion={selectedVersion} onSource={(id) => navigateTo("source", id)} />;
    if (activeTab === "evidence") return <EvidenceTab detail={detail} onClaim={(id) => navigateTo("claim", id)} onSource={(id) => navigateTo("source", id)} />;
    if (activeTab === "impact") return <ImpactTab detail={detail} onClaim={(id) => navigateTo("claim", id)} onSource={(id) => navigateTo("source", id)} />;
    return <AiTab detail={detail} />;
  }, [activeTab, detail, selectedVersion]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const tab = tabs[nextIndex];
    if (!tab) return;
    setActiveTab(tab.id);
    drawerRef.current?.querySelector<HTMLButtonElement>(`[data-detail-tab="${tab.id}"]`)?.focus();
  };

  const trapFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return (
    <div className="detail-drawer-shell" aria-live="polite">
      <aside ref={drawerRef} className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="event-detail-title" onKeyDown={trapFocus}>
        <header className="detail-drawer__header">
          <div><p>{detail.isMain ? "MAIN EVENT" : "RELATED EVENT"} · {detail.snapshotDate}</p><h2 id="event-detail-title">{detail.title}</h2></div>
          <button ref={closeRef} type="button" className="detail-drawer__close" onClick={onClose} aria-label="关闭事件详情">×</button>
        </header>
        <div className="detail-tabs" role="tablist" aria-label="事件详情页签">
          {tabs.map((tab, index) => (
            <button
              type="button"
              role="tab"
              key={tab.id}
              data-detail-tab={tab.id}
              aria-selected={activeTab === tab.id}
              aria-controls={`detail-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >{tab.label}</button>
          ))}
        </div>
        <div id={`detail-panel-${activeTab}`} className="detail-drawer__body" role="tabpanel" aria-label={tabs.find((tab) => tab.id === activeTab)?.label}>
          {activePanel}
        </div>
        <footer className="detail-drawer__footer">保存材料快照 · {detail.sourceCount} 份可追溯材料 / {detail.weightedSourceCount} 份计权证据 · 不构成投资建议</footer>
      </aside>
    </div>
  );
}
