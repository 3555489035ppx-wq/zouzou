# 走走 ZOUZOU

一个可在本地完整运行的移动端高保真交互原型，围绕「有想法 → AI 澄清 → 三套方案 → 真实行程 → 3D 回放 → 社区复用」完成核心闭环。

> Local Interactive Product Prototype。默认使用本地结构化解析器；已提供可选的服务端 DeepSeek/OpenAI 文本理解接口。上海地点、交通、价格和营业时间仍需在后续接入实时数据后才可用于生产。

## 运行

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

## 01任务书本机实施检查点（2026-09-05）

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

逐项实际结果见 [01验收报告](docs/qa/task01-v3.md)、[18项问题台账](docs/audit/task01-v3-ledger.md)、[阶段检查点](docs/execution/task01-v3-checkpoint.md)。构建或单测通过不等于整份任务书通过。
