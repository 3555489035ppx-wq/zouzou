# 走走｜数据模型与持久化

## 核心旅行对象

- `TripIntent`：目的地、日期/天数、人数、预算范围、节奏、必去、偏好、限制、饮食、到离站锚点、酒店和缺失信息。
- `TripUnderstanding`：意图、证据、摘要、媒体事实、攻略上下文和来源 Provider。
- `GeneratedPlan`：方案标签、预算、步行量、节奏、城市、日期、每日 `PlannedStop`、预算分解、校验报告、知识库来源。
- `PlannedStop`：时间、地点、停留、交通、经纬度、坐标系、POI 解析状态、营业时间、事实来源和可信状态。
- `TripMedia/MediaFact`：上传文件元数据与截图解析事实；低置信度事实必须标记待确认。

所有上述跨网络、存储和 AI 边界的数据由 `src/services/trip/schemas.ts` 解析；服务端 `normalizeTripIntent` 也会再次校验。

## 协作对象

`GroupPlan` 包含 owner、参与者、邀请码、候选项、Poll、投票记录、状态和最终 `GroupJourney`。投票支持单选、多选和时间三种类型；事件当前为 `plan.updated`。

## 社区对象

社区帖子沿用现有演示数据；评论新增 `commentsByPost`，每条包含 id、postId、author、body、createdAt。当前评论写入版本化本地存储，服务端同步属于 P1 生产接入项。

## 本地存储

`src/services/storage.ts` 使用版本化 envelope，当前版本为 `1`。Zustand 持久化包括旅行路线/状态、流程状态、点赞收藏关注、评论、费用、打包、足迹和 onboarding 标记。读取失败会回退默认值，不阻塞首屏。

协作服务的浏览器用户标识存储为 `zouzou-group-plan-user-id`；服务端本地 SQLite 默认位于 `data/group-plans.local.sqlite`，不应提交到仓库。

## 外部事实示例

上海博物馆东馆作为上海知识库的室内候选，地址和开放时间必须在出发日通过官方渠道核验；来源记录在城市知识规格中：[上海博物馆参观服务](https://www.shanghaimuseum.net/mu/frontend/pg/service/visit-east)。
