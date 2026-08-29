# ZOUZOU iOS 交互与 Motion Bot 工程研究

> 调研日期：2026-08-28。范围仅含 Apple 官方设计资料，以及 `jeremy-prt/bloub` 官方仓库在提交 [`b4bb3c1`](https://github.com/jeremy-prt/bloub/tree/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749) 的文档与源码。以下结论服务于 393 × 852 pt 的 React/Vite 本地高保真 iOS 风格 Prototype（原型），不是原生 UIKit 尺寸表，也不是法律意见。

## 结论先行

1. 「像 iOS」首先是结构和行为正确：尊重 Safe Area（安全区域），顶部层级导航与底部顶层导航职责分开，Sheet（底部浮层）任务短而聚焦，控件可触达、状态明确、可被辅助技术理解。Apple 的当前 [HIG](https://developer.apple.com/design/human-interface-guidelines/) 强调 hierarchy、harmony、consistency，而不是要求第三方界面逐像素复制系统皮肤。
2. Apple Design Resources（Apple 设计资源）适合校验布局与组件语法，但其许可限制实际模板内容的使用与再分发；本 Windows 本地 Web Demo 不应嵌入 UI Kit 素材、SF Pro 字体文件或从 SF Symbols 导出的资源，应该用原创 CSS、系统字体栈和原创 SVG 图标实现。[Apple Design Resources](https://developer.apple.com/design/resources/)；[Apple Design Resources License](https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf)；[Apple Fonts 与许可](https://developer.apple.com/fonts/)
3. `bloub` 最值得借鉴的是动画架构，不是角色外观：纯时间采样、外部时钟、声明式状态、同拓扑形状插值、过渡中断连续、局部 ease-out。仓库也明确说明 MIT 覆盖代码而非其模仿的 xAI/Grok 视觉。[README](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/README.md#license)

## 1. Apple 官方规范：对 ZOUZOU 的有效约束

- 截至调研日，Apple Design Resources 已列出 iOS 27 / iPadOS 27 UI Kit，SF Symbols 官方页显示 7,000+ symbols。设计校验应先锁定一个目标系统版本，避免把不同代的栏位与材质语言混在同一界面；本原型只取组件结构和交互规范，不复制 Liquid Glass 外观。[Apple Design Resources](https://developer.apple.com/design/resources/)；[SF Symbols](https://developer.apple.com/sf-symbols/)

### 1.1 Layout 与 Safe Area

- Safe Area 是不会被工具栏、Tab Bar（标签栏）及设备交互/显示结构遮挡的区域；关键内容与交互控件必须位于其中，背景和媒体可以延伸到边缘。[Layout — Guides and safe areas](https://developer.apple.com/design/human-interface-guidelines/layout#Guides-and-safe-areas)
- Apple 建议界面适应设备、方向、语言与文字尺寸变化，并在多种尺寸上预览；393 × 852 pt 因而是主设计基准，不应成为写死且不可滚动的画布。[Layout — Best practices](https://developer.apple.com/design/human-interface-guidelines/layout)
- iOS 中应避免贴屏全宽按钮；主要按钮应与系统边距和相邻安全区域对齐。[Layout — iOS](https://developer.apple.com/design/human-interface-guidelines/layout#iOS-iPadOS)

### 1.2 Navigation Bar、Tab Bar 与 Search

- iOS 的导航专用顶部 Toolbar（工具栏）也称 Navigation Bar（导航栏）：标题用于确认当前位置，返回与关闭应采用熟悉、稳定的标准语义；空间有限时只保留最重要操作，其余进入 More 菜单。[Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)
- Tab Bar 只用于顶层区域导航，不承担“创建、发布、筛选”等动作；跨顶层页面应保持可见，并用简短单词标签帮助识别。[Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- 选中项可用 filled variant（填充变体）加强状态，未选中项用 outline；SF Symbols 会随文字权重/尺寸适配，但它们不能用于 Logo 或商标用途。[SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols)
- Search（搜索）入口可位于 Tab Bar、顶部/底部 Toolbar，或直接嵌入内容；位置取决于搜索的重要性与内容结构。[Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)

### 1.3 Sheets、Modal、Alerts 与 Page Control

- Sheet 适合与当前上下文紧密相关的短任务；不应用来浏览全局内容。iOS Sheet 可为 modal 或 nonmodal，但都应保留父级上下文感。[Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
- Modality（模态）会中断父视图：只在有明确收益时使用，任务应短而简单，必须提供明显的关闭方式；不要叠加多个 Modal，并在未保存内容可能丢失时确认。[Modality](https://developer.apple.com/design/human-interface-guidelines/modality)
- Alert（警报）只用于立即需要注意且可行动的信息；可撤销的常规操作不应频繁弹警报，破坏性操作要有安全的取消路径。[Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts)
- Page Control（页码指示器）表示有序、同级的页面列表，通常水平居中靠近底部；约 10 个以上圆点难以扫读。快速 scrubbing（连续拖动）时避免给每页都播放滚动动画。[Page controls](https://developer.apple.com/design/human-interface-guidelines/page-controls)

### 1.4 Buttons、Touch Target 与 Typography

- 自定义按钮需要明确的 pressed state（按下态），并至少提供 44 × 44 pt hit region（命中区域）；同屏主强调按钮应控制在一到两个。[Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- Apple Accessibility 对 iOS/iPadOS 给出的默认控件尺寸是 44 × 44 pt、最低控件尺寸是 28 × 28 pt；高频触控仍应按 44 × 44 pt 设计，并在相邻控件间留足间距。[Accessibility — Mobility](https://developer.apple.com/design/human-interface-guidelines/accessibility#Mobility)
- iOS/iPadOS 正文的系统默认尺寸为 17 pt；自定义文字最低建议为 11 pt。应优先使用内建文字层级并让布局适应 Dynamic Type（动态字体），避免在大字号下截断关键信息。[Typography](https://developer.apple.com/design/human-interface-guidelines/typography)；[Accessibility — Vision](https://developer.apple.com/design/human-interface-guidelines/accessibility#Vision)

### 1.5 Accessibility 与 Reduce Motion

- 所有交互元素要有可读名称；状态不能只靠颜色表达。Apple 以 WCAG AA 作为 Accessibility Inspector 的参考：普通小字号文本 4.5:1，大字号/粗体可为 3:1，并要求同时检查浅色、深色和 Increase Contrast。[Accessibility — Color and effects](https://developer.apple.com/design/human-interface-guidelines/accessibility#Color-and-effects)
- Motion（动效）应传达状态、反馈或空间关系，不应延迟用户操作；用户应能中断动画，且重要信息不能只通过动效表达。[Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- Reduce Motion（减少动态效果）开启时，应减少自动与重复动画、缩放和周边运动，优先用 fade（淡入淡出）替代 x/y/z 位移，避免 blur 与景深动画。[Accessibility — Motion](https://developer.apple.com/design/human-interface-guidelines/accessibility#Motion)

## 2. `jeremy-prt/bloub`：可借鉴的动画工程

### 2.1 Pure Time Sampling（纯时间采样）

- `src/bot/` 没有框架依赖和真实时钟；`engine.sample(t)` 被定义为时间的纯函数。相同时间应得到相同帧，因此暂停、跳转、离屏测试和导出都可复现。[Architecture — engine has no framework and no clock](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/docs/architecture.md#the-engine-has-no-framework-and-no-clock)；[`BotEngine.sample`](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/src/bot/engine.ts#L424-L458)
- 时间推进由 Vue 组件外层的 `requestAnimationFrame` 驱动，且隐藏标签页恢复时把单帧增量限制到 64 ms，避免动画突然跳远；引擎本身不读取 `Date.now()` 或 `performance.now()`。[`BloubBot.vue` clock driver](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/src/components/BloubBot.vue#L320-L345)

### 2.2 Interruptible Transition（可中断过渡）

- 状态切换若发生在上一段 fade 尚未完成时，`setState` 先采样并冻结“当前屏幕真正显示的合成 Pose（姿态）”，再从它过渡到新目标，避免回跳到旧状态的完整终点。[Architecture — state change inside a fade](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/docs/architecture.md#the-engine-has-no-framework-and-no-clock)；[`BotEngine.setState`](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/src/bot/engine.ts#L398-L421)
- 冻结只发生在“过渡中再次切换”的情况；每次都冻结会让离场状态自身动画停死。`sample()` 也不清理历史状态，否则回读旧时间会变得不可复现。[Architecture](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/docs/architecture.md#the-engine-has-no-framework-and-no-clock)

### 2.3 State Machine、Morphing 与 Ease-out

- 状态由数据表声明：每个状态拥有 id、duration、morph 时长与基于局部时间的 `pose(t)`；渲染器只解释状态数据，而不是在组件中散落定时器。[`StateDef` 与 states](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/src/bot/states.ts#L168-L206)
- 所有轮廓在相同的 64 个角度采样，因此任意两形状的点一一对应，Morph（形变）只需线性插值半径，无需 path-morph 库。[Architecture — angular sampling](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/docs/architecture.md#every-silhouette-shares-the-same-angular-sampling)；[`shape.blend`](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/src/bot/shape.ts#L58-L74)
- 状态过渡使用 `easeOutQuint` 并 clamp 到 `[0,1]`；主体不 overshoot（过冲）。Spring（弹簧）只在确有语义的局部效果中使用，而不是全局套用弹性引擎。[`math.ts` easings](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/src/bot/math.ts#L12-L24)；[Architecture — Springs are local](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/docs/architecture.md#springs-are-local-and-deliberate)

### 2.4 License 与视觉边界

- 仓库代码是 MIT：允许使用、修改和再分发，但复制代码或其 substantial portions（实质部分）时必须保留版权与许可声明。[LICENSE](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/LICENSE)
- 作者明确指出：MIT 只覆盖仓库代码，不覆盖它所模仿的 xAI/Grok 设计；项目也不隶属或获 xAI 背书。[README — License](https://github.com/jeremy-prt/bloub/blob/b4bb3c1b5f93c7b87a2e8d620f667c4093d97749/README.md#license)
- 因此可安全借鉴的是通用工程方法；不应复制 `profiles.ts` 的测量轮廓、14 个状态的具体 silhouette、眼睛/轨道/粒子组合、品牌配色、命名与演出节奏。ZOUZOU 必须以原创“迈步小人”骨架、重心、步态和方向构建自己的状态语言。

## 3. React/Vite Prototype 的强制实现规则

### App Shell 与组件

1. 主视口以 `393px` 为基准宽度，但内容容器使用 `width: min(100%, 393px)`；纵向内容允许自然滚动，不写死 `852px` 高度。HTML 使用 `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`；顶部间距采用 `max(var(--page-margin), env(safe-area-inset-top, 0px))`，其他三边同理，兼顾安全区与常规页面边距。[WebKit — Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
2. `ZouNavigationBar` 仅承载返回/关闭、短标题和 1–2 个关键动作；`ZouTabBar` 永久固定四个顶层目的地：`首页｜行程｜社区｜我`。Tab 不执行创建动作，不在二级流程中改顺序。
3. `ZouBottomSheet` 用原生 `<dialog>` 或等价的可访问 dialog pattern 实现：打开时锁定背景交互、设置标题、自动聚焦首个有意义控件、支持 Esc/遮罩/显式关闭、关闭后恢复触发器焦点；支持 medium/large snap point 与 grabber，存在未保存内容时拦截关闭；全局同一时刻只允许一个 Sheet。
4. `ZouButton` 的视觉图形可以小于 44 px，但可点击盒以 `44 × 44 CSS px` 作为逻辑 viewport 下的工程近似（不宣称 pt 与 CSS px 恒等）；必须包含 `:active`/pressed state，P0 主操作每屏最多一个明显高强调按钮。图标按钮必须有 `aria-label`。
5. 字体使用 `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif`，不把 SF Pro 文件打包进项目。建议 token：Large Title `34/41`、Title 2 `22/28`、Headline/Body `17/22`、Footnote `13/18`、Caption `12/16`，最小 Caption `11/13`；容器不得依赖单行固定高度，浏览器缩放到 200% 时核心操作仍可见。
6. Tab、投票、喜欢、收藏、成功/错误状态不得只靠黑灰或颜色变化；同时提供文字、fill/outline、图形或 `aria-pressed`/`aria-current`。普通文本对背景至少按 4.5:1 校验。
7. `ZouSearchBar` 使用原生 `<input type="search">`，placeholder 说明可搜索的对象（如“搜索地点、路线或描述”），并实现 query、focus、clear、suggestion、loading、empty、error 与结果状态，不能只画一个不可用搜索框。
8. 社区图片轮播的 Page Control 居底居中，展示数量控制在约 10 项以内；每个 dot 有可访问名称与足够命中区；拖动过程中直接跟手，不为每个经过页面触发独立长动画。

### Motion Bot 动画内核

9. 建立与 React 解耦的 `src/character/engine/`：任何采样函数不得读取 DOM、React state、`Date.now()` 或 `performance.now()`。推荐最小接口：

```ts
type BotState = 'idle' | 'listening' | 'reading' | 'thinking' | 'planning' |
  'updating' | 'success' | 'alert' | 'error' | 'walking'

interface MotionEngine {
  sample(timeSeconds: number): BotFrame
  setState(next: BotState, timeSeconds: number): void
  reset(next: BotState, timeSeconds: number): void
}
```

10. `requestAnimationFrame` 只存在于 React adapter/hook 中；它把时间传入 engine。页面隐藏后恢复时限制单帧 delta，卸载时取消 RAF。测试可直接调用 `sample(0)`, `sample(0.16)`，不挂 DOM。
11. 每次状态切换记录 `fromPose`、`toState`、`transitionStart` 与 duration。若在过渡中再次切换，先 `sample(now)` 得到当前合成帧并将其作为新的 `fromPose`，保证位置与形状 C0 continuous（位置连续），用户返回或改状态无需等动画结束。
12. 用原创、同拓扑参数表达走路小人：头、躯干、左右臂腿分别保有稳定点数或稳定骨骼参数；只插值重心、倾斜、步幅、肢体角度、速度和停顿。禁止导入 bloub 的径向 profile、眼睛、圆球、轨道、粒子和 14 状态数据。
13. 默认过渡使用 `ease-out`（快速响应、自然收尾），主体不使用 overshoot；仅在“轻触反馈/成功确认”等有明确语义处允许非常轻的局部弹性。Tab 小人反馈必须 ≤ 200 ms，按钮按下只做 `scale(0.98)`。
14. AI Flow（AI 流程）状态必须由服务状态驱动，而不是 Bot 自行计时猜测：`understandTrip()` 推进 listening → reading → thinking，`generatePlans()` 推进 planning，局部替换推进 updating；文本进度与角色状态使用同一状态源。

### Reduce Motion、测试与合规

15. `reduceMotion = demoSetting ?? matchMedia('(prefers-reduced-motion: reduce)').matches`。开启后：关闭大范围 Morph 和 Hero 位移、取消 3D 镜头推进与持续视差、把页面/Sheet 过渡替换为短 fade；保留静态状态图形与同步文本，功能流程和完成反馈不能消失。
16. 必测四个动画不变量：同一 state/time 采样结果一致；连续两次中断前后第一帧无位置跳变；暂停/恢复不快进；Reduce Motion 下无大位移、缩放和自动重复镜头。
17. 视觉资产必须原创。若实际复制 `bloub` 的实质代码，应在项目的 Third-Party Notices 保留其 MIT copyright 与许可全文；如果只重新实现上述通用架构思想，则代码、命名、状态参数和测试都应独立编写。Apple UI Kit、SF Pro 文件与导出的 SF Symbols 不进入本 Windows Web Demo 包。
