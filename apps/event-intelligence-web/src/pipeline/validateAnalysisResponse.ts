import type { AnalysisResponseArtifact, ValidationResult } from "./types";
import { analysisResponseSchema } from "./buildAnalysisPrompt";

const claimTypes = new Set(["fact", "opinion", "inference", "rumor"]);
const relations = new Set(["supports", "supplements", "updates", "denies", "corrects", "supersedes"]);
const impacts = new Set(["positive", "negative", "mixed", "unclear"]);
const confirmationStatuses = new Set(["rumor", "pending_confirmation", "partially_confirmed", "confirmed", "denied", "corrected"]);
const executionStatuses = new Set(["not_started", "planning", "pending_approval", "pending_execution", "implementing", "in_progress", "completed", "terminated", "expired", "unknown"]);
const forbiddenPriceFields = new Set(["price", "stock_price", "last_close", "close_cny", "return_pct", "volume", "volume_ratio", "turnover", "turnover_amount"]);

type JsonSchema = Record<string, any>;

function schemaErrors(value: unknown, schema: JsonSchema, path = "$", errors: string[] = []): string[] {
  if (schema.anyOf) {
    const matches = schema.anyOf.some((candidate: JsonSchema) => schemaErrors(value, candidate, path, []).length === 0);
    if (!matches) errors.push(`${path} 不符合 anyOf`);
    return errors;
  }
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path} 必须等于 ${String(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} 不在允许枚举中`);
  if (schema.type === "null") {
    if (value !== null) errors.push(`${path} 必须为 null`);
    return errors;
  }
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${path} 必须为 object`);
      return errors;
    }
    const record = value as Record<string, unknown>;
    (schema.required ?? []).forEach((key: string) => { if (!(key in record)) errors.push(`${path}.${key} 为必填字段`); });
    if (schema.additionalProperties === false) Object.keys(record).forEach((key) => { if (!schema.properties?.[key]) errors.push(`${path}.${key} 不允许出现`); });
    Object.entries(schema.properties ?? {}).forEach(([key, child]) => { if (key in record) schemaErrors(record[key], child as JsonSchema, `${path}.${key}`, errors); });
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) errors.push(`${path} 必须为 array`);
    else {
      if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} 数量不足`);
      if (schema.items) value.forEach((item, index) => schemaErrors(item, schema.items, `${path}[${index}]`, errors));
    }
  } else if (schema.type === "string" && typeof value !== "string") errors.push(`${path} 必须为 string`);
  else if (schema.type === "number" && typeof value !== "number") errors.push(`${path} 必须为 number`);
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} 小于最小值`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} 大于最大值`);
  }
  return errors;
}

function isIsoTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value) && !Number.isNaN(Date.parse(value));
}

function findForbiddenFields(value: unknown, path = "$", found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item, index) => findForbiddenFields(item, `${path}[${index}]`, found));
  else if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (forbiddenPriceFields.has(key)) found.push(`${path}.${key}`);
      findForbiddenFields(item, `${path}.${key}`, found);
    });
  }
  return found;
}

export function validateAnalysisResponse(input: {
  response: AnalysisResponseArtifact;
  runId: string;
  validatedAt: string;
  companyIds: string[];
  eventIds: string[];
  sourceIds: string[];
}): ValidationResult {
  const errors: string[] = [];
  const warnings = [
    "confirmed、completed与市场已经完全定价是三个独立概念。",
    "suspended是交易状态，不是negative影响方向。",
    "行情变化只作观察，不证明事件因果。"
  ];
  const rejectedFields = findForbiddenFields(input.response);
  const jsonSchemaErrors = schemaErrors(input.response, analysisResponseSchema);
  errors.push(...jsonSchemaErrors.map((error) => `JSON Schema：${error}`));
  if (rejectedFields.length > 0) errors.push(`AI响应包含禁止的行情字段：${rejectedFields.join("、")}`);
  const companyIds = new Set(input.companyIds);
  const eventIds = new Set(input.eventIds);
  const sourceIds = new Set(input.sourceIds);
  const claimIds = new Set(input.response.claims.map((claim) => claim.claim_id));

  if (input.response.run_id !== input.runId) errors.push("run_id与当前运行不一致");
  if (input.response.model_name !== "unknown") errors.push("保存运行不得猜测模型名称");
  input.response.claims.forEach((claim) => {
    if (!claimTypes.has(claim.claim_type)) errors.push(`非法claim_type：${claim.claim_id}/${claim.claim_type}`);
    claim.source_ids.forEach((id) => { if (!sourceIds.has(id)) errors.push(`不存在的source_id：${id}`); });
    claim.basis_claim_ids.forEach((id) => { if (!claimIds.has(id)) errors.push(`不存在的basis_claim_id：${id}`); });
  });

  input.response.event_clusters.forEach((event) => {
    if (!eventIds.has(event.event_id)) errors.push(`不存在的event_id：${event.event_id}`);
    if (!confirmationStatuses.has(event.confirmation_status)) errors.push(`非法confirmation_status：${event.event_id}/${event.confirmation_status}`);
    if (!executionStatuses.has(event.execution_status)) errors.push(`非法execution_status：${event.event_id}/${event.execution_status}`);
    if (event.relation_to_previous !== null && !relations.has(event.relation_to_previous)) errors.push(`非法relation_to_previous：${event.event_id}`);
    event.company_ids.forEach((id) => { if (!companyIds.has(id)) errors.push(`不存在的company_id：${id}`); });
    event.source_ids.forEach((id) => { if (!sourceIds.has(id)) errors.push(`不存在的source_id：${id}`); });
    event.claim_ids.forEach((id) => { if (!claimIds.has(id)) errors.push(`不存在的claim_id：${id}`); });
    event.impact_by_company.forEach((impact) => {
      if (!companyIds.has(impact.company_id)) errors.push(`影响项引用不存在的company_id：${impact.company_id}`);
      if (!impacts.has(impact.direction)) errors.push(`非法impact：${event.event_id}/${impact.direction}`);
      impact.source_ids.forEach((id) => { if (!sourceIds.has(id)) errors.push(`不存在的source_id：${id}`); });
      impact.basis_claim_ids.forEach((id) => { if (!claimIds.has(id)) errors.push(`不存在的basis_claim_id：${id}`); });
      const suspensionOnly = impact.direction === "negative" && impact.negative_factors.length > 0 && impact.negative_factors.every((factor) => /停牌|suspended/i.test(factor));
      if (suspensionOnly) errors.push(`停牌不能单独推导negative：${event.event_id}/${impact.company_id}`);
    });
    event.versions.forEach((version) => {
      if (!confirmationStatuses.has(version.confirmation_status)) errors.push(`非法版本confirmation_status：${event.event_id}/V${version.version}`);
      if (!executionStatuses.has(version.execution_status)) errors.push(`非法版本execution_status：${event.event_id}/V${version.version}`);
      if (!isIsoTime(version.disclosed_at) || !isIsoTime(version.analysis_updated_at)) errors.push(`非法时间格式：${event.event_id}/V${version.version}`);
      if (Date.parse(version.analysis_updated_at) < Date.parse(version.disclosed_at)) errors.push(`分析更新时间早于披露时间：${event.event_id}/V${version.version}`);
      if (version.occurred_at && !isIsoTime(version.occurred_at)) errors.push(`非法occurred_at：${event.event_id}/V${version.version}`);
      version.source_ids.forEach((id) => { if (!sourceIds.has(id)) errors.push(`不存在的source_id：${id}`); });
      version.claim_ids.forEach((id) => { if (!claimIds.has(id)) errors.push(`不存在的claim_id：${id}`); });
      if (version.confirmation_status === "confirmed") {
        const types = version.claim_ids.map((id) => input.response.claims.find((claim) => claim.claim_id === id)?.claim_type).filter(Boolean);
        if (types.length > 0 && types.every((type) => type === "opinion" || type === "rumor")) errors.push(`opinion或rumor不能单独确认事实：${event.event_id}/V${version.version}`);
      }
    });
  });

  const passed = errors.length === 0;
  return {
    run_id: input.runId,
    passed,
    errors,
    warnings,
    validated_at: input.validatedAt,
    rejected_fields: rejectedFields,
    applicable_event_count: passed ? input.response.event_clusters.length : 0,
    checks: {
      json_schema_shape: jsonSchemaErrors.length === 0 ? "passed" : "failed",
      reference_integrity: errors.some((error) => /不存在/.test(error)) ? "failed" : "passed",
      enum_integrity: errors.some((error) => /非法.*(?:status|impact|claim|relation)/.test(error)) ? "failed" : "passed",
      time_integrity: errors.some((error) => /时间|occurred_at/.test(error)) ? "failed" : "passed",
      price_field_guard: rejectedFields.length === 0 ? "passed" : "failed",
      fact_confirmation_guard: errors.some((error) => /不能单独确认事实/.test(error)) ? "failed" : "passed",
      state_separation: errors.some((error) => /停牌不能/.test(error)) ? "failed" : "passed"
    },
    elapsed_ms: 3
  };
}
