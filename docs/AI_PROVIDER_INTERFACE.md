# AI Provider 接口与演示模式

## 当前模式

“事件浮力图”默认使用 `SavedAnalysisProvider`。它读取 `material-analysis-001` 的保存响应，不需要 API Key、外网或在线模型，因此演示环境可以稳定复现同一组分析结论。当前 18 份来源是已经采集完成的演示输入快照；本阶段没有运行真实爬虫、外部采集 Agent、iFinD 或扶摇。

默认链路是：

```text
固定来源快照
  → 去重与事件聚类
  → Prompt Builder
  → SavedAnalysisProvider
  → JSON Schema / 引用 / 业务规则校验
  → VisualModelBuilder
  → 事件浮力图
```

校验失败时 `VisualModelBuilder` 会拒绝生成结果，页面不会用残缺响应覆盖上一次有效视觉产物。

## 统一接口

`src/pipeline/analysisProvider.ts` 定义统一 `AnalysisProvider`：

- `provider_id`、`provider_name`；
- `mode`：`saved_result` 或 `online`；
- `model`、`prompt_version`、`timeout_ms`；
- `capability/status`；
- `analyze(request)`，返回成功响应或结构化错误。

`SavedAnalysisProvider` 与 `OnlineAnalysisProvider` 实现同一接口。业务分析、校验和视觉适配层只依赖该接口，不依赖具体供应商。

## 固定请求和响应

- Prompt Builder：`apps/event-intelligence-web/src/pipeline/buildAnalysisPrompt.ts`
- 固定请求样例：`data/demo-runs/material-analysis-001/analysis-request.json`
- 保存响应样例：`data/demo-runs/material-analysis-001/analysis-response.json`
- 响应 Schema：由 Prompt Builder 的 `analysisResponseSchema` 生成并写入请求样例
- 校验结果：`data/demo-runs/material-analysis-001/validation-result.json`
- 运行与 Provider 状态：`data/demo-runs/material-analysis-001/run.json`

请求包含 `run_id`、Prompt 版本、公司关系、去重/转载信息、18 份来源元数据及可用摘录、4 个候选事件簇、允许枚举、引用规则和严格 JSON Schema。它同时禁止投资建议、AI 生成行情以及把披露附近的行情变化夸大为因果。

## AI 与确定性程序的职责

AI 保存结果负责：同一事件判断、主张抽取、`fact/opinion/inference/rumor` 分类、版本关系、双状态候选、逐公司影响及不确定因素。

确定性程序负责：

- A–D 证据等级；
- 精确重复、转载与镜像计权；
- JSON Schema、枚举、时间与引用完整性；
- 禁止 AI 输出价格、收益率、成交量等行情字段；
- 防止观点或传闻单独确认事实；
- 防止把停牌当作利空、把完成当作完全定价；
- `relation_stage` 和视觉模型派生；
- 行情公式计算。

关键结论可通过 `event_id`、`claim_id`、`source_id` 追溯。

## OnlineAnalysisProvider 边界

本阶段只实现可替换和可测试的在线接口契约，不发起真实网络请求。它预留 `provider`、`base_url`、`model`、请求格式和超时配置，并定义 HTTP、网络、超时、非 JSON、Schema、引用和业务校验错误码。

当前没有安全服务端代理，因此在线 Provider 状态为 `disabled`，调用会返回：

```text
ONLINE_PROVIDER_REQUIRES_SERVER_PROXY
```

在线失败不会被伪装为成功，也不会静默回退。只有调用方明确允许时才可切换到保存结果，并显示“已明确切换至保存结果”。

## API Key 安全边界

浏览器端不能直接保存或使用模型 API Key。当前接口不接受 API Key 字段，也不把密钥写入 React 持久状态、`localStorage`、`sessionStorage`、URL、演示 JSON、Prompt、日志、错误信息或构建产物。

未来在线接入必须通过安全服务端代理完成：凭据只存在于服务端受控环境，响应仍经过当前同一套 Schema、引用和业务校验。真实采集 Agent 负责“获取材料”，与本阶段的“分析已保存材料”职责不同，不属于当前提交。

## 重新生成与验证

在仓库根目录执行：

```bash
npm run pipeline:generate --workspace @event-intelligence/web
npm run typecheck --workspace @event-intelligence/web
npm run test --workspace @event-intelligence/web
npm run build --workspace @event-intelligence/web
```

生产构建会先重新运行本地保存分析管线。当前演示不构成投资建议；行情变化只表示披露时间附近观察到的变化，不证明事件因果。
