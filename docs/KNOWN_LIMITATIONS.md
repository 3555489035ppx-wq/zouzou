# 走走｜已知限制

- 当前 Auth、Database、Analytics、Storage 仍为本地 Adapter 或浏览器内状态；旅行理解已支持可选的服务端 DeepSeek/OpenAI 结构化输出，但未配置 Key 时会回退到本地确定性解析器。
- 截图现在会通过独立的 `/api/trips/media/analyze` 进入可选视觉模型；未配置视觉 Key、模型超时或图片无法读取时，会返回低置信度 `MediaFact` 并继续文字理解，不能把回退结果当作已确认事实。
- `server/trip-intent.ts` 只负责提取 TripIntent，不负责查询地点、路线、价格或营业时间；这些事实仍需要后续接入高德和其他服务端数据源。
- 上海方案使用真实公共地点和明确的到达/返程锚点，但交通耗时、价格、开放时间与预算仍是演示估算，不代表高德实时导航、库存或订单结果。
- 天气接口失败时会显示演示天气，避免 HR 演示页面空白。
- Web Demo 只提供按压缩放等视觉反馈，没有伪装成 iOS 原生 Haptic（触感反馈）。
- 3D 使用低多边形几何体，不包含真实上海城市或精确地理坐标。
- 社区照片为本地演示素材；发布、关注、喜欢、收藏、评论不会同步到服务器。
- Apple 设计资源、SF Pro 文件、SF Symbols 导出资源未包含在项目包中。
- 这是 Local Interactive Product Prototype，不是可上架或可交易的生产服务。
