import { companyPoint, eventPoint, versionBubbleSize, versionPoint, type Point } from "./layout";
import { buildLiquidBridge, relationVisualSpecs } from "./relationGeometry";
import type { EventViewModel, Impact, PageViewModel, RelationStage } from "./types";

const stageLabels: Record<RelationStage, string> = {
  drifting: "游离",
  lifting: "托举",
  approaching: "靠近",
  stable_fusion: "稳定融合",
  cooling: "冷却或断开"
};

const impactLabels: Record<Impact, string> = {
  positive: "利多",
  negative: "利空",
  mixed: "混合",
  unclear: "暂不明确"
};

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function paintFor(impact: Impact, gradientId: string): string {
  if (impact === "mixed") return `url(#${gradientId})`;
  if (impact === "positive") return "#f0444e";
  if (impact === "negative") return "#35b875";
  return "#d6e1e1";
}

interface LiquidBridgeProps {
  id: string;
  from: Point;
  to: Point;
  fromRadius: number;
  toRadius: number;
  stage: RelationStage;
  impact: Impact;
  label: string;
  dimmed: boolean;
  highlighted: boolean;
  kind: "evidence-event" | "event-company";
}

export function LiquidBridge({
  id,
  from,
  to,
  fromRadius,
  toRadius,
  stage,
  impact,
  label,
  dimmed,
  highlighted,
  kind
}: LiquidBridgeProps) {
  const geometry = buildLiquidBridge(
    { center: from, radius: fromRadius },
    { center: to, radius: toRadius },
    stage
  );
  const gradientId = `relation-gradient-${safeId(id)}`;
  const paint = paintFor(impact, gradientId);
  const interactionClass = highlighted ? " is-highlighted" : dimmed ? " is-dimmed" : "";
  const spec = relationVisualSpecs[stage];

  return (
    <g
      className={`liquid-link liquid-link--${kind} relation-link--${stage} impact-link--${impact}${interactionClass}`}
      role="img"
      aria-label={`${label}；关系状态：${stageLabels[stage]}；影响方向：${impactLabels[impact]}`}
      data-link-id={id}
      data-relation-stage={stage}
      data-impact={impact}
      data-shape-cue={spec.shapeCue}
    >
      {impact === "mixed" && (
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={from.x} y1={from.y} x2={to.x} y2={to.y}>
            <stop offset="0%" stopColor="#f0444e" />
            <stop offset="43%" stopColor="#f0444e" />
            <stop offset="50%" stopColor="#d6e1e1" stopOpacity="0.72" />
            <stop offset="57%" stopColor="#35b875" />
            <stop offset="100%" stopColor="#35b875" />
          </linearGradient>
        </defs>
      )}
      <path className="relation-guide" d={geometry.guidePath} />
      {geometry.solidPath && (
        <path
          className="relation-body"
          d={geometry.solidPath}
          fill={paint}
          opacity={spec.opacity}
        />
      )}
      {geometry.residuePaths.map((path, index) => (
        <path
          key={`${id}-residue-${index}`}
          className="relation-residue"
          d={path}
          fill={paint}
          opacity={spec.opacity}
        />
      ))}
      {stage === "cooling" && (
        <circle
          className="relation-cooling-spark"
          cx={(from.x + to.x) / 2}
          cy={(from.y + to.y) / 2}
          r="2.2"
          fill={paint}
        />
      )}
    </g>
  );
}

function EventAssetLinks({
  event,
  page,
  activeEventIds,
  activeCompanyIds,
  interactionActive
}: {
  event: EventViewModel;
  page: PageViewModel;
  activeEventIds: Set<string>;
  activeCompanyIds: Set<string>;
  interactionActive: boolean;
}) {
  const from = eventPoint(event);
  if (!from) return null;

  return event.companyIds.map((companyId) => {
    const company = page.companies.find((candidate) => candidate.id === companyId);
    const to = company ? companyPoint(company) : null;
    if (!company || !to) return null;
    const impact = event.companyImpacts[companyId] ?? "unclear";
    const highlighted = activeEventIds.has(event.id) && activeCompanyIds.has(companyId);
    return (
      <LiquidBridge
        key={`${event.id}-${companyId}`}
        id={`event-${event.id}-company-${companyId}`}
        from={from}
        to={to}
        fromRadius={event.size / 2}
        toRadius={company.size / 2}
        stage={event.relationStage}
        impact={impact}
        label={`${event.title}到${company.name}`}
        kind="event-company"
        dimmed={interactionActive && !highlighted}
        highlighted={highlighted}
      />
    );
  });
}

function EvidenceLinks({
  event,
  activeEventIds,
  interactionActive
}: {
  event: EventViewModel;
  activeEventIds: Set<string>;
  interactionActive: boolean;
}) {
  const to = eventPoint(event);
  if (!to) return null;
  const highlighted = activeEventIds.has(event.id);

  return event.versions.map((version, index) => {
    const from = versionPoint(event, version, index);
    if (!from) return null;
    return (
      <LiquidBridge
        key={version.id}
        id={`version-${version.id}-event-${event.id}`}
        from={from}
        to={to}
        fromRadius={versionBubbleSize(version.relationStage) / 2}
        toRadius={event.size / 2}
        stage={version.relationStage}
        impact={version.impact}
        label={`版本V${version.version}到${event.title}`}
        kind="evidence-event"
        dimmed={interactionActive && !highlighted}
        highlighted={highlighted}
      />
    );
  });
}

export function RelationLayer({
  page,
  activeEventIds,
  activeCompanyIds,
  interactionActive
}: {
  page: PageViewModel;
  activeEventIds: Set<string>;
  activeCompanyIds: Set<string>;
  interactionActive: boolean;
}) {
  return (
    <g className="relation-layer" aria-label="证据、事件与公司关系层">
      {page.events.map((event) => (
        <EventAssetLinks
          key={`assets-${event.id}`}
          event={event}
          page={page}
          activeEventIds={activeEventIds}
          activeCompanyIds={activeCompanyIds}
          interactionActive={interactionActive}
        />
      ))}
      {page.events.map((event) => (
        <EvidenceLinks
          key={`evidence-${event.id}`}
          event={event}
          activeEventIds={activeEventIds}
          interactionActive={interactionActive}
        />
      ))}
    </g>
  );
}
