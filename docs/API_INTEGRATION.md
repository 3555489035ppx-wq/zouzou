# 走走｜第一步 API 接入说明

第一步只解决一个问题：把用户的旅行文字转换为稳定的 `TripIntent`，供后面的排程器使用。

```text
TravelNewPage
  -> POST /api/trips/media/analyze（有截图时）
  -> POST /api/trips/understand
  -> server/trip-intent.ts
  -> DeepSeek/OpenAI Structured Outputs
  -> TripUnderstanding + MediaFact
  -> 原有上海排程器
```

## 本地启动

在项目根目录复制环境变量文件：

```powershell
Copy-Item .env.example .env
```

推荐填写 DeepSeek：

```env
VITE_REMOTE_AI=1
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的Key
DEEPSEEK_MODEL=deepseek-v4-flash

# 可选：截图理解。推荐国内低价视觉模型，Key 只能放服务端。
VISION_ENABLED=1
VISION_PROVIDER=dashscope
DASHSCOPE_API_KEY=你的百炼Key
DASHSCOPE_VISION_MODEL=qwen3-vl-flash
# 如果使用智谱：VISION_PROVIDER=zhipu、ZHIPU_API_KEY=你的Key、ZHIPU_VISION_MODEL=glm-4.6v-flash
# 如果使用豆包：VISION_PROVIDER=doubao、DOUBAO_API_KEY=你的Key、DOUBAO_VISION_MODEL=方舟EndpointID
PORT=8787
```

打开两个终端：

```powershell
# 终端一
pnpm server
```

```powershell
# 终端二
pnpm dev
```

如果暂时没有 Key，保留 `DEEPSEEK_API_KEY` 为空即可。服务端健康检查仍然可用，理解接口会明确返回 `provider: "local"`。

## 接口

### `GET /api/health`

用于确认服务是否启动，以及当前使用的供应商：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8787/api/health
```

### `POST /api/trips/understand`

请求：

```json
{
  "text": "2026年9月18日到9月20日去上海，两个朋友，预算4000元，10:30到虹桥火车站，18:30从虹桥返程。想去武康路、安福路、看展和外滩，不想太赶。",
  "media": []
}
```

返回的 `intent` 包含日期、人数、预算、节奏、必去地点、偏好、到达/返程锚点和 `missing`。服务端会再次规范日期和时间，并自动补充缺失的关键锚点。

有截图时，前端会把当前页面可读的图片压缩成受限大小的 base64，仅发送到自己的 `/api/trips/media/analyze`；该接口返回 `MediaFact`，包含原文、结构化字段、置信度和待确认标记。主理解接口只消费这些证据，不接收浏览器 `blob:` 地址。

如果未配置视觉 Key，媒体接口会返回低置信度回退结果，文字理解仍会继续，不会把截图文件名当成截图内容。

### `POST /api/trips/media/analyze`

请求由前端内部生成，图片必须是 `data:image/...;base64,...`，最多 6 张；服务端不会接受任意远程 URL，以避免把用户输入变成服务端请求。

返回示例：

```json
{
  "provider": "dashscope",
  "model": "qwen3-vl-flash",
  "mediaFacts": [{
    "mediaId": "ticket-1",
    "kind": "ticket",
    "rawText": "上海虹桥 10:30 ...",
    "facts": { "dates": null, "times": ["10:30"], "locations": ["上海虹桥"], "arrivalLocation": "虹桥火车站", "departureLocation": null, "hotel": null, "placeNames": [], "budget": null, "notes": [] },
    "confidence": 0.93,
    "needsConfirmation": false,
    "warnings": []
  }],
  "warnings": []
}
```

## 安全边界

- `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 只能放在服务端 `.env`，不要使用 `VITE_` 前缀。
- 前端只调用自己的 `/api`，不直接调用模型供应商。
- 模型只提取用户意图，不生成未经核验的景点、路线、价格或营业时间。
- 模型请求使用 `store: false`；应用仍应根据自己的隐私和日志策略处理输入文本。
- AI 生成文字必须遵守 [`AI_GENERATION_SPEC.md`](./AI_GENERATION_SPEC.md)；模型输出不能绕过服务端字段校验和行程校验。
