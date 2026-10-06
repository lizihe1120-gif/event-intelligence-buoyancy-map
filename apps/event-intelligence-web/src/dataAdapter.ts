import companiesJson from "../../../data/demo/companies.json";
import eventsJson from "../../../data/demo/events.json";
import marketJson from "../../../data/demo/market-reactions.json";
import sourcesJson from "../../../data/demo/sources.json";
import visualResultJson from "../../../data/demo-runs/material-analysis-001/visual-result.json";
import validationResultJson from "../../../data/demo-runs/material-analysis-001/validation-result.json";

import type {
  CompaniesDataset,
  CompanyRecord,
  CompanyViewModel,
  EventRecord,
  EventsDataset,
  EventVersionRecord,
  EventViewModel,
  Impact,
  MarketDataset,
  MarketObservation,
  PageViewModel,
  SnapshotDefinition,
  SourcesDataset,
  TradingStatus,
  TradingStatusEntry,
  VersionViewModel
} from "./types";
import type { VisualResultArtifact, VisualSnapshot, VisualEvent } from "./pipeline/types";

const companiesData = companiesJson as CompaniesDataset;
const eventsData = eventsJson as EventsDataset;
const sourcesData = sourcesJson as SourcesDataset;
const marketData = marketJson as MarketDataset;
const visualData = visualResultJson as VisualResultArtifact;
const validationData = validationResultJson as { passed: boolean };

if (!validationData.passed || !visualData.validation_run_passed) {
  throw new Error("The saved analysis run did not pass validation; visual data cannot be applied.");
}

export const snapshots = [
  { id: "planning-suspension", date: "2024-09-03", label: "筹划停牌" },
  { id: "plan-resumption", date: "2024-09-19", label: "预案复牌" },
  { id: "implementation-complete", date: "2025-09-16", label: "实施完成" }
] as const satisfies readonly SnapshotDefinition[];

export type SnapshotId = (typeof snapshots)[number]["id"];

