# 走走设计契约

页面继续使用 `src/styles.css` 中的 CSS variables 作为唯一 token 来源。新增组件必须复用这些变量，不在页面内写第二套颜色、圆角或安全区数值。

## 布局

- 应用壳宽度：`min(100%, 393px)`；小屏使用 `width: 100%`。
- 顶部导航：`env(safe-area-inset-top)`；底部导航和浮层：`env(safe-area-inset-bottom)`。
- 可点击目标至少 44px；按钮和链接保持原生语义，并提供可见 `:focus-visible`。
- 地图只展示 provider 返回的道路几何；请求失败保留底图和地点，不画直线或装饰性假路线。

## 状态与文案

- 异步状态统一使用 `idle / loading / success / empty / timeout / unauthorized / rate-limited / offline / cancelled / error`。
- `真实路线` 只在服务成功返回道路几何后使用；候选 POI、价格、营业时间必须标记为待核验。
- AI 的 thinking 只用于圆形 AI 卡片；地图机器人使用行走/交通/到达表现。
- 页面必须提供加载、空、错误、无权限、重试和文字替代路径。
