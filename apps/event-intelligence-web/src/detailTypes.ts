import type { Impact } from "./types";

export type DetailTabId = "overview" | "versions" | "evidence" | "impact" | "ai";
export type ClaimKind = "fact" | "opinion" | "inference" | "rumor";
export type EvidenceGrade = "A" | "B" | "C" | "D";

export interface DetailSourceRef {
  sourceId: string;
  title: string;
  publisher: string;
  sourceType: string;
  publishedAt: string | null;
  fetchedAt: string | null;
  url: string | null;
  documentId: string | null;
  isFirstParty: boolean;
  isReprint: boolean;
  originalSource: string | null;
  excerpt: string;
  evidenceGrade: EvidenceGrade;
  evidenceGradeReason: string;
  evidenceWeight: number;
  weightNote: string;
  claimIds: string[];
  relationToPrevious: string;
}

export interface DetailClaim {
  claimId: string;
  text: string;
  kind: ClaimKind;
  kindLabel: string;
  verification: string;
  sourceIds: string[];
  evidenceGrade: EvidenceGrade;
  applicability: string;
  appliesToCurrentConclusion: boolean;
}

export interface DetailVersion {
  version: number;
  label: string;
  occurredAt: string;
  disclosedAt: string;
  fetchedAt: string;
  analysisUpdatedAt: string;
  confirmationStatus: string;
  confirmationLabel: string;
  executionStatus: string;
  executionLabel: string;
  conclusion: string;
  conclusionDelta: string;
  relationToPrevious: string | null;
  sourceIds: string[];
  claimIds: string[];
}

export interface DetailConflict {
  conflictId: string;
  title: string;
  description: string;
  resolution: string;
  relation: string;
  sourceIds: string[];
}

export interface DetailCompanyImpact {
  companyId: string;
  companyName: string;
  ticker: string;
  direction: Impact;
  directionLabel: string;
  confidence: number;
  positiveFactors: string[];
  negativeFactors: string[];
  uncertainties: string[];
  basisClaimIds: string[];
  sourceIds: string[];
}

export interface DetailMarketObservation {
  observationId: string;
  companyId: string;
  companyName: string;
  window: string;
  beforeDate: string;
  afterDate: string;
  beforeClose: number;
  afterClose: number;
  returnPct: number;
  volumeRatio: number | null;
  turnoverAmountRatio: number | null;
  benchmarkReturnPct: number | null;
  excessVsBenchmarkPp: number | null;
  reactionLabel: string;
  interpretation: string;
  priceSourceIds: string[];
  dataSourceNames: string[];
  rawFieldPath: string;
}

export interface DetailMarketModel {
  available: boolean;
  disclosureAnchor: string | null;
  reactionStatus: string;
  statusNote: string;
  frequency: string;
  benchmarkName: string | null;
  minuteDataStatus: string;
  minuteDataNote: string;
  observations: DetailMarketObservation[];
  formulae: Record<string, string>;
  limitations: string[];
  fixedDisclaimer: string;
}

export interface DetailAiRecord {
  runId: string;
  promptVersion: string;
  currentMode: string;
  provider: string;
  providerId: string;
  providerName: string;
  modelName: string;
  analysisTime: string;
  validationStatus: string;
  schemaValidation: string;
  referenceValidation: string;
  businessValidation: string;
  visualWriteAllowed: boolean;
  onlineProviderStatus: string;
  onlineProviderMessage: string;
  fallbackStatus: string;
  validationChecks: Array<{ name: string; status: string }>;
  warnings: string[];
  toolAvailability: Array<{ tool: string; available: boolean; reason: string | null }>;
  relatedToolCalls: Array<{ callId: string; tool: string; status: string; query: string; sourceIds: string[] }>;
  dataLimitations: string[];
}

export interface EventDetailViewModel {
  eventId: string;
  title: string;
  isMain: boolean;
  snapshotDate: string;
  snapshotLabel: string;
  currentConclusion: string;
  confirmationStatus: string;
  confirmationLabel: string;
  executionStatus: string;
  executionLabel: string;
  earliestSource: DetailSourceRef | null;
  earliestSourceCaveat: string;
  companies: Array<{ companyId: string; name: string; ticker: string }>;
  sourceCount: number;
  weightedSourceCount: number;
  evidenceGrade: EvidenceGrade;
  latestConclusionDelta: string;
  unknowns: string[];
  versions: DetailVersion[];
  claims: DetailClaim[];
  sources: DetailSourceRef[];
  conflicts: DetailConflict[];
  impacts: DetailCompanyImpact[];
  market: DetailMarketModel;
  ai: DetailAiRecord;
}
