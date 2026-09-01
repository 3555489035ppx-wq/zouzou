# Weekend / Date / Dining verification

| 功能 | UI | 数据 | Persistence | 多用户 | Test | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 周末创建与候选 | `/weekend` 渐进式创建页 | `GroupPlan(type=weekend)` 与知识库地点候选 | SQLite | 邀请加入后可共同投票 | 核心仓储测试 | 已实现 |
| 周末 Journey | 结果锁定后显示地图与时间线 | `GroupJourney`、已选候选 | SQLite | 所有成员看到同一结果 | 核心仓储测试 | 已实现 |
| 约会创建与一起选 | `/date` 渐进式创建页 | `GroupPlan(type=date)`、约会阶段与偏好 | SQLite | 邀请链接加入 | 核心仓储测试 | 已实现 |
| 聚餐筛选 | `/dining` 创建页 | 人数、预算、忌口、菜系与城市知识库 | SQLite | 共享计划 | 候选创建测试 | 已实现 |
| 聚餐多轮决策 | 餐厅投票后自动出现时间投票 | `Poll(single)` → `Poll(time)` | SQLite | SSE 更新 | 结果锁定测试 | 已实现 |
| 邀请 | 复制 `/group-plans/invite/:code` | Invite code、真实 participant | SQLite | 朋友加入同一计划 | 权限测试 | 已实现 |
| 真实投票 | 候选、票数、百分比、撤销选择 | Poll / option / vote | SQLite | SSE，服务端事件 | 并发与改票测试 | 已实现 |
| 平票 | 截止后明确显示平票与决策入口 | 关闭态 Poll | SQLite | 同步显示 | 平票与 resolve 测试 | 已实现 |
| 截止与锁定 | 创建时可设置截止，组织者可手动截止 | deadline / status | SQLite | 同步显示 | deadline 测试 | 已实现 |
| 聚餐记账入口 | Journey 完成后进入现有费用记录 | 复用现有 Journey Tools | 现有浏览器持久化 | 当前费用工具为个人记录 | 现有工具测试 | 已接入 |

## 已执行验证

- `pnpm typecheck`
- `pnpm test -- server/group-plans.test.ts`

实时功能通过服务端 SSE 在同一计划的多个浏览器会话间推送；计划、成员、投票和 Journey 在 `data/group-plans.local.sqlite` 中持久化。
