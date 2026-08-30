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

### 城市攻略知识库（20 城城市事实候选 + 小红书/B 站社区线索）

项目通过 OpenCLI 以低频只读方式采集热门城市的社区搜索结果，写入 `data/travel-guides.json`。小红书使用用户控制的已登录浏览器会话读取搜索结果和少量正文；B 站当前只使用公开搜索元数据。采集器只保存标题、作者、可用的发布时间/热度、去参数化来源链接、主题标签、地点/小吃/本地生活线索，不保存原文、图片或 Cookie：

```powershell
# 默认采集 20 个城市：上海、杭州、苏州、南京、成都、厦门、北京、广州、重庆、西安、深圳、长沙、青岛、武汉、昆明、三亚、桂林、哈尔滨、贵阳、张家界
pnpm guides:collect

# 先小批量验证；每个平台请求间隔至少 2 秒
pnpm guides:collect -- --cities 上海,杭州 --platforms xiaohongshu,bilibili --topics route,food,local --limit 5 --details 1 --delay 2500
```

用户提交旅行描述时，服务端会先识别城市、天数、同行人数、节奏和明确忌口，再按城市与文字检索知识库，将最多 8 条摘要作为外部经验线索传给模型。城市事实层已覆盖 20 城的知名景点、本地小吃、城市漫步和本地生活项目；小红书/B 站内容仍统一标为社区线索/待核验。饮食风险会在检索、排程和最终校验三处过滤；攻略线索不能覆盖用户日期、到达、返程、住宿、预算等硬约束，其中的价格、营业时间、路线和预约状态也不会直接变成事实。方案详情会保留来源链接，供用户复核。

知识库查询接口：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/guides?city=上海&q=citywalk&limit=5"
```

小红书登录、浏览器会话、B 站公开检索和采集边界见 [`travel-guide-source-integration.md`](./research/travel-guide-source-integration.md)。

### 城市真实图片

首页推荐、社区卡片和发布封面使用 `public/assets/cities/` 中的真实城市地标照片，不使用随机图库或小红书图片。照片来自 Wikimedia Commons，作者、许可证和来源页记录在 `public/assets/cities/sources.json`；重新拉取素材可运行：

```powershell
pnpm images:sync
```

图片是真实地点照片，不等于当天营业、天气或路线事实；行程中的 POI、交通和开放状态仍需出行前复核。

### `GET /api/health`

用于确认服务是否启动，以及当前使用的供应商：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8787/api/health
```

### `POST /api/trips/understand`

请求：

```json
{
  "text": "2026年9月18日到9月20日去武汉，两个朋友，预算4000元，10:30到武汉站，18:30从武汉站返程。想去黄鹤楼、东湖，想吃本地小吃，但不吃辣、海鲜过敏，不想太赶。",
  "media": []
}
```

返回的 `intent` 包含日期、人数、预算、节奏、必去地点、偏好、结构化 `dietary`、到达/返程锚点和 `missing`。服务端会再次规范日期和时间，并自动补充缺失的关键锚点。

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

### 行程理解如何使用攻略线索

```text
用户城市/行程输入
  -> 服务端识别城市
  -> 先提取天数、节奏、饮食限制等用户约束
  -> 检索城市知识条目与 data/travel-guides.json 的短摘要
  -> DeepSeek 提取 TripIntent（攻略不能制造硬约束）
  -> 排除命中辣味、海鲜、过敏原或明确忌口的餐饮候选
  -> 确定性排程器生成并校验时间、预算和必去覆盖
  -> 方案详情展示社区来源，提示出行前复核
```

当前版本对 20 个城市都能输出完整的多日时间轴和预算结构；城市事实候选层目前有 199 条命名条目，社区摘要为 390 条（B 站 282、小红书 108）。上海有更完整的示例地点与营业窗口，其他城市的静态候选仍明确标注“真实 POI 与路线待复核”，不能把演示地图当作导航结果。

## 安全边界

- `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 只能放在服务端 `.env`，不要使用 `VITE_` 前缀。
- 前端只调用自己的 `/api`，不直接调用模型供应商。
- 模型只提取用户意图，不生成未经核验的景点、路线、价格或营业时间。
- 模型请求使用 `store: false`；应用仍应根据自己的隐私和日志策略处理输入文本。
- AI 生成文字必须遵守 [`AI_GENERATION_SPEC.md`](./AI_GENERATION_SPEC.md)；模型输出不能绕过服务端字段校验和行程校验。
- 旅行攻略来源（包括小红书和 B 站）只能作为社区体验候选线索；小红书读取依赖用户控制的浏览器会话，B 站当前只使用公开搜索元数据，接入边界和来源字段见 [`travel-guide-source-integration.md`](./research/travel-guide-source-integration.md)。
