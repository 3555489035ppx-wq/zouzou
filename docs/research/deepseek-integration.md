# DeepSeek 作为走走第一阶段文本理解模型

> 调研日期：2026-08-29。本文只记录官方资料和基于当前项目架构的工程判断；模型名称、价格、支付方式和地区可用性都可能变化。

## 结论

DeepSeek 适合替代第一阶段的 OpenAI 文本理解：用户文字 -> `TripIntent`。官方提供 OpenAI 兼容接口，当前文档列出 `deepseek-v4-flash`、`deepseek-v4-pro` 和视觉实验模型，并支持 JSON Output、Tool Calls 与 Responses API。[Your First API Call](https://api-docs.deepseek.com/quick_start/pricing-details-cny/) · [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)

推荐先用 `deepseek-v4-flash` 做意图抽取，输出只包含日期、人数、预算、偏好、必去地点、到达/返程锚点和缺失项；不要让模型直接决定真实路线。复杂排程仍交给本地校验器、高德 POI/路线接口和后续确定性排程器。这是基于当前项目风险边界的工程判断，不是声称 DeepSeek 在所有旅行任务上都优于其他模型。

## 支付与 API Key

DeepSeek 官方 FAQ 的 Billing 部分列出可在 Top Up 页面使用 PayPal、银行卡、支付宝或微信支付充值，并在 Billing 页面查看结果。[DeepSeek FAQ](https://api-docs.deepseek.com/faq/)

这意味着没有国外银行卡不必然阻塞使用 DeepSeek。实际账号资格、登录方式、支付页面展示和地区限制仍应以登录后的官方平台页面为准；官方文档没有对每一个中国大陆账号的可用性作保证。

## 对当前项目的兼容性

DeepSeek 官方说明 API 兼容 OpenAI/Anthropic 格式，OpenAI Node SDK 可以通过修改 `baseURL` 使用；官方 Node 示例使用 `https://api.deepseek.com`。[Your First API Call](https://api-docs.deepseek.com/quick_start/pricing-details-cny/)

当前项目的服务端适配器可以保留接口，只替换供应商配置：

```ts
new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
})
```

对于 JSON，DeepSeek 的 Chat Completions 文档支持 `response_format: { type: 'json_object' }`，但官方要求提示词中包含 JSON 指令和示例，并提醒可能出现空内容。因此服务端必须继续做 JSON 解析、字段校验和本地回退。[JSON Output](https://api-docs.deepseek.com/guides/json_mode/) · [Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)

DeepSeek 的 Responses API 文档也列出 `json_schema`、`name` 和 `schema` 字段；当前文档列出的 Responses API 模型包括 `deepseek-v4-flash`、`deepseek-v4-pro` 和 `deepseek-v4-flash-vision-exp`。[Responses API](https://api-docs.deepseek.com/api/create-response/)

## 效果判断

### 适合

- 中文旅行描述的日期、人数、预算和地点抽取
- 识别“不想太赶”“每天留缓冲”“喜欢咖啡”等软约束
- 生成三套节奏差异说明
- 通过工具调用请求高德搜索、路线和天气，再由代码校验结果

### 不应单独依赖

- 实时营业时间、预约规则、价格、库存和路况
- 多天行程的最终时间可执行性
- 从任意截图准确读取票面信息，除非使用支持图片输入的视觉模型

官方 Chat Completions 文档明确提醒工具参数仍要在业务代码中校验；这和当前项目的 `validatePlan`、`normalizeTripIntent` 设计一致。[Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)

## 图片阶段注意事项

官方 Responses API 文档说明，只有 `deepseek-v4-flash-vision-exp` 处理 `input_image` 为真实图片；其他模型收到图片内容时会被替换成占位文本，文件输入也不支持。因此当前第一步只发送文字和截图元数据是正确的，第二步要单独增加媒体上传和视觉模型适配。[Responses API](https://api-docs.deepseek.com/api/create-response/)

## 最终建议

先把模型供应商抽象成 `OPENAI` / `DEEPSEEK` 两个配置，不要把代码绑定到某一家：

1. 第一阶段用 `deepseek-v4-flash` 做中文 `TripIntent` 抽取。
2. 保留严格的字段规范化、空内容处理和本地回退。
3. 第二阶段再接 `deepseek-v4-flash-vision-exp` 读取票据/酒店截图。
4. 真实地点事实由高德等数据源提供，模型只做候选选择和解释。
5. 用 30-50 条真实中文输入做回归集，分别测日期、预算、必去地点、缺失信息和软约束召回率，再决定是否把更贵的模型用于复杂规划。
