# 走走 ZOUZOU｜V5 执行记录

更新时间：2026-08-29（Asia/Shanghai）  
范围：本地私人演示；402×874 iPhone 17 Pro 展示壳；不发布、不接入真实账号/支付。

## 已完成

- 完成录屏 30fps 全量解码、1fps 总览、动态片段 4fps 加密检查，并保留 F01–F14 证据帧：[`artifacts/audit-2026-08-28/evidence/`](../artifacts/audit-2026-08-28/evidence/)。
- 完成审计与分阶段执行任务书：[`ZOUZOU_AUDIT_FIRST_ENGINEERING_TASKBOOK_V5.md`](./ZOUZOU_AUDIT_FIRST_ENGINEERING_TASKBOOK_V5.md)。
- 首页修复 Safe Area、天气到入口的 Grid 拉伸空白、推荐层级、进行中卡片首屏可见和首页按压/选中反馈。
- 展示壳改为自动识别 iframe。点击社区、行程、我的后仍保留 72px 内容安全区，不再覆盖 9:41、Dynamic Island、Wi‑Fi。
- 方案横滑、社区分类、收藏筛选和 Sheet 隐藏桌面 scrollbar；Sheet 标题 id 唯一且表面不透出底层内容。
- 行程地图实例与进度解耦：进度只移动角色 Marker，不重建地图；继续行程先锁定相邻节点并触发相机 fit；路线速度提高；Day 切换清除旧焦点。
- MapLibre worker 通过 `?url` 显式打包并调用 `setWorkerUrl`，避免 Vite `.vite/deps/maplibre-gl-worker.mjs` 缺失造成的偶发空地图。
- 视觉采集用例总预算调整为 120 秒，覆盖多张真实地图状态截图时不再把瓦片等待误报为测试失败。
- 地图角色 Marker 使用同一套本地 Bloub/Grok 风格 SVG 引擎，不再使用单独绘制的小人；普通 Bot 会根据鼠标位置平滑转向，行程 Bot 会朝向当前交互方向。
- 社区回放提供“跳过回放”；喜欢状态为红色，收藏保持明确的选中反馈；我的页面收藏夹可直接打开并保留筛选。
- 保留高德 JS API 2.0 provider。配置 `VITE_AMAP_KEY` 与 `VITE_AMAP_SECURITY_KEY` 时优先使用高德；无 key 的本地演示使用带归属的 OSM fallback。

## 验证结果

使用项目内置 Node/pnpm runtime：

```text
pnpm typecheck       passed
pnpm test -- --run   8 files / 98 tests passed
pnpm build           passed (Vite chunk-size warning only)
pnpm test:e2e        18 tests passed with one worker
```

另加一项展示壳回归：点击 iframe 内“社区”后 `.app-shell` 仍带 `is-embedded`，社区 Header 的 y 坐标 ≥ 70px。

## 当前边界

- 本机没有高德 key，因此截图里的实际地图仍是 OSM fallback；接入 key 后由同一 `RealRouteMap` provider 切换到高德，不改页面状态机。
- OSM/高德均只用于低流量本地演示；不要把 key、真实定位、用户资料或外部图片提交到仓库/公开部署。
- 地图瓦片加载速度受网络影响；fallback 背景只负责避免空白闪屏，不能伪装成实时地图。

## 下一次执行入口

1. 若要验收高德：仅在 `.env.local` 写入本机 key，重启 Vite，检查浅色底图、路线归属和 `fitView`。
2. 继续按任务书的冷启动流程，从 `/login` 走到 `/settings`，每个 P0/P1 记录截图与状态。
3. 任何公开发布前重新审阅 [`THIRD_PARTY.md`](./THIRD_PARTY.md)、地图服务条款和 Bloub 私有素材边界。
