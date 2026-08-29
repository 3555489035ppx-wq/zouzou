# 国内图片理解 / 视觉模型 API 调研

> 调研日期：2026-08-29。范围：国内可用、相对便宜的图片理解 / 视觉语言模型（VLM），优先阿里云百炼/通义千问视觉、智谱 GLM 视觉、火山引擎豆包视觉和 SiliconFlow。来源只采用供应商官方文档、官方价格页和官方 GitHub。价格、模型别名、限流和免费额度会变化，接入前应以控制台当前模型详情为准。

## 结论先行

对“车票、酒店订单、聊天记录”等截图，建议采用“低价通用视觉模型 + 明确 JSON 提取提示 + 本地字段校验”的方式，不要让模型直接产出最终业务对象而不做校验。

| 优先级 | 推荐 | 适用理由 | 主要代价 / 风险 |
| --- | --- | --- | --- |
| 1 | 阿里云百炼 `qwen3-vl-flash` | 北京地域公开价格低：输入 0.15 元 / 百万 tokens、输出 1.5 元 / 百万 tokens（输入 ≤32K）；支持图片、结构化输出、OpenAI 兼容 Chat Completions | 图片会换算成视觉 tokens；高分辨率截图和超长聊天记录会增加费用；免费额度和模型权限要看账号/地域 |
| 2 | 智谱 `GLM-4.6V-FlashX` | 输入 ≤32K 时 0.15 / 1.5 元 / 百万 tokens，128K 上下文；中文票面、文档和复杂截图场景较契合；OpenAI 兼容 | 具体 RPM/TPM 按账号速率页展示；免费版 `GLM-4.6V-Flash` 适合先做效果试验，不应默认当生产 SLA |
| 3 | SiliconFlow `PaddlePaddle/PaddleOCR-VL-1.5` 或当前可用的 Qwen/GLM VLM | 当前官方价格页列出 PaddleOCR-VL-1.5 免费；统一 OpenAI 风格接口，便于做供应商切换和 A/B 测试 | 聚合平台的可用模型、免费模型固定限流和实际配额以模型广场/账号为准；当前价格页并未在静态列表中展开所有 Qwen VLM 价格 |
| 4 | 火山方舟当前视觉输入的 Seed 系列 endpoint | 国内接入、OpenAI 风格 Chat Completions / 官方 Ark SDK；当前公开按量页列出 Seed 2.1 Turbo 3 / 15 元、Pro 6 / 30 元（输入/输出每百万 tokens），可作为复杂截图或备用供应商 | 火山公开页面把模型价格、Endpoint 权限和生产级并发保障分开展示；图片大小、上下文和限流需要在所选 endpoint 的模型详情确认 |

### 针对三类截图的落地选择

- 车票：优先 `qwen3-vl-flash` 或 `GLM-4.6V-FlashX`，提示词要求提取出发站、到达站、日期、时间、车次、座位、乘车人，并对“不确定/看不清”返回 `null`，不要猜测。
- 酒店订单：优先通用 VLM；如果主要目标是密集文字/订单号/入住退房日期，可先用 `qwen-vl-ocr` 或 SiliconFlow 的 `PaddleOCR-VL-1.5` 做 OCR，再用低价文本模型归一化字段。
- 聊天记录：优先通用 VLM而不是纯 OCR，因为还需要识别说话人、时间顺序、地点/日期表达和上下文；图片较长时建议按屏幕或消息块切片，保留原图顺序。

以上是基于模型公开能力、价格和输入格式的工程判断，不是对四个平台模型效果的基准测试。真实接入前，应用内应保留人工确认或低置信度回退。

## 统一请求形态

四个平台都能使用“单条 user message + `content` 数组 + `image_url` + `text`”这种主流多模态格式。图片可使用公网 URL；本地截图通常应转成 Data URI，或上传到供应商支持的文件/对象存储后再传 URL。

```json
{
  "model": "<provider-model-or-endpoint>",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,<BASE64_IMAGE>"
          }
        },
        {
          "type": "text",
          "text": "请读取截图并严格输出 JSON。看不清的字段填 null，不要猜测。"
        }
      ]
    }
  ],
  "stream": false
}
```

