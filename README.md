> 内容过大，完整 GitHub 仓库链接：https://github.com/lizihe1120-gif/event-intelligence-buoyancy-map

演示视频将在录制完成后上传至仓库的 [`outputs/event-intelligence-web/`](https://github.com/lizihe1120-gif/event-intelligence-buoyancy-map/tree/main/outputs/event-intelligence-web/) 目录。

# 事件浮力图 — 独立提交 README

本文件是“事件浮力图”独立提交仓库的根 README 版本。当前单体仓库的根 `README.md` 属于原有主观题评分项目，因此没有覆盖。拆分到独立仓库时，应将本文件复制或重命名为根目录 `README.md`。

完整评审说明位于：[`apps/event-intelligence-web/README.md`](apps/event-intelligence-web/README.md)。该文档覆盖产品问题、目标用户、三快照、Demo 分析管线、数据与 AI 边界、项目架构、安装运行、测试构建、截图、视频和合规声明。

## 一句话说明

“事件浮力图”用证据/版本 → 事件 → 公司的关系图，帮助投资者看清同一重大事件的最初来源、事实变化、确认与执行状态，以及不同上市公司的受影响方向。

## 当前提交事实

- 3 家真实 A 股公司： 中国船舶、中国重工、中国动力。
- 1 个主事件与 3 个辅助事件。
- 3 个演化快照：2024-09-03、2024-09-19、2025-09-16。
- 18 份保存来源、11 份计权证据、4 个事件簇、44 条主张。
- 8 份 `material-analysis-001` 核心分析产物，另有 1 份确定性派生通知产物。
- 运行使用 `SavedAnalysisProvider`；模型名称无法确认，记录为 `unknown`。
- 关键结论通过 `event_id`、`claim_id`、`source_id` 回溯。
- 历史价格和收益率由行情材料及公式得到，不由 AI 生成。
- 当前运行未调用真实爬虫、外部采集 Agent、iFinD、扶摇或在线模型。
- 行情变化只表示时间相关观察，不证明事件因果。
- 不构成投资建议。

## 本地运行

```bash
npm install
npm run dev --workspace @event-intelligence/web -- --host 127.0.0.1 --port 5174
```

访问 `http://127.0.0.1:5174/`。

部署状态：**尚未部署**，没有公网 URL。

## 分析产物、测试与构建

```bash
npm run pipeline:generate --workspace @event-intelligence/web
npm run typecheck --workspace @event-intelligence/web
npm run test --workspace @event-intelligence/web
npm run build --workspace @event-intelligence/web
```

生产构建会重新执行本地分析管线。校验失败的 AI 结果不能进入 `visual-result.json`。

2026-10-06 复验结果：9 份产物生成成功；类型检查通过；8 个测试文件、60 项测试全部通过；生产构建通过；1440×900 与 1366×768 浏览器回归通过。

## 当前未实现

实时抓取、外部采集 Agent、真实在线模型调用、安全服务端代理、API Key 设置、公司详情页、推送、后台任务、实时行情、移动端和公网部署均未实现。第四至第七阶段已经执行；第八阶段的独立仓库、公网URL、最终提交包和最终验收仍未执行。

## 提交材料

- 完整 README：`apps/event-intelligence-web/README.md`
- AI 使用与验证：`docs/AI_USAGE_AND_VALIDATION.md`
- AI Provider 接口：`docs/AI_PROVIDER_INTERFACE.md`
- 演示脚本：`docs/event-intelligence-demo-script.md`
- 截图：`outputs/event-intelligence-web/*.png`
- 视频目标路径：`outputs/event-intelligence-web/event-intelligence-demo.mp4`
