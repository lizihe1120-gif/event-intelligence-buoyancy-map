export type TradingStatus = "normal_trading" | "suspended" | "resumed" | "delisted";
export type Impact = "positive" | "negative" | "mixed" | "unclear";
export type RelationStage = "drifting" | "lifting" | "approaching" | "stable_fusion" | "cooling";

export interface TradingStatusEntry {
  status: TradingStatus;
  effective_from: string;
  effective_to: string | null;
  reason: string;
  last_traded_at?: string;
  last_close?: number;
  currency?: string;
  market_observation_id?: string | null;
  price_source_ids?: string[];
  event_ids: string[];
  source_ids: string[];
}

export interface CompanyRecord {
  company_id: string;
  name: string;
  short_name: string;
  ticker: string;
  exchange: string;
  listing_status: string;
  delisted_at?: string;
  current_trading_status: TradingStatus;
  aliases: string[];
  role_in_main_event: string;
  trading_status_history: TradingStatusEntry[];
}

export interface CompaniesDataset {
  generated_at: string;
  companies: CompanyRecord[];
}

export interface EventVersionRecord {
  version: number;
  label: string;
  confirmation_status: string;
  execution_status: string;
  occurred_at: string | null;
  occurred_at_note?: string;
  disclosed_at: string;
  fetched_at: string;
  analysis_updated_at: string;
  conclusion: string;
  change_from_previous?: string | null;
  source_ids: string[];
}

export interface EventRecord {
  event_id: string;
  event_type: string;
  is_main_event: boolean;
  title: string;
  company_ids: string[];
  confirmation_status: string;
  execution_status: string;
  current_conclusion: string;
  times: {
    occurred_at: string | null;
    occurred_at_note?: string;
    disclosed_at: string;
    fetched_at: string;
    analysis_updated_at: string;
  };
  source_ids?: string[];
  versions: EventVersionRecord[];
}

export interface EventsDataset {
  generated_at: string;
  events: EventRecord[];
}

export interface SourceRecord {
  source_id: string;
  source_type: string;
  title: string;
  published_at: string | null;
  is_first_party: boolean;
  company_ids: string[];
  event_ids: string[];
}

export interface SourcesDataset {
  generated_at: string;
  sources: SourceRecord[];
}

export interface SourceAnalysisRecord {
  source_id: string;
  event_id: string;
  impact: Record<string, Impact>;
  landing_status: string;
}

export interface AnalysisDataset {
  generated_at: string;
  source_analyses: SourceAnalysisRecord[];
}

export interface MarketObservation {
  observation_id: string;
  company_id: string;
  before: {
    date: string;
    close_cny: number;
  };
  after: {
    date: string;
    close_cny: number;
  };
  calculated: {
    return_pct: number;
  };
  reaction_label: string;
}

export interface MarketDataset {
  generated_at: string;
  event_id: string;
  market_reaction_status: string;
  observations: MarketObservation[];
}

export interface CompanyViewModel {
  id: string;
  name: string;
  fullName: string;
  ticker: string;
  exchange: string;
  status: TradingStatus;
  statusLabel: string;
  sourceCount: number;
  priceLabel: string;
  price: string;
  priceDateLabel: string;
  marketObservation: string | null;
  marketDirection: "up" | "down" | "flat" | null;
  statusTimeLabel: string;
  role: string;
  impact: Impact;
  size: number;
  attentionScore: number;
  verticalLift: number;
  marketReactionStatus: string;
}

export interface VersionViewModel {
  id: string;
  version: number;
  label: string;
  timeLabel: string;
  confirmationStatus: string;
  executionStatus: string;
  impact: Impact;
  sourceCount: number;
  isConfirmed: boolean;
  relationStage: RelationStage;
  evidenceLevel: "first_party" | "corroborated" | "reported";
}

export interface EventViewModel {
  id: string;
  title: string;
  isMain: boolean;
  companyIds: string[];
  confirmationStatus: string;
  confirmationLabel: string;
  executionStatus: string;
  executionLabel: string;
  conclusion: string;
  keyTimeLabel: string;
  disclosedTimeLabel: string;
  sourceCount: number;
  impact: Impact;
  companyImpacts: Record<string, Impact>;
  hasObservedReaction: boolean;
  needsAttention: boolean;
  size: number;
  versions: VersionViewModel[];
  relationStage: RelationStage;
  evidenceLevel: "first_party" | "corroborated" | "reported";
  marketReactionStatus: string;
}

export interface PageViewModel {
  snapshot: SnapshotDefinition;
  sourceCount: number;
  companies: CompanyViewModel[];
  events: EventViewModel[];
}

export interface SnapshotDefinition {
  id: "planning-suspension" | "plan-resumption" | "implementation-complete";
  date: string;
  label: string;
}
