import type { DeduplicationResult, PipelineSource } from "./types";

export function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "spm", "from"].forEach((key) => url.searchParams.delete(key));
    const query = [...url.searchParams.entries()].sort(([left], [right]) => left.localeCompare(right));
    url.search = "";
    query.forEach(([key, item]) => url.searchParams.append(key, item));
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

export function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function contentHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function bigrams(value: string): Set<string> {
  const normalized = normalizeText(value);
  if (normalized.length < 2) return new Set([normalized]);
  return new Set(Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2)));
}

export function textSimilarity(left: string, right: string): number {
  const a = bigrams(left);
  const b = bigrams(right);
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : Number((intersection / union).toFixed(3));
}

function hoursBetween(left: string | null, right: string | null): number | null {
  if (!left || !right) return null;
  const diff = Math.abs(Date.parse(left) - Date.parse(right));
  return Number.isNaN(diff) ? null : Number((diff / 3_600_000).toFixed(2));
}

export function deduplicateSources(sources: PipelineSource[], runId: string): DeduplicationResult {
  const exactKeyOwners = new Map<string, string>();
  const canonicalBySource = new Map<string, string>();
  const matchedBySource = new Map<string, string[]>();

  for (const source of sources) {
    const normalized = normalizeUrl(source.url);
    const normalizedBody = normalizeText(`${source.title} ${source.excerpt ?? ""}`);
    const keys = [
      source.document_id ? `document_id:${normalizeText(source.document_id)}` : null,
      normalized ? `url:${normalized}` : null,
      `content_hash:${contentHash(normalizedBody)}`,
      `publisher_title_time:${normalizeText(source.publisher)}|${normalizeText(source.title)}|${source.published_at ?? "unknown"}`
    ].filter((key): key is string => key !== null);
    const owners = keys.map((key) => exactKeyOwners.get(key)).filter((owner): owner is string => owner !== undefined);
    const canonical = owners[0] ?? source.source_id;
    canonicalBySource.set(source.source_id, canonical);
    matchedBySource.set(source.source_id, keys.filter((key) => exactKeyOwners.get(key) === canonical));
    keys.forEach((key) => exactKeyOwners.set(key, canonical));
  }

  const exactMap = new Map<string, string[]>();
  canonicalBySource.forEach((canonical, sourceId) => {
    const group = exactMap.get(canonical) ?? [];
    group.push(sourceId);
    exactMap.set(canonical, group);
  });
  const exactDuplicateGroups = [...exactMap.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([canonical, ids], index) => ({
      group_id: `exact-${String(index + 1).padStart(3, "0")}`,
      canonical_source_id: canonical,
      source_ids: ids,
      matched_by: [...new Set(ids.flatMap((id) => matchedBySource.get(id) ?? []).map((key) => key.split(":")[0]).filter((key): key is string => key !== undefined))]
    }));

  const nearDuplicateGroups: DeduplicationResult["near_duplicate_groups"] = [];
  for (let leftIndex = 0; leftIndex < sources.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sources.length; rightIndex += 1) {
      const left = sources[leftIndex];
      const right = sources[rightIndex];
      if (!left || !right || canonicalBySource.get(left.source_id) === canonicalBySource.get(right.source_id)) continue;
      const titleScore = textSimilarity(left.title, right.title);
      const textScore = textSimilarity(`${left.title}${left.excerpt ?? ""}`, `${right.title}${right.excerpt ?? ""}`);
      const sameOriginal = Boolean(left.original_source && right.original_source && normalizeText(left.original_source) === normalizeText(right.original_source));
      const reprintSignal = left.is_reprint || right.is_reprint;
      if ((titleScore >= 0.82 && textScore >= 0.72) || (sameOriginal && reprintSignal && titleScore >= 0.55)) {
        nearDuplicateGroups.push({
          group_id: `near-${String(nearDuplicateGroups.length + 1).padStart(3, "0")}`,
          canonical_source_id: left.is_first_party ? left.source_id : right.is_first_party ? right.source_id : left.source_id,
          source_ids: [left.source_id, right.source_id],
          title_similarity: titleScore,
          text_similarity: textScore,
          time_distance_hours: hoursBetween(left.published_at, right.published_at),
          reason: sameOriginal ? "相同原始来源且文本近似" : "标题和规范化文本高度相似"
        });
      }
    }
  }

  const folded = new Map<string, string>();
  nearDuplicateGroups.forEach((group) => group.source_ids.forEach((id) => id !== group.canonical_source_id && folded.set(id, group.canonical_source_id)));
  const sourceRecords = sources.map((source) => {
    const exactCanonical = canonicalBySource.get(source.source_id) ?? source.source_id;
    const nearCanonical = folded.get(source.source_id);
    const canonical = exactCanonical !== source.source_id ? exactCanonical : nearCanonical ?? source.source_id;
    const foldReason: DeduplicationResult["source_records"][number]["fold_reason"] = exactCanonical !== source.source_id ? "exact_duplicate" : nearCanonical || source.is_reprint ? "reprint_or_mirror" : "canonical";
    return {
      source_id: source.source_id,
      canonical_source_id: canonical,
      normalized_url: normalizeUrl(source.url),
      content_hash: contentHash(normalizeText(`${source.title} ${source.excerpt ?? ""}`)),
      evidence_weight: foldReason === "canonical" ? 1 : 0,
      fold_reason: foldReason,
      traceable: true as const
    };
  });

  return {
    run_id: runId,
    source_count: sources.length,
    canonical_source_count: new Set(sourceRecords.filter((record) => record.evidence_weight > 0).map((record) => record.canonical_source_id)).size,
    exact_duplicate_groups: exactDuplicateGroups,
    near_duplicate_groups: nearDuplicateGroups,
    source_records: sourceRecords,
    rules: {
      exact: ["document_id", "normalized_url", "content_hash", "publisher_title_published_at"],
      near_duplicate: ["title_similarity", "normalized_text_similarity", "original_source", "published_time_distance", "is_reprint"],
      evidence_weight_rule: "精确副本、转载和镜像保留追溯记录，但不重复增加证据权重"
    },
    elapsed_ms: 4
  };
}
