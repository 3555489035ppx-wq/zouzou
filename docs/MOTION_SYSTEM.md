# 走走｜Motion System（动效系统）

## 时间

- instant 100ms：按压、颜色、Tab。
- quick 160ms：小状态切换。
- standard 260ms：Sheet、局部内容。
- context 380ms：页面上下文切换。
- hero 550ms：社区回放 → 详情的单次结构转场。

## 规则

- 普通 UI 只动画 `transform` 与 `opacity`；无 bounce、无持续装饰动效。
- Motion Bot 由 AI service 状态驱动，文本与角色共用同一状态源。
- 动画中切换状态时从当前合成帧继续，返回动作无需等待结束。
- 行程走路含起步、稳定、减速、最后一步、停止；转弯提前发生。
- Reduce Motion 后关闭大 Morph、镜头移动与 shared-element 大位移，替换为 ≤150ms fade。

## 旅行状态映射

- `idle/drafting/review`：静态输入和轻量按压反馈。
- `understanding/planning`：使用明确的 loading/进度文案，不依赖无限旋转装饰。
- `plans/deciding/confirmed`：方案卡片和选中态使用 quick/standard 过渡。
- `active/completed`：路线播放、完成反馈和足迹创建由状态事件驱动；Reduce Motion 时保留信息层级，取消镜头位移。
