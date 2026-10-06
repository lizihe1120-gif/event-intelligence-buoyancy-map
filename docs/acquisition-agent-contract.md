# Acquisition Agent Contract（仅接口约定）

状态：draft / no implementation  
目的：未来把公告、新闻、研报、互动和行情采集从主应用中分离。本阶段不开发Agent。

## 设计原则

- 输入和输出均为JSON，可序列化、可重放。
- 采集只返回来源和候选关系，不把模型推断伪装为事实。
- 去重保留原始出处；转载页必须指向或注明原始发布者。
- 所有时间使用ISO 8601并带时区；未知的事件发生时间为`null`。
- 不记录密钥、Cookie、授权头或未经脱敏的个人数据。
- 单个来源失败不应使整批任务失败；错误进入`failures`。

## 输入

```json
{
  "request_id": "uuid",
  "companies": [
    {
      "company_id": "cmp-cssc",
      "name": "中国船舶工业股份有限公司",
      "ticker": "600150",
      "exchange": "SSE",
      "aliases": ["中国船舶", "CSSC上市平台"]
    }
  ],
  "keywords": ["换股吸收合并", "中国重工", "同业竞争"],
  "source_types": ["announcement", "news", "research", "interaction", "regulatory", "market_data"],
  "time_range": {
    "start": "2019-01-01T00:00:00+08:00",
    "end": "2026-10-05T23:59:59+08:00"
  },
  "max_results": 50,
  "preferred_providers": ["ifind", "fuyao", "exchange", "company", "regulator", "public_web"],
  "language": "zh-CN"
}
```

### 输入约束

- `companies`：1–20个；至少提供名称或代码之一。
- `keywords`：0–30个；Agent可扩展别名，但必须在输出中说明。
- `source_types`：枚举，不接受自由执行指令。
- `time_range`：闭区间；未提供时使用调用方明确的默认值，不得无限回溯。
- `max_results`：1–200；这是去重前抓取上限还是去重后返回上限必须由实现固定并写入版本说明。

## 输出

```json
{
  "request_id": "uuid",
  "agent_version": "0.1.0",
  "started_at": "2026-10-05T14:00:00+08:00",
  "completed_at": "2026-10-05T14:10:00+08:00",
  "sources": [
    {
      "source_id": "stable-id",
      "source_type": "announcement",
      "title": "...",
      "url": "https://...",
      "document_id": "provider-document-id",
      "publisher": "...",
      "published_at": "2024-09-03T00:00:00+08:00",
      "fetched_at": "2026-10-05T14:02:00+08:00",
      "is_first_party": true,
      "is_reprint": false,
      "original_source": null,
      "excerpt": "仅保留支撑判断的短摘录",
      "matched_company_ids": ["cmp-cssc"],
      "matched_keywords": ["换股吸收合并"],
      "content_hash": "sha256:..."
    }
  ],
  "fetch_log": [
    {
      "provider": "exchange",
      "query": "结构化查询摘要，不含密钥",
      "called_at": "...",
      "status": "success",
      "result_count": 4
    }
  ],
  "failures": [
    {
      "provider": "ifind",
      "target": "announcement-search",
      "failed_at": "...",
      "error_code": "PROVIDER_UNAVAILABLE",
      "message": "可安全展示的错误摘要",
      "retryable": true
    }
  ],
  "duplicate_candidates": [
    {
      "canonical_source_id": "src-a",
      "duplicate_source_ids": ["src-b"],
      "reason": "same_document_id",
      "confidence": 1.0
    }
  ],
  "event_clusters": [
    {
      "cluster_id": "cluster-1",
      "candidate_title": "...",
      "source_ids": ["src-a", "src-c"],
      "reason": "共享公司、交易对手、关键词和时间窗口",
      "confidence": 0.86,
      "needs_human_review": true
    }
  ],
  "new_entities": [
    {
      "entity_type": "company",
      "name": "中船柴油机有限公司",
      "aliases": [],
      "discovered_in_source_ids": ["src-c"],
      "reason": "交易标的",
      "confidence": 0.97
    }
  ]
}
```

## 去重候选规则

按强到弱使用：相同`document_id`、规范化URL、内容哈希、标题+发布主体+发布时间、正文高相似度。只有明确同源转载时才自动合并；独立采访、独立研报和对同一公告的不同分析不得仅因主题相同而合并。

## 事件聚类边界

Agent只输出“可能属于同一事件”的候选，不直接写入正式`events.json`。事件合并需要后续分析层确认：主体/客体一致、交易形式兼容、时间连续、后文明确引用前文，且不存在同名不同交易。

## 错误与重试

建议错误码：`PROVIDER_UNAVAILABLE`、`AUTH_REQUIRED`、`RATE_LIMITED`、`NOT_FOUND`、`PARSE_FAILED`、`ROBOTS_BLOCKED`、`TIMEOUT`、`UNSUPPORTED_SOURCE`。重试必须指数退避并设上限；认证失败不得在日志中输出凭据。

## 与当前数据文件的边界

采集Agent未来负责候选来源、日志、失败、去重和事件聚类候选；它不负责最终的事实/观点分类、利好利空判断、落地状态和版本差异。这些仍由分析层写入`analysis.json`和`events.json`。

