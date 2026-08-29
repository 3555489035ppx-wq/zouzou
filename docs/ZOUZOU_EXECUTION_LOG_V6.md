# 走走 ZOUZOU｜V6 执行记录

更新时间：2026-08-29（Asia/Shanghai）

## 本轮完成

- 增加 `/` 启动页：走走 Logo、品牌文案，约 2 秒自动进入嵌入式首页。
- 修正展示壳安全区：状态栏、灵动岛、应用内容与底部 Home Indicator 分离；嵌入式内容改为独立滚动层。
- 行程 Tab 改为 Route 语义图标（选中黑色、未选中灰色）；地图高度收敛到约 360px，播放不再自动放大镜头；补齐“今日行程”清单与预算/停留信息。
- 行程 Bot 使用透明 Bloub SVG，播放速度调整为完整路线约 24 秒，支持暂停并保持统一状态机。
- 地图使用 Esri Canvas Light Gray Base + Reference 无 Key fallback，避免 CARTO API-key 水印；保留 AMap JS API 2.0 provider；地图尺寸变化调用 ResizeObserver，避免社区回放拼贴或空白。
- 首页 active 行程状态改为“上海 · Day 1 / 下一站 · 武康路 · 09:30”；执行页改为“上海 · 3天2晚 / Day 1 · 正在进行”，不再把进行中的行程写成明天出发。
- 启动标志的 walking 变体改为更接近用户参考图的连续曲线姿态，仍与“走走”字标一起显示。
- 首页增加按城市变化的“你可能喜欢”推荐；城市选择通过全局 `setCity` 同步首页、社区与行程标题。
- 为杭州补齐社区发现样例，避免城市切换后只显示单卡片。
- 天气适配层保留 Open-Meteo 入口，但本地原型默认使用稳定的 26°C 演示值；设置 `VITE_LIVE_WEATHER=1` 才启用实时请求，避免视觉验收随天气漂移。
- 社区回放增加地图显示开关；关闭后仅替换社区回放画面，个人行程地图不受影响。
- 我的页面封面改为可点击图片选择器，选择后立即更新并持久化。
- `DESIGN.md` 升级为 V6 Apple-aligned 规范，加入截图问题映射、滚动安全区、地图/Bot、社区开关和回归流程。

## 验证

```text
pnpm typecheck       passed
pnpm test -- --run   102 passed
pnpm build           passed
pnpm test:e2e        18 passed
```

人工复测覆盖：启动页 → 首页 → 上海/杭州/上海 → 旅行输入 → AI 理解 → 三方案轮换 → 方案详情/地图/替换/预算 → 邀请投票保存 → 行程完整路线/播放/到达/Day2 → 返回首页 → 社区回放/详情/点赞/收藏/复用 → 我的/设置。逐步记录见 [`UI_UX_AUDIT_V5.md`](./UI_UX_AUDIT_V5.md)，截图见 [`ZOUZOU_FLOW_AUDIT_2026-08-29.md`](./ZOUZOU_FLOW_AUDIT_2026-08-29.md) 和 `artifacts/audit-v5-final-flow/`。

## 交付状态

本地预览继续由 Vite 提供：`http://127.0.0.1:4173/`。交付前浏览器状态已恢复为首页，社区地图默认开启；高德 Key 可选，未配置时使用 Esri fallback。

## 最终回归补充（2026-08-29 16:30）

- 402 × 874 展示壳内重新完成从启动到首页、城市、旅行创建、AI 理解、三方案、方案详情、地图、行程播放、到达、Day 2、社区详情、复用、我的、设置并返回首页的连续操作。
- 新证据截图写入 `artifacts/audit-v5-final-flow/`；稳定地图证据为 `14-community-map-stable.png`、`15-community-detail-stable.png`、`21-trip-ready-tiles.png`。
- 地图检查确认 7/5 个节点正常渲染、加载状态退出、Bot 背景透明；底部 Dock 不透明且不穿透内容。
- 最终命令结果：`pnpm typecheck`、`pnpm build`、`pnpm test`（102 tests）、`pnpm test:e2e`（18 tests）全部通过。
