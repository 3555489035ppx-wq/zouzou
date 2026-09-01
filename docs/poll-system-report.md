# Poll system report

## 数据模型

`GroupPlan` 保存场景、约束、参与者、投票和最终 Journey。参与者有 `owner` / `member` 角色以及邀请状态。`Poll` 包含状态、类型、截止时间、是否可改票、候选和获胜项。候选为来自现有城市 Knowledge Base 的真实命名地点及其坐标、价格、区域和营业提示；投票记录按 participant 保存。

持久层使用 Node 内置 SQLite：`group_plans` 保存计划聚合，`poll_single_votes` 的主键为 `(poll_id, participant_id)`，`poll_multi_votes` 的主键为 `(poll_id, participant_id, option_id)`。这两项唯一约束分别保证单选只能有一个有效选择、多选不能重复同一候选。

## Realtime 与权限

`GET /api/group-plans/:planId/events` 是 SSE 事件流。每次计划、成员、投票或结果变更后，服务端向该计划的已打开会话发送完整的新快照。前端只以服务端快照为准，不在本地伪造票数。

投票时服务端检查 accepted participant；截止、关闭和 resolved 状态都会拒绝写入。组织者才可以关闭、重新开启、添加投票或确定最终方案。

## Deadline、tie、resolve

创建时可设置截止时间，服务端以当前时间检查，过期时拒绝新票。关闭后，若最高票并列，UI 明确显示“平票”；组织者可重新开启一轮（会清空该轮投票）或显式确定一个候选。resolved 后默认锁定。聚餐在餐厅确定后自动创建时间投票，时间确定后才生成最终 Journey。

## Concurrency 与幂等

每个仓储写入排队进入 SQLite `BEGIN IMMEDIATE` 事务。单选写入会替换该 participant 的选择，多选会去重；连续重试同一请求最终仍只有一张有效票。服务端在提交后才发布 SSE 快照。

## Tests

`server/group-plans.test.ts` 覆盖：跨仓储重开后的持久化、连续并发点击、改票、非成员权限、过期截止、多选去重、平票、组织者 resolve、餐厅到时间的多轮投票，以及 resolved 后拒绝新增投票。
