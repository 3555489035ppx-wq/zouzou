# Current task

Task: 独立走走旅行聊天Agent Demo
Goal: 在单独聊天页面展示知识库问答与定制旅行攻略
Scope: /agent-demo，沿用知识库与服务端受限工具，不接入正式产品入口
Non-Goals: 不上线、不合并main、不改小程序和用户存储、不使用Work/Codex编写代码
Phase: 代码已实现，独立Demo调整中；待验证
Resume Point: 在用户许可的执行路径运行docs/TRAVEL_AGENT.md中的测试、typecheck、build，再验收Demo。不得将“单独聊天界面”误解为获准创建代码执行对话。

CHECKPOINT 2026-10-06
- 用户最新收窄：只做Demo，一个独立聊天Agent，回答包含旅行攻略
- 移除“创建旅行”页入口，恢复原表单；Demo移至/agent-demo并移除产品AppShell导航
- 上一版12文件已提交并回读，21项测试仅编写、未执行
- 本轮仍未运行自动测试、构建、浏览器或真实模型