注意：`detail`、结构化输出、思考开关、文件输入和多图上限不是所有供应商/模型都完全一致；兼容 OpenAI 主要表示可以复用 SDK 和 Chat Completions 请求形态，不表示每个 OpenAI 参数都被实现。

## 对比表

| 平台 | 推荐模型 / 价格（人民币） | 图片输入与限制 | OpenAI 兼容 | 适合度 |
| --- | --- | --- | --- | --- |
| 阿里云百炼 | `qwen3-vl-flash`：北京输入 ≤32K 为 0.15 / M、输出 1.5 / M；32K–128K 为 0.3 / 3；128K–256K 为 0.6 / 6。`qwen-vl-ocr`：0.3 / 0.5 / M，官方价格页列出 100 万 tokens 免费额度。 | `qwen3-vl-flash` 最大输入 260,096、最大输出 32,768、上下文 262,144；Qwen3-VL 图片公网 URL 单张不超过 20MB；公网 URL/本地路径多图最多 256 张，Base64 最多 250 张；还受视觉 tokens 总上限限制。 | 是。北京兼容地址：`https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`；`POST /chat/completions`；`image_url.url` 支持图片 URL 或 Base64 Data URL。 | 首选低成本通用截图理解；OCR 专用模型适合先提取再归一化。 |
| 智谱 BigModel | `GLM-4.6V-FlashX`：输入 ≤32K 为 0.15 / M、输出 1.5 / M；32K–128K 为 0.3 / 3。`GLM-4.6V`：输入 ≤32K 为 1 / 3；32K–128K 为 2 / 6。`GLM-4.6V-Flash`：价格页列为免费。 | `GLM-4.6V` 系列公开模型页给出 128K 上下文，支持图片、视频、文件、文本。图片 URL 和 Base64 均有官方示例；新模型页没有给出统一图片张数/单图大小，需以模型详情和账号限制为准。旧版 GLM-4V FAQ 的“Plus 最多 5 张、Flash 单张”不能直接套用于 4.6V。 | 是。`https://open.bigmodel.cn/api/paas/v4/`；`POST /chat/completions`；使用 `messages[].content[]` 中的 `image_url` 和 `text`。 | 中文密集截图、复杂文档和需要一定视觉推理时可选；FlashX 是性价比候选。 |
| 火山方舟 | 当前官方产品页公开按量价格：`Doubao-Seed-2.1-turbo` 输入 3 / M、输出 15 / M；`Doubao-Seed-2.1-pro` 输入 6 / M、输出 30 / M；命中缓存分别 0.6 / 1.2 / M。公开生产级保障表另以输入 TPM/输出 TPM 展示，不能与按量 token 价直接相加。 | 官方“接入视觉模型”文档支持图片、视频和文本；官方 Ark SDK/GitHub 示例使用 `image_url`。模型、Endpoint 和具体限制是动态的，图片大小、上下文、并发及是否开放视觉输入应在方舟模型详情确认。 | 是。Ark runtime 提供 `client.chat.completions.create()`；北京常用服务地址为 `https://ark.cn-beijing.volces.com/api/v3`，`model` 通常填写已创建的 Endpoint ID。 | 适合作为国内备用、复杂推理或已有火山账号的主供应商；低成本优先时先核实当前 Turbo/Flash 视觉 endpoint。 |
| SiliconFlow | 官方价格页当前列出 `PaddlePaddle/PaddleOCR-VL-1.5` 免费；`zai-org/GLM-4.5V` 输入 1 / M、输出 6 / M。平台还提供 Qwen3-VL、Qwen2-VL、GLM 等 VLM，具体模型和价格以模型广场为准。 | 统一支持图片 URL/Base64、`detail=auto|low|high`。Qwen 系列视觉计费约束：56×56 至 3584×3584，尺寸按 28 的倍数处理；`low` 统一约 448×448、约 256 tokens，`high` 按实际缩放后尺寸计费。多模态模型限流不在通用静态表中给固定值，账号/模型页为准。 | 是。`https://api.siliconflow.cn/v1`；`POST /chat/completions`；官方文档直接使用 OpenAI Python SDK。 | 适合供应商抽象、快速试模型和 OCR-first 路线；生产前必须确认免费模型的固定限流与可用性。 |