const statusLabels: Record<TradingStatus, string> = {
  normal_trading: "正常交易",
  suspended: "停牌中",
  resumed: "已复牌",
  delisted: "已终止上市"
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

const tradingStatusPriority: Record<TradingStatus, number> = {
  normal_trading: 1,
  resumed: 2,
  suspended: 3,
  delisted: 4
};

function datePart(value: string): string {
  return value.slice(0, 10);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function aggregateImpact(values: Impact[]): Impact {
  const meaningful = values.filter((value) => value !== "unclear");
  if (meaningful.length === 0) return "unclear";
  if (meaningful.includes("mixed")) return "mixed";
  if (meaningful.includes("positive") && meaningful.includes("negative")) return "mixed";
  if (meaningful.every((value) => value === "positive")) return "positive";
  if (meaningful.every((value) => value === "negative")) return "negative";
  return "mixed";
}

function visibleVersions(event: EventRecord, snapshotDate: string): EventVersionRecord[] {
  return event.versions.filter((version) => datePart(version.disclosed_at) <= snapshotDate);
}

function visualSnapshot(snapshotId: SnapshotId): VisualSnapshot {
  const snapshot = visualData.snapshots.find((candidate) => candidate.snapshot_id === snapshotId);
  if (!snapshot) throw new Error(`Missing validated visual snapshot: ${snapshotId}`);
  return snapshot;
}

function tradingStatusAt(company: CompanyRecord, snapshotDate: string): {
  status: TradingStatus;
  entry: TradingStatusEntry | null;
} {
  const matching = company.trading_status_history
    .filter((entry) => entry.effective_from <= snapshotDate && (entry.effective_to === null || entry.effective_to >= snapshotDate))
    .sort((left, right) => {
      const dateOrder = right.effective_from.localeCompare(left.effective_from);
      return dateOrder !== 0 ? dateOrder : tradingStatusPriority[right.status] - tradingStatusPriority[left.status];
    });

  const entry = matching[0] ?? null;
  if (entry) return { status: entry.status, entry };

  if (company.delisted_at !== undefined && company.delisted_at <= snapshotDate) {
    return { status: "delisted", entry: null };
  }

  return { status: "normal_trading", entry: null };
}

function latestObservationAt(companyId: string, snapshotDate: string): MarketObservation | null {
  return marketData.observations
    .filter((observation) => observation.company_id === companyId && observation.after.date <= snapshotDate)
    .sort((left, right) => right.after.date.localeCompare(left.after.date))[0] ?? null;
}

function lastTradingRecordAt(company: CompanyRecord, snapshotDate: string, activeEntry: TradingStatusEntry | null): TradingStatusEntry | null {
  if (activeEntry?.last_close !== undefined) return activeEntry;

  return company.trading_status_history
    .filter((entry) => entry.status === "suspended" && entry.effective_from <= snapshotDate && entry.last_close !== undefined)
    .sort((left, right) => right.effective_from.localeCompare(left.effective_from))[0] ?? null;
}

function priceAt(company: CompanyRecord, snapshot: SnapshotDefinition, status: TradingStatus, entry: TradingStatusEntry | null) {
  if (status === "delisted" || status === "suspended") {
    const lastTradingRecord = lastTradingRecordAt(company, snapshot.date, entry);
    return {
      label: "最后收盘",
      value: lastTradingRecord?.last_close === undefined ? "—" : `¥${lastTradingRecord.last_close.toFixed(2)}`,
      dateLabel: lastTradingRecord?.last_traded_at === undefined
        ? "最后交易日未知"
        : `最后交易日 ${lastTradingRecord.last_traded_at}`,
      observation: null,
      direction: null
    } as const;
  }

  const observation = latestObservationAt(company.company_id, snapshot.date);
  if (!observation) {
    return {
      label: "材料价",
      value: "—",
      dateLabel: "截至快照无价格观察",
      observation: null,
      direction: null
    } as const;
  }

  const isSnapshotObservation = observation.after.date === snapshot.date;
  const returnPct = observation.calculated.return_pct;
  return {
    label: "材料价",
    value: `¥${observation.after.close_cny.toFixed(2)}`,
    dateLabel: `数据日 ${observation.after.date}`,
    observation: isSnapshotObservation
      ? `观察到 ${returnPct > 0 ? "+" : ""}${returnPct.toFixed(2)}%`
      : null,
    direction: isSnapshotObservation ? (returnPct > 0 ? "up" : returnPct < 0 ? "down" : "flat") : null
  } as const;
}

function selectedVersions(versions: EventVersionRecord[], isMain: boolean): EventVersionRecord[] {
  if (isMain || versions.length <= 3) return versions;
  const middleIndex = Math.floor((versions.length - 1) / 2);
  return unique([versions[0], versions[middleIndex], versions.at(-1)])
    .filter((version) => version !== undefined);
}

function toVersionView(
  event: EventRecord,
  versions: EventVersionRecord[],
  visualEvent: VisualEvent
): VersionViewModel[] {
  return selectedVersions(versions, event.is_main_event).map((version) => {
    const visualVersion = visualEvent.versions.find((candidate) => candidate.version === version.version);
    if (!visualVersion) throw new Error(`Missing validated visual version: ${event.event_id}/V${version.version}`);

    return {
      id: `${event.event_id}-v${version.version}`,
      version: version.version,
      label: version.label,
      timeLabel: version.occurred_at ?? "实际发生时间未知",
      confirmationStatus: version.confirmation_status,
      executionStatus: version.execution_status,
      impact: visualVersion.impact,
      sourceCount: unique(version.source_ids).length,
      isConfirmed: visualVersion.relation_stage === "approaching" || visualVersion.relation_stage === "stable_fusion",
      relationStage: visualVersion.relation_stage,
      evidenceLevel: visualVersion.evidence_level
    };
  });
}

function toEventView(event: EventRecord, snapshot: SnapshotDefinition, visualSnapshotData: VisualSnapshot): EventViewModel | null {
  const versions = visibleVersions(event, snapshot.date);
  const latestVersion = versions.at(-1);
  if (!latestVersion) return null;
  const visualEvent = visualSnapshotData.events.find((candidate) => candidate.event_id === event.event_id);
  if (!visualEvent) throw new Error(`Missing validated visual event: ${event.event_id}/${snapshot.id}`);

  const visibleSourceIds = unique(versions.flatMap((version) => version.source_ids));
  const companyImpacts = visualEvent.impact_by_company;
  const hasObservedReaction = !["not_checked", "not_observed"].includes(visualEvent.market_reaction_status);
  const executionSettled = ["completed", "terminated", "expired"].includes(visualEvent.execution_status);
  const allVersionsVisible = versions.length === event.versions.length;

  return {
    id: event.event_id,
    title: event.is_main_event || allVersionsVisible ? event.title : latestVersion.label,
    isMain: event.is_main_event,
    companyIds: event.company_ids,
    confirmationStatus: visualEvent.confirmation_status,
    confirmationLabel: confirmationLabels[visualEvent.confirmation_status] ?? visualEvent.confirmation_status,
    executionStatus: visualEvent.execution_status,
    executionLabel: executionLabels[visualEvent.execution_status] ?? visualEvent.execution_status,
    conclusion: latestVersion.conclusion,
    keyTimeLabel: latestVersion.occurred_at ?? "实际发生时间未知",
    disclosedTimeLabel: datePart(latestVersion.disclosed_at),
    sourceCount: visibleSourceIds.length,
    impact: visualEvent.impact,
    companyImpacts,
    hasObservedReaction,
    needsAttention: visualEvent.confirmation_status !== "confirmed" || !executionSettled || !hasObservedReaction,
    size: visualEvent.bubble_size,
    versions: toVersionView(event, versions, visualEvent),
    relationStage: visualEvent.relation_stage,
    evidenceLevel: visualEvent.evidence_level,
    marketReactionStatus: visualEvent.market_reaction_status
  };
}

function toCompanyView(
  company: CompanyRecord,
  snapshot: SnapshotDefinition,
  events: EventViewModel[],
  visualSnapshotData: VisualSnapshot
): CompanyViewModel {
  const { status, entry } = tradingStatusAt(company, snapshot.date);
  const price = priceAt(company, snapshot, status, entry);
  const sourceCount = sourcesData.sources.filter((source) =>
    source.company_ids.includes(company.company_id)
    && source.published_at !== null
    && datePart(source.published_at) <= snapshot.date
  ).length;
  const relatedImpacts = events
    .filter((event) => event.companyIds.includes(company.company_id))
    .map((event) => event.companyImpacts[company.company_id] ?? "unclear");
  const visualCompany = visualSnapshotData.companies.find((candidate) => candidate.company_id === company.company_id);
  if (!visualCompany) throw new Error(`Missing validated visual company metrics: ${company.company_id}/${snapshot.id}`);

  return {
    id: company.company_id,
    name: company.short_name,
    fullName: company.name,
    ticker: company.ticker,
    exchange: company.exchange,
    status,
    statusLabel: statusLabels[status],
    sourceCount,
    priceLabel: price.label,
    price: price.value,
    priceDateLabel: price.dateLabel,
    marketObservation: price.observation,
    marketDirection: price.direction,
    statusTimeLabel: entry === null ? `快照日期 ${snapshot.date}` : `状态起始 ${entry.effective_from}`,
    role: company.role_in_main_event,
    impact: aggregateImpact(relatedImpacts),
    size: visualCompany.bubble_size,
    attentionScore: visualCompany.attention_score,
    verticalLift: visualCompany.vertical_lift,
    marketReactionStatus: visualCompany.market_reaction_status
  };
}

export function buildPageViewModel(snapshotId: SnapshotId = "implementation-complete"): PageViewModel {
  const snapshot = snapshots.find((candidate) => candidate.id === snapshotId) ?? snapshots[2];
  const visualSnapshotData = visualSnapshot(snapshot.id);
  const events = eventsData.events
    .map((event) => toEventView(event, snapshot, visualSnapshotData))
    .filter((event): event is EventViewModel => event !== null);
  const visibleSourceIds = unique(eventsData.events.flatMap((event) =>
    visibleVersions(event, snapshot.date).flatMap((version) => version.source_ids)
  ));

  return {
    snapshot,
    sourceCount: visibleSourceIds.length,
    companies: companiesData.companies.map((company) => toCompanyView(company, snapshot, events, visualSnapshotData)),
    events
  };
}
