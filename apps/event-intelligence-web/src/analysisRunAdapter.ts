import acquisitionJson from "../../../data/demo-runs/material-analysis-001/acquisition-output.json";
import analysisRequestJson from "../../../data/demo-runs/material-analysis-001/analysis-request.json";
import analysisResponseJson from "../../../data/demo-runs/material-analysis-001/analysis-response.json";
import clusteringJson from "../../../data/demo-runs/material-analysis-001/clustering-result.json";
import deduplicationJson from "../../../data/demo-runs/material-analysis-001/deduplication-result.json";
import runJson from "../../../data/demo-runs/material-analysis-001/run.json";
import validationJson from "../../../data/demo-runs/material-analysis-001/validation-result.json";
import visualJson from "../../../data/demo-runs/material-analysis-001/visual-result.json";

export interface AnalysisProcessStep {
  index: number;
  title: string;
  status: "完成" | "失败";
  metric: string;
  duration: string;
  summary: string;
  result: string;
  limitation: string;
}

export const analysisRun = {
  id: runJson.run_id,
  status: runJson.status,
  promptVersion: runJson.prompt_version,
  modelName: runJson.model_name,
  completedAt: runJson.completed_at,
  sourceCount: runJson.source_count,
  eventCount: runJson.event_count,
  validationPassed: validationJson.passed,
  visualApplied: runJson.visual_result_applied
};

export const analysisProcessSteps: AnalysisProcessStep[] = [
  {
    index: 1,
    title: "Agent 来源快照",
    status: "完成",
    metric: `${acquisitionJson.source_count} 份材料`,
    duration: `${acquisitionJson.elapsed_ms} ms`,
    summary: "把第一阶段已封板来源和工具调用日志冻结为 acquisition-001。",
    result: `${acquisitionJson.sources.length} 个 source_id 均保留原链接、发布时间、发布主体和摘录。`,
    limitation: "使用已保存快照；本轮没有运行真实爬虫或外部采集 Agent。"
  },
  {
    index: 2,
    title: "精确去重与转载识别",
    status: "完成",
    metric: `${deduplicationJson.canonical_source_count} 份计权证据`,
    duration: `${deduplicationJson.elapsed_ms} ms`,
    summary: "按文档 ID、规范化 URL、内容哈希和发布主体/标题/时间做精确去重，并识别近重复与转载。",
    result: `${deduplicationJson.exact_duplicate_groups.length} 个精确重复组；${deduplicationJson.near_duplicate_groups.length} 个近重复组；转载仍可追溯但不重复计权。`,
    limitation: "镜像或转载的记录不会删除；证据权重与来源可追溯性分开保存。"
  },
  {
    index: 3,
    title: "同一事件聚类",
    status: "完成",
    metric: `${clusteringJson.cluster_count} 个事件`,
    duration: `${clusteringJson.elapsed_ms} ms`,
    summary: "依据结构化事件关联，再用公司、类型、关键实体数字与时间承接做确定性核验。",
    result: clusteringJson.clusters.map((cluster) => cluster.event_title).join("；"),
    limitation: `轮廓系数 ${clusteringJson.silhouette_coefficient.value ?? "不可计算"} 仅作诊断，不决定去重、归属或固定 K。`
  },
  {
    index: 4,
    title: "AI 请求生成",
    status: "完成",
    metric: analysisRequestJson.prompt_version,
    duration: `${analysisRequestJson.elapsed_ms} ms`,
    summary: "Prompt Builder 生成 system prompt、结构化 user prompt 和严格 JSON Schema。",
    result: "约束逐公司影响、双状态、主张类型、真实 source_id 和禁止生成行情字段。",
    limitation: "provider_mode 为 saved_result；本轮不调用在线模型。"
  },
  {
    index: 5,
    title: "AI 分析结果",
    status: "完成",
    metric: `${analysisResponseJson.event_clusters.length} 个事件 / ${analysisResponseJson.claims.length} 条主张`,
    duration: `${runJson.stage_timings_ms.saved_analysis_provider} ms`,
    summary: "SavedAnalysisProvider 读取本次固定分析产物，保留事件版本和逐公司影响差异。",
    result: `模型名称 ${analysisResponseJson.model_name}；每个判断均回链 claim_id 与 source_id。`,
    limitation: "结果是保存运行产物，不代表本轮发生了外部 AI API 调用。"
  },
  {
    index: 6,
    title: "结构与引用校验",
    status: validationJson.passed ? "完成" : "失败",
    metric: validationJson.passed ? "全部通过" : `${validationJson.errors.length} 个错误`,
    duration: `${validationJson.elapsed_ms} ms`,
    summary: "检查 Schema、引用、枚举、时间顺序、禁止行情字段和状态语义分离。",
    result: `${Object.values(validationJson.checks).filter((status) => status === "passed").length} 项检查通过；${validationJson.rejected_fields.length} 个字段被拒绝。`,
    limitation: "任何错误都会把最终可应用事件数量置为 0，并阻断视觉模型生成。"
  },
  {
    index: 7,
    title: "应用到事件浮力图",
    status: visualJson.validation_run_passed ? "完成" : "失败",
    metric: `${visualJson.snapshots.length} 个快照`,
    duration: `${runJson.stage_timings_ms.visual_model} ms`,
    summary: "VisualModelBuilder 把通过校验的逐公司影响、双状态和版本关系转成页面 ViewModel。",
    result: `${visualJson.companies.length} 个公司节点；颜色、关系阶段和气泡大小由 visual-result.json 驱动。`,
    limitation: "关系阶段由 visual-result 确定性驱动；SVG 液态视觉不改变事件结论或市场反应状态。"
  }
];

export const processNotices = [
  "来源采集使用已保存的 18 份材料快照。",
  "AI 结果是本次保存的分析运行产物，模型名称保持 unknown。",
  "iFinD 和扶摇当前不可用，未记录或展示虚构的成功调用。",
  "行情变化不证明事件因果；分析结果不构成投资建议。"
];
