# AI 结合真实用户计划生成可执行旅行行程：GitHub 一手资料研究

> 调研日期：2026-08-29。范围限定为 GitHub 仓库的源码、README、issue/设计文档，以及 OpenAI / Google 的官方文档。这里的结论都尽量落到可实现的工程模式，而不是泛泛的提示词建议。

## 先给结论

把“旅行行程生成”做成可执行系统，最稳妥的结构不是“LLM 直接写一段行程文案”，而是：

1. 先把用户意图和约束解析成结构化请求。
2. 再把地点、交通、营业时间、时区、预算等事实拉成可校验的事实层。
3. 让模型先出候选计划，再用确定性工具校验。
4. 只修复失败的节点，最后才渲染成自然语言或 PDF/日历输出。

这个方向同时得到了旅行类开源仓库和 OpenAI / Google 官方文档的支持，尤其是 OpenTrip、Cairn、OpenTripPlanner、Voyager、SerpApi 的 travel-planning-agent，以及 OpenAI Agents SDK 和 Google Maps / Places / Time Zone 文档。[OpenTrip](https://github.com/stvlynn/OpenTrip) · [Cairn](https://github.com/thkleinert/cairn) · [OpenTripPlanner](https://github.com/opentripplanner/OpenTripPlanner) · [Voyager](https://github.com/nageshsinghc4/voyager) · [travel-planning-agent](https://github.com/serpapi/travel-planning-agent) · [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)

## 1) 真实行程信息应如何结构化

我建议把“行程”拆成四层，不要让一个大 JSON 同时背负用户意图、地理事实、排程和渲染文本。

| 层 | 作用 | 典型字段 |
| --- | --- | --- |
| `TripRequest` | 用户输入的意图与约束 | 出发地/目的地、日期范围、人数、预算、偏好、忌口、步调、是否亲子/无障碍、必须去/不要去 |
| `FactPack` | 可校验的世界事实 | `place_id`、经纬度、时区、营业时间、是否营业、类别、价格档、交通时长、票务/预订状态、证据来源 |
| `DayPlan` / `Stop` / `Leg` | 可执行排程 | 第几天、顺序、停留时长、出发/到达时间、交通方式、缓冲时间、成本、替代方案 |
| `VerificationState` | 事实校验结果 | `verified` / `stale` / `conflict` / `unknown`、证据链接、时间戳、失败原因 |

推荐的 stop 级别对象至少包含这些字段：

```ts
{
  id: string
  day: number
  sequence: number
  place_id?: string
  name: string
  lat: number
  lng: number
  timezone?: string
  opening_hours?: OpeningHoursSnapshot
  arrival_time?: string
  departure_time?: string
  dwell_minutes?: number
  transport_mode?: "walk" | "transit" | "drive" | "bike"
  travel_minutes_from_prev?: number
  estimated_cost?: number
  evidence: Evidence[]
  verification_state: "verified" | "stale" | "conflict" | "unknown"
}
```

这个分层能直接从几个成熟仓库里拼出来：

`OpenTrip` 的 Trip / Stop / Reservation / Budget / Agent 设计已经把 map itinerary、day schedule、reservations、shared expenses、AI companion 拆成了独立对象；`Cairn` 进一步把 `stop` / `spot`、visit window、reorderable list、place notes、route history 做成了更细的 place model；`Voyager` 则把 trip planner 的状态拆成共享 state schema 和多个 agent 输出块。[OpenTrip](https://github.com/stvlynn/OpenTrip) · [Cairn](https://github.com/thkleinert/cairn) · [Voyager](https://github.com/nageshsinghc4/voyager)

对“结构化输出”本身，OpenAI Agents SDK 的 `function-and-output-schema.md` 明确要求 schema 生成、调用重建、JSON Schema 严格化和输出验证保持一致；这意味着行程对象应该是强类型 schema，而不是自由文本拼接。[Function and Output Schema](https://github.com/openai/openai-agents-python/blob/main/.agents/references/function-and-output-schema.md) · [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)

## 2) 如何做地点 / 时间 / 交通 / 营业时间等事实校验

### 地点与营业时间

地点应以 `place_id` 作为主键，而不是只靠文本名。Google Places API 的 Place Details / Place Data Fields 支持返回完整地址、电话、评分、评论，以及 `currentOpeningHours`、`regularOpeningHours` 这类营业时间字段；Place ID 还可以刷新，Google 明确建议超过 12 个月就更新一次。[Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details) · [Place Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields) · [Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id)

因此，建议的校验顺序是：

1. 先用搜索/API 拿到 `place_id`。
2. 再用 Place Details 拉取地址、类别、营业状态、营业时间。
3. 对营业时间做“时区对齐后”的时间窗判断，而不是拿字符串直接比对。
4. 如果返回值缺失，就把该 stop 标记为 `unknown` 或 `stale`，不要硬补。

### 交通与耗时

路线时间不要让模型猜。应该用路线 API 或真正的路径规划引擎来算。

Google Routes API 的 `computeRoutes` / `computeRouteMatrix` 能返回距离、时长和 polyline，并支持 traffic-aware 选项与 field mask；如果是多点行程，route matrix 更适合做批量校验。[Routes API](https://developers.google.com/maps/documentation/routes) · [Get a route](https://developers.google.com/maps/documentation/routes/compute_route_directions) · [Get a route matrix](https://developers.google.com/maps/documentation/routes/compute_route_matrix) · [Traffic options](https://developers.google.com/maps/documentation/routes/traffic-opt)

如果是公共交通，OpenTripPlanner 更适合做“事实底座”：它从 GTFS 和 OpenStreetMap 构建交通网络，支持 GraphQL API，并把 real-time updates / alerts 直接反映到客户端；这正适合校验“这段行程今天能不能走、几点能到、是否有服务变化”。[OpenTripPlanner](https://github.com/opentripplanner/OpenTripPlanner)

### 时区与跨日边界

只要存在跨城、跨国、夜间交通、凌晨入住/退房，就必须把时区单独建模。Google Time Zone API 明确根据经纬度和 timestamp 返回 UTC / DST 偏移，适合把本地时间和 UTC 时间统一起来算。[Time Zone API overview](https://developers.google.com/maps/documentation/timezone/overview) · [Time Zone requests and responses](https://developers.google.com/maps/documentation/timezone/requests-timezone)

这意味着每个 stop 或 leg 最好至少存：

1. `timezone`
2. 原始 `timestamp_utc`
3. 本地显示时间
4. 时区偏移来源

### 推荐的校验状态机

| 状态 | 触发条件 | 处理方式 |
| --- | --- | --- |
| `verified` | 事实来自权威 API 且字段完整 | 可进入最终计划 |
| `stale` | 事实存在，但可能过期或缓存过久 | 触发刷新，不直接发布 |
| `conflict` | 多个来源冲突，比如营业时间和路线时长不一致 | 交给修复阶段或人工确认 |
| `unknown` | 没拿到必要字段 | 继续补检索或向用户追问 |

这个状态机和 OpenAI Agents SDK 的工具执行生命周期是同构的：工具发现、审批分流、实际执行、输出 guardrail 不应该揉成一锅粥；应该分阶段做，尤其在 approval / resumed turn 场景下。[Tool Execution Lifecycle](https://github.com/openai/openai-agents-python/blob/main/.agents/references/tool-execution-lifecycle.md)

## 3) 如何把 LLM 从直接写文本改成“解析 - 规划 - 校验 - 修复”流水线

我建议把模型职责拆成五段，而不是让一个 prompt 同时干完所有事。

### Phase A: 解析

输入只负责把用户话术转成 `TripRequest`，比如：

- 出发/返回日期
- 城市与机场/车站
- 预算上限
- 偏好与禁忌
- 是否需要亲子、无障碍、夜生活、购物、博物馆等标签

这一层适合用 Structured Outputs / strict JSON schema，确保输出不是一坨自由文本。[OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) · [Function calling](https://platform.openai.com/docs/guides/function-calling) · [Function and Output Schema](https://github.com/openai/openai-agents-python/blob/main/.agents/references/function-and-output-schema.md)

### Phase B: 检索 / 取证

这一层不要编排文字，专门做事实拉取：

- 地点、营业时间、地址、评分、图片
- 路线、耗时、交通方式、交通流量
- 时区、跨日边界
- 票务 / 酒店 / 航班 / 签证等外部事实

OpenAI 官方把 File search / Retrieval 作为单独的工具层，说明“先取证再回答”本身就是一个独立工作流，而不是 prompt 小技巧。[File search](https://developers.openai.com/api/docs/guides/tools-file-search) · [Retrieval](https://developers.openai.com/api/docs/guides/retrieval)

### Phase C: 规划

这一步输出的是图或表，不是文案。

`Voyager` 的做法很典型：先 host agent 做验证与归一化，再 dispatch 8 个专职 agent 并行获取子结果，最后在 barrier node 汇总，再生成日程。[Voyager](https://github.com/nageshsinghc4/voyager)

`OpenTrip` 的做法更接近“产品级旅行规划”：AI companion 走的是共享 trip session，写操作要 approval，trip ops 是 typed catalog，且有 sequential patch applier 防止并发工具调用互相覆盖。[OpenTrip](https://github.com/stvlynn/OpenTrip)

### Phase D: 校验

把每个 stop / leg / booking / day-plan 都跑一遍规则校验：

- 时间先后关系
- 营业时间窗是否覆盖
- 通勤是否超时
- 预算是否超标
- 是否存在时区穿越导致的日程错位
- 是否缺少证据来源

Google Routes API、Places API、Time Zone API 这些工具的共同点是：它们都要求明确字段选择、明确请求参数和明确返回结构，说明“校验”应该是确定性动作，而不是 LLM 口头自检。[Get a route](https://developers.google.com/maps/documentation/routes/compute_route_directions) · [Place Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields) · [Time Zone requests and responses](https://developers.google.com/maps/documentation/timezone/requests-timezone)

### Phase E: 修复

只对失败节点重跑，不要整单重算。

OpenAI Agents SDK 的 issue #1263 很直白地暴露了一个风险：structured output、tool calls、guardrails 混在一个 agent 配置里时，最终输出可能不符合 schema。这个问题本身就说明要把“生成”和“执行/修复”拆开，不要一次性赌模型把所有事情做对。[Issue #1263](https://github.com/openai/openai-agents-python/issues/1263)

### Phase F: 渲染

只有当所有必选事实都通过后，才把结构化计划渲染成：

- 人类可读行程
- 日历事件
- PDF
- 机器可执行的 itinerary JSON

### 评测建议

Evals 不应该只看“回答像不像”，而要看：

1. schema 是否严格通过
2. 是否引用了可追溯证据
3. 实际路线是否可达
4. 营业时间是否冲突
5. 预算是否越界
6. 修复轮数是否可控

OpenAI 的 Evals 文档已经把评测、grader、prompt optimizer、agent workflow evaluation 作为独立主题，这很适合做“旅行行程可执行性”的离线评测集。[Working with evals](https://platform.openai.com/docs/guides/evals)

## 4) 哪些仓库代码值得借鉴

| 仓库 | 借鉴点 | 为什么值得看 |
| --- | --- | --- |
| [stvlynn/OpenTrip](https://github.com/stvlynn/OpenTrip) | `Trip` / `Stop` / `Reservation` / `Budget` / `Agent` 的分层；共享 trip session；approval-gated write tools；序列化 patch applier | 这是最接近“真实用户协作 + AI 改行程 + 事实约束”的产品级实现，尤其适合借鉴状态机和审批语义 |
| [thkleinert/cairn](https://github.com/thkleinert/cairn) | `stop` / `spot` 地点层级、visit window、可拖拽 reorder、place notes、visited route | 很适合借鉴“地点树”和“列表即行程”的交互，不要只看地图，不要把 stop 退化成平面卡片 |
| [opentripplanner/OpenTripPlanner](https://github.com/opentripplanner/OpenTripPlanner) | GTFS + OSM 的多模态路径底座、GraphQL API、real-time updates、性能测试 | 这是做交通事实校验的底层参考，不是行程文案参考 |
| [serpapi/travel-planning-agent](https://github.com/serpapi/travel-planning-agent) | clarifying questions、IATA 码校验、并行搜索、structured JSON trace、footnote citations | 很适合借鉴“先补足必需输入，再调用工具，再带引用输出”的前台 agent 结构 |
| [nageshsinghc4/voyager](https://github.com/nageshsinghc4/voyager) | 8 个并行 agent、共享 state schema、barrier node、fallback 数据路径 | 很适合借鉴“并行取证 + 汇总”的图式 orchestration |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | strict JSON schema、函数签名到 schema 的转换、工具执行生命周期、approval / guardrail 顺序 | 这是把“模型输出”变成“工程可控协议”的最好官方参考之一 |

## 建议的落地顺序

1. 先定义 `TripRequest`、`Stop`、`Leg`、`Evidence`、`VerificationState` 这些核心 schema。
2. 再接入地点、路线、时区、营业时间校验工具。
3. 然后把 LLM 拆成“解析 / 规划 / 修复”三段，而不是一个 prompt 包办。
4. 最后补评测集，专门测 schema、时序、营业时间、路线可达性和修复成功率。

## 参考链接

### OpenAI 官方文档

- [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Function calling](https://platform.openai.com/docs/guides/function-calling)
- [File search](https://developers.openai.com/api/docs/guides/tools-file-search)
- [Retrieval](https://developers.openai.com/api/docs/guides/retrieval)
- [Evals](https://platform.openai.com/docs/guides/evals)

### Google 官方文档

- [Places API overview](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Place Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [Routes API](https://developers.google.com/maps/documentation/routes)
- [Get a route](https://developers.google.com/maps/documentation/routes/compute_route_directions)
- [Get a route matrix](https://developers.google.com/maps/documentation/routes/compute_route_matrix)
- [Traffic options](https://developers.google.com/maps/documentation/routes/traffic-opt)
- [Time Zone API overview](https://developers.google.com/maps/documentation/timezone/overview)
- [Time Zone requests and responses](https://developers.google.com/maps/documentation/timezone/requests-timezone)

### GitHub 仓库

- [OpenTrip](https://github.com/stvlynn/OpenTrip)
- [Cairn](https://github.com/thkleinert/cairn)
- [OpenTripPlanner](https://github.com/opentripplanner/OpenTripPlanner)
- [travel-planning-agent](https://github.com/serpapi/travel-planning-agent)
- [Voyager](https://github.com/nageshsinghc4/voyager)
- [openai-agents-python](https://github.com/openai/openai-agents-python)

