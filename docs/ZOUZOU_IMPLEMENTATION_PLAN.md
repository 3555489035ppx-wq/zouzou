# 走走｜完整化实施计划与执行记录

> 版本：2026-08-31
> 目标：在保留现有演示资产的前提下，把 Gooh 研究结论迁移为可验证的旅行创建、规划、协作和行程执行能力。

## 固定执行顺序

项目检查 → Gooh 解析 → 动态研究 → 功能筛选 → 旅行知识整理 → 走走功能实现 → 数据接入 → UI 适配 → 测试 → 截图验收 → 最终报告。

## 阶段状态

| 阶段 | 状态 | 验证证据 |
| --- | --- | --- |
| 项目检查 | 已完成 | 分支、脏工作区、路由、脚本、依赖、环境变量和基线截图已核验 |
| Gooh 静态/动态研究 | 已完成 | `research/gooh/`、`docs/BLOUB_RESEARCH.md`、`docs/MAP_BOT_RESEARCH_V3.md` |
| 功能筛选 | 已完成 | P0/P1/P2/P3 优先级按任务书落入本文件 |
| 旅行知识整理 | 已完成 | `data/gooh-knowledge.json`、`src/services/trip/cityKnowledge*`、攻略服务 |
| P0 旅行主链路 | 已完成 | 文本理解 → 三方案 → 方案确认 → 行程进行中 → 完成；状态机和测试已接入 |
| P0 地点/地图降级 | 已完成 | 高德 POI、GCJ-02 标记、路线服务、超时和未匹配降级 |
| P1 协作边界 | 已完成基础能力 | 邀请码、参与者、轮询、投票、SSE、SQLite 本地仓储；正式账号和云数据库仍待生产接入 |
| UI/动效适配 | 已完成 | Safe Area、底部 Tab、Reduce Motion、加载/错误/空态和路线反馈已覆盖；393×852 最终截图已生成 |
| 测试与发布检查 | 已完成 | typecheck、33 文件/197 用例、build、28/28 E2E、release preflight 均已回归 |

## 当前实现范围

### P0

- 旅行创建表单和示例输入。
- TripIntent、TripUnderstanding、TripMedia、GeneratedPlan、PlannedStop 的运行时 Zod 校验。
- XState 旅行主流程：`idle → drafting → understanding → review → planning → plans → deciding → confirmed → active → completed`，并包含错误和重试入口。
- 本地解析器作为 AI 回退；服务端可选 OpenAI/DeepSeek 结构化输出。
- 三个差异化方案、预算分解、知识库依据、必去地点和到离站锚点。
- 高德 POI 解析、路线查询和 MapLibre/OSRM 回退；解析超时会明确展示“地点待确认”，不绘制伪造路线。
- 行程地图、路线播放、足迹、费用、打包、分享等现有执行工具的统一入口。
- Safe Area、状态反馈、错误/空/加载态和 Reduce Motion 适配。

### P1

- Group Plan 数据模型、邀请链接、参与者加入、投票、关闭/解析/重开、SSE 更新和本地 SQLite 仓储。
- 社区评论本地持久化和事件记录；Auth、Database、Storage、Analytics 保留平台 Adapter 边界，方便后续替换为云服务。
- 攻略知识库检索服务与城市候选排序。
- 上传媒体的大小限制、视觉模型可选接入和低置信度事实标记。

### P2/P3 明确不阻塞本轮

OCR 离线包、完整离线地图/PWA、拖拽排序、Yjs 多人实时编辑、真实 3D 城市、原生 Haptic、商店上架、真实订单/库存和生产级账号体系均记录为发布缺口，不用演示数据冒充已完成。

## 关键证据目录

- 基线截图：`research/taskbook-baseline/`
- Gooh 解析与研究：`research/gooh/`
- 旅行知识库：`data/gooh-knowledge.json`、`src/services/trip/`
- 测试：`src/**/*.test.ts`、`tests/`
- 运行命令：`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm test:e2e`
- 最终截图：`research/taskbook-final/`

## 约束

- 不提交、推送、合并或部署。
- 不输出或提交 `.env`、地图密钥和 AI 密钥。
- 保留任务开始前已存在的脏工作区改动；所有新增改动与原有改动一起交由用户审阅。
