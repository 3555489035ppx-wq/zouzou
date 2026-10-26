# 走走 ZOUZOU

围绕想法澄清、方案选择与行程执行，探索移动端旅行规划的交互闭环。仓库同时保留本地高保真原型和云端发布文档。

[站点入口](https://zouzou.ppx.wiki) · [本地运行](#本地运行) · [接口接入](docs/API_INTEGRATION.md) · [发布与验收](docs/RELEASE.md)

> Local Interactive Product Prototype。默认使用本地结构化解析器；已提供可选的服务端 DeepSeek/OpenAI 文本理解接口。上海地点、交通、价格和营业时间仍需在后续接入实时数据后才可用于生产。

## 项目状态与云端发布

仓库中 2026-09-14 的云端发布说明采用 Cloudflare Pages + Functions + D1，站点入口为 [走走](https://zouzou.ppx.wiki)。发布状态及实际验收见 [RELEASE](docs/RELEASE.md)、[ACCEPTANCE](docs/ACCEPTANCE.md)，手机安装和访客数据边界见 [MOBILE-GUIDE](docs/MOBILE-GUIDE.md)。下方本地原型说明保留供开发使用，不代表正式站点的架构或当前部署结果。

该发布路径的正式构建使用 `npm run build:release`，显式读取 `vite.config.ts`，复制已提交的1178个运行资源，按城市从服务端读取版本化指南。不要把完整私有采集目录、独立WorkBuddy库、`.env`、数据库或本机备份提交到Git。生产文本模型为 `deepseek-flash`，服务端密钥只在Cloudflare Secret；生产远程失败不会静默冒充本地生成成功。

云端发布文档包含显式保存与恢复、可更新和撤销的只读分享，以及匿名访客身份。访客依赖当前浏览器 Cookie，不等于账号或跨设备同步；清除 Cookie、换设备后不能保证找回。实体手机安装、系统地图/分享与国内直连仍需独立设备验收。这里保留仓库发布记录，不将历史验收视为本次重新实测。

## 本地运行

发布文档采用 Node.js 24、pnpm 11.24.0。

```bash
pnpm install
pnpm dev
```

浏览器打开 `http://localhost:4173`，推荐使用 393 × 852 的移动端视口。`/__demo` 是 Demo Center，可直接进入全部页面与角色状态。

## 接入第一步：文本理解

复制 `.env.example` 为 `.env`，填写服务端的 `DEEPSEEK_API_KEY`，并将 `VITE_REMOTE_AI` 改为 `1`：

```powershell
Copy-Item .env.example .env
pnpm server
```

另开一个终端运行 `pnpm dev`，然后访问 `http://localhost:4173/travel/new`。前端会通过 Vite 代理调用 `POST /api/trips/understand`；配置 DeepSeek 时使用 `deepseek-v4-flash`，没有 Key 时服务端会自动使用本地回退。

单独检查服务端：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8787/api/health
```

具体接口约定见 [`docs/API_INTEGRATION.md`](./docs/API_INTEGRATION.md)。

## 验证

```bash
pnpm build
pnpm test
pnpm test:e2e
```

## 核心实现

- React 19 + TypeScript + Vite
- Zustand 持久化头像、城市、收藏、草稿与行程状态
- Framer Motion 负责页面与 Bottom Sheet 动效
- 当前旅行执行以真实站点顺序和外部地图入口为准；顺序示意不代表道路地图或实际轨迹
- 可中断、可测试的 `MotionEngine` 管理角色的 10 种状态
- `server/trip-intent.ts` 支持 DeepSeek/OpenAI 的结构化 TripIntent 提取；`src/services/ai.ts` 保留本地回退，并继续执行上海方案排程、时间/营业窗口/预算校验和局部替换

产品决策、流程、设计系统、动效与边界说明见 [`docs`](./docs) 及根目录下的产品文档。

## 隐私与素材使用

[安全与隐私](docs/SECURITY_AND_PRIVACY.md) · [内容授权](docs/CONTENT-AUTHORIZATION.md) · [第三方说明](docs/THIRD_PARTY.md)

公开仓库不代表素材可任意复用；部分素材有许可和私有参考边界，复用前须核对授权。服务端密钥不得放入前端或提交到仓库，私人行程、数据库与备份同样不应公开。

## 历史维护记录

以下是仓库保留的历史检查点，供追溯实现与验收，不代表当前在线服务状态。

<details>
<summary>2026-09-05 · 01 任务书本机实施检查点</summary>


现有项目直接修改，未重新克隆。当前预览为 `http://127.0.0.1:4175/home`，接口为8787。预览与接口都需要运行；不覆盖已有 `.env`。

```powershell
node node_modules/tsx/dist/cli.mjs server/index.ts
```

另一个终端：

```powershell
node node_modules/vite/bin/vite.js build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175
```

草稿文字、已选行程与手动执行记录默认存在本机浏览器；原截图存IndexedDB，文字存储只保留小引用。生成备选不会自动加入个人行程。选用后分配独立Trip ID；同批换选只更新尚未开始的同一Trip。无ID历史行程只在选中保存时迁移单行，并保留迁移备份，其他同名历史不合并。

邀请先确认服务端协作副本范围；SQLite保存设备访客和已确认协作数据。只读分享是脱敏固定版本、持链接访问、7天有效并可撤销。普通本机保存不是云账号同步。真实账号、物理第二设备、iPhone系统相册/键盘/地图与真实访问INP仍需独立验证。

原检查点引用 `docs/qa/task01-v3.md`（01 验收报告）、`docs/audit/task01-v3-ledger.md`（18 项问题台账）、`docs/execution/task01-v3-checkpoint.md`（阶段检查点）。这些历史路径当前不在公开默认分支中，不能作为可访问的验收证据；当前仓库的发布与验收入口见上方文档。构建或单测通过不等于整份任务书通过。

</details>
