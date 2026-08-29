# GitHub 旅行规划项目对比

> 调研日期：2026-08-29。本文只记录公开仓库中的实现方式，并结合走走当前代码做工程判断。

## 结论

成熟的 AI 旅行规划器通常不是一次 LLM 调用，而是下面这条链路：

```text
文字/截图
  -> OCR 或视觉模型
  -> 结构化旅行需求
  -> 识别冲突并补问
  -> 查询 POI、路线、营业时间、天气等真实数据
  -> 约束排程器生成可执行计划
  -> LLM 负责解释、摘要和个性化文案
```

核心原则是：模型负责理解和选择，工具或后端数据负责事实，代码负责最终可行性。

## 代表性仓库

### 1. Prot10/MyTripPlanner

仓库：[Prot10/MyTripPlanner](https://github.com/Prot10/MyTripPlanner)

这个项目把旅行规划做成一个带工具的持续会话，而不是单次提示词：

- 先通过问题卡片补齐用户需求，再确认 brief。
- 研究阶段使用网页搜索、地理编码和路线工具。
- 坐标必须来自地点搜索，交通耗时必须来自真实路线结果。
- 行程保存在可持续编辑的 notebook 中，修改后重新检查整体连贯性。
- 规划规则要求先研究再排程，并为交通、停留和缓冲预留时间。

它的公开系统提示词和规划规则也明确要求模型读取当前 notebook、只使用工具返回的真实地点、对营业时间/价格等时效信息做验证，并把路线作为显式行程项展示：

- [system prompt](https://raw.githubusercontent.com/Prot10/MyTripPlanner/refs/heads/main/server/prompts/en/system.md)
- [planning rules](https://raw.githubusercontent.com/Prot10/MyTripPlanner/refs/heads/main/server/prompts/en/planning-rules.md)

对走走的启发：需要“结构化状态 + 工具 + 校验”，单纯增加 prompt 长度不够。

### 2. billdmar/travel-ai-tai

仓库：[billdmar/travel-ai-tai](https://github.com/billdmar/travel-ai-tai)

这个项目更强调工程闭环：

- `RecommendationEngine.generate()` 负责生成。
- 生成结果用 Pydantic 的 `GeneratedItinerary` 校验。
- 用户偏好会标准化后做哈希缓存，相同请求可直接复用结果。
- 支持流式生成、重新生成、编辑、导出和指标接口。
- LLM provider 可插拔，方便替换模型或使用本地 mock。

对走走的启发：`TripIntent` 和 `GeneratedPlan` 之间要有明确 schema，模型返回必须校验；同一需求需要缓存，避免重复等待和重复计费。

### 3. huanyuzhilv/skills-travel-planner

仓库：[huanyuzhilv/skills-travel-planner](https://github.com/huanyuzhilv/skills-travel-planner)

这是中文旅行路书生成器，采用了很实用的中间表示：

- 从 txt、docx 或截图 brief 中提取旅行信息。
- 先生成结构化的 `tripData.json`。
- 再补充每日内容、图片、酒店等信息。
- LLM 主要用于可选的文案润色，最终交付由 HTML/PDF 模板完成。

对走走的启发：截图识别结果应先进入 `mediaFacts` 或 `tripData`，不要让模型直接从截图跳到最终行程。

### 4. ladHarsh/AI-TripPlanner

仓库：[ladHarsh/AI-TripPlanner](https://github.com/ladHarsh/AI-TripPlanner)

它将 Gemini 与 OpenStreetMap/Nominatim/Overpass、OSRM 组合：模型理解偏好，地图服务提供地点和路线，应用再生成按天的行程，并展示时间和费用信息。

对走走的启发：即使不接国外付费服务，也可以先用高德或 OSM/OSRM 做真实地理与路线层，DeepSeek 只负责中文理解和说明。

## 与走走当前实现的差距

当前服务端的 `sanitizeTripRequest` 会把媒体 `src` 清空，`buildModelInput` 只拼接文件名；前端也只发送 `id/name/category`。因此当前截图只是“已上传线索”，不是模型可读取的图像。

另外，当前 `generatePlans` 仍以 `realShanghaiDays()` 的固定上海模板为主体，再做轻松/丰富两种裁剪或追加。它已经有时间、营业时间、预算和必去覆盖校验，但还没有把模型识别出的所有偏好动态转换成地点选择和路线。

## 推荐的走走架构

### 第一阶段：把截图变成可验证事实

新增媒体解析结果，而不是只保存文件名：

```ts
type MediaFact = {
  mediaId: string
  source: 'ocr' | 'vision' | 'user'
  rawText: string
  facts: {
    date?: string
    time?: string
    location?: string
    trainOrFlight?: string
    reservationCode?: string
  }
  confidence: number
  needsConfirmation: boolean
}
```

车票、酒店订单、聊天记录截图优先使用 OCR；只有需要理解地图布局、复杂表格或照片内容时再使用视觉模型。低置信度的日期、时间和地点必须回显给用户确认。

### 第二阶段：规范化需求

将需求分为：

- 硬约束：日期、到达/返程时间、人数、预算上限、已购票、必须去的地点。
- 软偏好：咖啡、展览、City Walk、松弛程度、室内/室外倾向。
- 禁忌与风险：忌口、老人/儿童、不能长距离步行、必须预留返程缓冲。
- 证据：每一个字段来自哪段文字或哪张截图，置信度是多少。

遇到冲突时不能静默猜测，例如“18:30 返程”与“18:00 还在远郊”同时存在时，应先提示冲突。

### 第三阶段：接入事实工具

至少需要地点搜索/地理编码、路线耗时、营业时间和天气。生产计划中的价格、营业状态、预约要求和路线耗时必须带来源和时间戳，并允许标记为“估算”或“待复核”。

### 第四阶段：让排程器真正消费意图

`generatePlans(intent)` 不能只复制固定上海模板。它应该先锁定到达、返程、住宿和必去地点，再从候选 POI 中按区域、营业窗口、交通时长、预算和节奏选择，最后由 `validatePlan` 检查并在失败时回退或重新排程。

### 第五阶段：最后才生成自然语言

最终文案只根据已经验证过的 `GeneratedPlan` 生成，不能让模型重新发明价格、营业时间或路线。这样 DeepSeek 更适合做中文解释、方案差异和替换建议。

## 对模型选择的判断

DeepSeek 足够承担当前的中文旅行意图抽取、偏好归类和方案说明；它不够单独承担截图理解、实时信息查询和最终路线真实性。没有国外银行卡时，最现实的路线是：

```text
本地 OCR -> DeepSeek 文本结构化 -> 高德/OSM 真实数据 -> 本地排程校验 -> DeepSeek 文案
```

这条路线的成本、速度和可控性都更适合走走当前阶段。
