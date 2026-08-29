# 走走｜Demo 实施计划

## 技术

React + Vite + TypeScript + React Router + Zustand + Framer Motion + React Three Fiber + CSS Variables。

## Adapter 边界

- `AIService`：当前 Local Mock，未来替换真实模型/API。
- `MapService`：当前抽象路线，未来替换高德/MapKit。
- `WeatherService`：当前 Seed Data，未来替换天气 API。
- `PlatformServices`：为 Auth、Database、Analytics、Storage 提供本地 Adapter 与可替换接口。

## 实施顺序

1. App Shell、Design Tokens、复用组件。
2. 登录与首页。
3. 旅行理解/规划/编辑/朋友/投票。
4. 行程 3D 执行与回放。
5. 社区与我的。
6. 场景复用、Demo Center、测试与 Review。
