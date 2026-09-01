# 走走｜架构说明

## 总览

走走是 Vite + React + TypeScript 的移动优先 Web 应用。React Router 负责页面路由，AppShell 负责 Safe Area、全局导航和底部 Tab，Zustand 负责跨页面状态，服务层负责旅行理解、知识库、地图、路线、协作和平台能力。

```text
页面 / AppShell
      │
      ├── Zustand appStore ── versioned local storage
      │        └── tripMachine (XState) 旅行主流程
      │
      ├── trip planner / city knowledge / gooh knowledge
      ├── AI adapter ── /api/trips/understand ── optional model
      ├── AMap POI + route ── MapLibre/OSRM fallback
      ├── groupPlanApi ── REST + SSE ── local SQLite repository
      └── platform adapters (Auth/DB/Storage/Analytics)
```

## 前端边界

- `src/App.tsx`：声明核心路由和演示路由。
- `src/components/AppShell.tsx`：页面容器、顶部返回、底部导航和安全区。
- `src/stores/appStore.ts`：旅行模式、当前路线、个人行程、社交本地状态、评论、工具数据和流程状态。
- `src/services/trip/tripMachine.ts`：只处理旅行生命周期转移，不创建地点或调用网络。
- `src/services/trip/schemas.ts`：所有跨边界旅行对象的运行时校验。
- `src/services/trip/planner.ts`：确定性规划、预算和地点替换；不把估算冒充实时事实。
- `src/services/ai.ts`：本地 AI Adapter 与服务端 AI Adapter 的统一接口，失败回退本地解析。
- `src/services/amap/`：高德加载、POI 搜索/匹配、路线与坐标来源标记。
- `src/services/groupPlanApi.ts`：协作 REST/SSE 客户端，响应先解析再交给页面。

## 服务端边界

`server/index.ts` 是本地 BFF。它负责 CORS/安全响应头、请求大小限制、旅行意图和截图请求清洗、AI Provider 选择、攻略查询，以及 Group Plan 路由分发。AI 密钥只从服务端环境变量读取。

`server/group-plans.ts` 使用 Node SQLite 保存本地协作计划、参与者、投票和更新通知。它是可替换的 Repository，不等同于生产云数据库；SSE 只覆盖当前本地服务进程订阅者。

## 状态与错误

异步服务统一使用 `idle/loading/success/empty/timeout/unauthorized/rate-limited/offline/cancelled/error`。旅行主流程用 XState 约束可达状态；网络、AI、POI 和路线失败必须进入可解释的错误或降级态。

## 数据可信度

地点带有 `coordinateSystem`、`coordinateSource`、`resolutionStatus`、`mapStatus`、`verifiedAt` 和 `factState`。没有 POI 解析结果时不绘制假路线；知识库估算值使用 `estimated` 或“需要核验”提示。
