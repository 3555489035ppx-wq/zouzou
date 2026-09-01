# 走走｜Analytics 事件

事件由 `src/services/analytics.ts` 统一记录，开发环境保存最近 100 条。上线时可替换为真实 Analytics Adapter。

## 事件清单

打开与引导：`app_open`、`onboarding_complete`。

旅行创建：`journey_create_start`、`journey_generated`、`journey_saved`、`plan_selected`、`trip_understanding_retried`。

行程执行：`place_open`、`place_added`、`route_requested`、`route_succeeded`、`route_failed`、`route_retried`、`expense_added`、`packing_checked`、`footprint_created`、`journey_shared`、`journey_completed`。

协作与社区：`group_plan_created`、`invite_sent`、`participant_joined`、`poll_created`、`poll_vote`、`poll_vote_changed`、`poll_resolved`、`journey_generated_from_poll`、`comment_added`。

系统：`location_permission`、`performance_measure`、`weekend_create`、`date_create`、`dining_create`。

## 隐私规则

事件属性会过滤 key 中的文本、正文、URL、token、key、手机号、邮箱、经纬度、坐标、地址和位置字段。不要把旅行原文、评论正文、POI 地址或精确坐标放进事件属性。真实生产接入还应增加用户同意、保留期和删除策略。