## 各平台接口格式

### 1. 阿里云百炼 / 通义千问视觉

官方 OpenAI 兼容 Chat 文档给出的形态如下，实际只需要替换 Workspace ID、API Key 和模型名：

```python
from openai import OpenAI

client = OpenAI(
    api_key="DASHSCOPE_API_KEY",
    base_url="https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
)

response = client.chat.completions.create(
    model="qwen3-vl-flash",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {
                "url": "https://example.com/ticket.jpg",
            }},
            {"type": "text", "text": "提取车票字段并输出 JSON，不确定填 null。"},
        ],
    }],
)
```

阿里同时提供 DashScope 原生多模态接口；若需要使用某些供应商特有参数，应按模型文档选择原生接口。Qwen-VL-OCR 是特定单轮 OCR/提取模型，不应假定它支持与通用视觉模型相同的多轮能力。

来源：[视觉理解模型总览](https://help.aliyun.com/zh/model-studio/vision-model/) · [qwen3-vl-flash 模型信息、能力、价格和限流](https://help.aliyun.com/zh/model-studio/qwen3-vl-flash) · [OpenAI 兼容 Chat](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions) · [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing) · [限流](https://help.aliyun.com/zh/model-studio/rate-limit) · [图像/视频输入限制](https://help.aliyun.com/zh/model-studio/model-training-overview)

### 2. 智谱 GLM 视觉

```bash
curl -X POST 'https://open.bigmodel.cn/api/paas/v4/chat/completions' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "glm-4.6v-flashx",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "image_url", "image_url": {
          "url": "data:image/jpeg;base64,<BASE64_IMAGE>"
        }},
        {"type": "text", "text": "读取酒店订单：酒店名、入住/退房日期、房型、订单号。严格输出 JSON。"}
      ]
    }],
    "thinking": {"type": "disabled"}
  }'
```

官方 GLM-4.6V 文档同时展示了图片 URL、Base64、视频 URL 和文件 URL。对于截图提取，建议先关闭思考模式以控制输出 tokens；只有需要跨字段推理或纠错时再打开。智谱官方 OpenAI 兼容页也提醒，兼容不代表所有接口差异消失。

来源：[GLM-4.6V 模型文档与调用示例](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-4.6v) · [GLM-4.6V-Flash](https://docs.bigmodel.cn/cn/guide/models/free/glm-4.6v-flash) · [OpenAI API 兼容](https://docs.bigmodel.cn/cn/guide/develop/openai/introduction) · [官方价格页](https://bigmodel.cn/pricing) · [速率限制](https://docs.bigmodel.cn/cn/api/rate-limit) · [GLM-4V 图片数量 FAQ](https://docs.bigmodel.cn/cn/faq/api-issues)

### 3. 火山方舟 / 豆包视觉

火山方舟官方 Ark runtime 的调用形态与 OpenAI Chat Completions 接近。`model` 使用控制台创建的 Endpoint ID，不要把产品展示名称直接当作 Endpoint ID：

```python
from volcenginesdkarkruntime import Ark

client = Ark(
    api_key="ARK_API_KEY",
    base_url="https://ark.cn-beijing.volces.com/api/v3",
)

completion = client.chat.completions.create(
    model="YOUR_ENDPOINT_ID",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "分析聊天记录截图，按时间顺序提取地点、日期和明确约定；不确定填 null。"},
            {"type": "image_url", "image_url": {
                "url": "https://example.com/chat.png"
            }},
        ],
    }],
)
```

方舟的视觉接入文档说明图片可通过 URL、Base64 等方式提供；官方 GitHub runtime 示例确认 `client.chat.completions.create()` 与 `image_url` 组合。方舟当前也提供 Responses API，但如果项目已有 OpenAI Chat Completions 抽象，优先从 Chat 接口开始，避免把 Responses 专有字段混进通用适配器。

来源：[接入视觉模型](https://www.volcengine.com/docs/82379/2375486?lang=zh) · [方舟产品/价格页](https://www.volcengine.com/product/ark) · [豆包产品页](https://www.volcengine.com/product/doubao) · [官方 Ark runtime Python GitHub](https://github.com/volcengine/ark-runtime-python) · [官方 Python SDK 示例](https://github.com/volcengine/volcengine-python-sdk/blob/master/volcenginesdkexamples/volcenginesdkarkruntime/completions.py)

### 4. SiliconFlow

SiliconFlow 的官方多模态文档直接采用 OpenAI SDK 和标准 `messages[].content[]`：

```python
from openai import OpenAI

client = OpenAI(
    api_key="SILICONFLOW_API_KEY",
    base_url="https://api.siliconflow.cn/v1",
)

response = client.chat.completions.create(
    model="PaddlePaddle/PaddleOCR-VL-1.5",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {
                "url": "data:image/png;base64,<BASE64_IMAGE>",
                "detail": "high",
            }},
            {"type": "text", "text": "识别所有可见文字，保留原始顺序和换行。"},
        ],
    }],
)
```

官方文档列出的视觉输入支持 URL/Base64，多图可以重复放置多个 `image_url` 内容块。视觉输入会先换算为 tokens 并计入上下文；`detail=low` 可降低成本，但票号、订单号、聊天小字等场景应优先 `high` 并控制图片裁切/尺寸。

来源：[多模态模型（视觉/音频/视频）](https://docs.siliconflow.cn/cn/userguide/capabilities/multimodal-vision) · [Vision 输入格式](https://docs.siliconflow.cn/en/userguide/capabilities/vision) · [Chat Completions API](https://docs.siliconflow.cn/en/api-reference/chat-completions/chat-completions) · [官方价格页](https://siliconflow.cn/pricing) · [限流与升级](https://docs.siliconflow.cn/docs/userguide/faqs/rate-limit-and-upgradation)

## 成本与可靠性建议

1. 把费用按“图片视觉 tokens + 输出 tokens”估算，而不是按图片张数估算。相同截图在 `low`/`high` 下可能产生明显不同的视觉 token 数。
2. 票据和聊天截图尽量裁掉无关边距，但不要把小字缩到模型推荐分辨率以下；对长聊天记录按顺序分片，并在提示词中传入 `part_index`。
3. 让模型只输出字段和证据片段，例如 `departure_station`、`arrival_station`、`date`、`time`、`order_id`、`evidence`、`confidence`；日期、车次、订单号再由本地代码做格式校验。
4. 对生产请求设置较小的 `max_tokens`，避免模型输出长解释；需要解释时将解释字段限制为一句话。
5. 先用阿里 `qwen3-vl-flash` 和智谱 `GLM-4.6V-FlashX` 做同一批真实截图的回归测试，再决定是否把复杂/低置信度请求升级到更贵模型。
6. 供应商适配层至少保留：超时、429 退避、空响应、非 JSON 响应、图片 URL 不可访问、Base64 过大、模型下线/权限不足的错误分类。
7. 车票、酒店订单和聊天记录含有个人信息。调研未覆盖各平台最新隐私/数据留存条款；上线前应单独核对账号地域、数据处理协议、日志留存和脱敏要求。

## 调研边界与未决项

- 价格按各官方页面在 2026-08-29 抓取到的公开原价/标准价记录；限时折扣、首购包、资源包没有纳入主比较。
- 火山方舟公开产品页能确认当前 Seed 系列按量价格和视觉接入入口，但视觉 endpoint 的具体图片大小、上下文、RPM/TPM 常随模型版本和账号变化，不能用一个固定数字覆盖所有 endpoint。
- SiliconFlow 官方多模态文档确认了接口和视觉 token 计算规则，但当前价格页静态列表将部分模型折叠；Qwen VLM 的最终价格、免费模型限流和可用区域应在模型广场登录后确认。
- 供应商“支持 OpenAI 兼容”仅代表接入协议层兼容；`response_format`、思考字段、文件输入、结构化输出和多图限制仍需逐模型验证。
