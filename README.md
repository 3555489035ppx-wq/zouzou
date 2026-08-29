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
- React Three Fiber / Three.js 负责行程中与社区回放的低多边形 3D 路线
- 可中断、可测试的 `MotionEngine` 管理角色的 10 种状态
- `server/trip-intent.ts` 支持 DeepSeek/OpenAI 的结构化 TripIntent 提取；`src/services/ai.ts` 保留本地回退，并继续执行上海方案排程、时间/营业窗口/预算校验和局部替换

产品决策、流程、设计系统、动效与边界说明见 [`docs`](./docs) 及根目录下的产品文档。
