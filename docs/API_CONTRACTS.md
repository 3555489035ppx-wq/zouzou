# 走走｜API 契约

本地 BFF 默认监听 `127.0.0.1:8787`。前端只消费 JSON 结果；所有成功响应在客户端进入 Zod parser，解析失败统一转为 `INVALID_RESPONSE`。

## 旅行与知识

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/health` | AI/视觉 Provider、知识库统计和服务状态 |
| GET | `/api/guides?q=&city=&limit=` | 查询城市攻略候选 |
| POST | `/api/trips/understand` | 接收 `{ text, media, mediaFacts? }`，返回 `TripUnderstanding` |
| POST | `/api/trips/media/analyze` | 接收受限大小的截图元数据，返回 `MediaFact[]` |

## 协作计划

- `POST /api/group-plans`：创建计划。
- `GET /api/group-plans/:planId`：读取计划。
- `GET /api/group-plans/invite/:code`：邀请码读取。
- `POST /api/group-plans/invite/:code/join`：加入计划。
- `POST /api/group-plans/:planId/polls`：创建投票。
- `PUT /api/group-plans/:planId/polls/:pollId/vote`：提交或修改投票。
- `POST /api/group-plans/:planId/polls/:pollId/close`：关闭投票。
- `POST /api/group-plans/:planId/polls/:pollId/resolve`：解析获胜选项。
- `POST /api/group-plans/:planId/polls/:pollId/reopen`：重开投票。
- `POST /api/group-plans/:planId/leave`：离开计划。
- `GET /api/group-plans/:planId/events`：SSE，事件类型为 `plan.updated`。

错误格式为 `{ error: string, message: string }`。AI 无密钥、超时或模型响应无效时回退本地解析；POI/路线无结果时返回未解析标记，不生成虚构结果。
