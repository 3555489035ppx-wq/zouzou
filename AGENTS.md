# 走走项目执行规则

本文件是 D:/走走 的项目级规则入口。产品与接口事实以当前代码及指定契约为准；历史报告只证明对应时间、环境的结果。

## 项目入口与事实来源
- 项目概况、运行命令：README.md、package.json；路由：src/App.tsx。
- 长期状态：[PROJECT_STATE](docs/codex/PROJECT_STATE.md)；当前任务：[CURRENT_TASK](docs/codex/CURRENT_TASK.md)。
- 恢复流程：[RECOVERY](docs/codex/RECOVERY.md)；关键决策：[DECISIONS](docs/codex/DECISIONS.md)；验证：[VERIFICATION](docs/codex/VERIFICATION.md)。
- 社区/个人数据契约：docs/execution/TASK02_CONTRACT.md；接口说明：docs/API_INTEGRATION.md。按任务读取对应章节，与实现不一致时明确记录，不能默默改动对外契约。

## Codex Long Task Stability
- 保护用户未提交修改，包括新增、删除、生成资源和配置。修改前读取 Git 状态和目标 diff，在当前文件上增量编辑。禁止 reset --hard、clean -fd、checkout 覆盖、替代项目或复制全项目开发。
- 大型任务先读取 README、PROJECT_STATE、CURRENT_TASK 和 Git 状态，按路由、模块、import、函数定位代码；自行读取工作区已有信息，不让用户重复提供。
- 新大型任务先更新 CURRENT_TASK 的 Task、Goal、Scope、Non-Goals、Phase 和 Resume Point；自主连续执行，不要求每阶段确认。仅无法自主确定且继续可能破坏现有工作时提问。
- 每个主要 Phase 完成后，立即在 CURRENT_TASK 写 CHECKPOINT：Phase、状态、已完成、修改文件、验证结果、未完成、Resume Point。始终保留明确的下一动作；不创建零散 checkpoint 文件。
- 项目事实或目标变化时更新 PROJECT_STATE；重要决策记录到 DECISIONS，验证命令、时间、结果和边界记录到 VERIFICATION。只存摘要和证据路径，不复制聊天或大日志。
- 中断、compact、新会话从 CURRENT_TASK 的 Resume Point 恢复，并核对当前文件、Git 和命令结果。不能仅因聊天丢失从 Phase 1 重做；已完成阶段只在新证据表明需要时重开。
- Minimize unnecessary context：禁止无目的全仓库扫描、重复读取未变的完整文件；优先 rg 定位和相关片段。排除 node_modules、dist、build、.git、缓存、_research 等与任务无关的大目录。
- Git 输出先用 `git status --short --untracked-files=normal`；若资产仍很多，将输出存临时文件，只看摘要和任务路径。先看 `git diff --stat -- <路径>`，再看目标 diff；必要时查 `git diff --cached -- <路径>`。Git diff 不包含未跟踪文件，需单独读取。
- 大日志写入任务专用临时文件，失败只读首个真实错误、附近必要上下文和尾部栈。不要把安装、构建、测试、网络完整日志写进聊天或状态文档。验收后删除本轮无用临时文件；需复现的证据保留路径。
- 网络/transport/stream/response decoding 错误先查动作是否实际完成，再只重试必要步骤；相同传输错误连续出现时落盘 Resume Point 和阻塞证据，不改业务代码“修复网络”。代码/类型/编译错误则修复相关代码后重跑必要检查。
- 只运行与改动相称的验证；本轮结果与历史结果分开，未运行写 NOT RUN。纯规则/文档变更检查结构、链接、任务 diff 和既有改动保护，无需全量 App 测试。收尾更新当前任务、验证与 Resume Point。
- 不把密钥、Cookie、令牌、用户旅行原始数据写进状态文件；引用配置变量名和证据路径即可。

## 后续大型任务执行顺序
读取状态 → Git 与相关代码核对 → 更新任务及 Phase → 执行 → 阶段 checkpoint → 必要验证 → 更新项目摘要 → 写明 Resume Point。更换任务时先简短保留上轮结果与未解决事项的证据入口，避免旧任务未完成项消失。
