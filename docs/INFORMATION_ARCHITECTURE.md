# 走走｜信息架构

```text
账号：/ → /login → /onboarding
首页：/home → 城市 Sheet / 通知
旅行：/travel/new → /travel/understanding → /travel/plans
     → /travel/plan/:id → /travel/friends → /travel/vote
行程：/trips → /trips/:id → /trips/:id/replay → /community/publish
社区：/community → /community/search → /community/:id/replay
     → 图文详情 → 使用这个行程
我的：/profile → /profile/trips|posts|favorites|likes
     → /profile/edit → /settings
场景复用：/weekend · /date · /dining
开发入口：/__demo
```

顶层 Tab 只映射 `/home`、`/trips`、`/community`、`/profile`。其余均为任务型子流程。
