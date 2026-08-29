# 走走 ZOUZOU

一个可在本地完整运行的移动端高保真交互原型，围绕「有想法 → AI 澄清 → 三套方案 → 真实行程 → 3D 回放 → 社区复用」完成核心闭环。

> Local Interactive Product Prototype。当前使用本地结构化解析器、上海真实地点样例、确定性排程校验与静态地图/天气数据；仍不是生产发布版本。

## 运行

```bash
pnpm install
pnpm dev
```

浏览器打开 `http://localhost:4173`，推荐使用 393 × 852 的移动端视口。`/__demo` 是 Demo Center，可直接进入全部页面与角色状态。

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
- 本地 `AIAdapter` 执行 TripIntent 解析、上海方案排程、时间/营业窗口/预算校验和局部替换，并保留真实 AI 服务替换接口

产品决策、流程、设计系统、动效与边界说明见 [`docs`](./docs) 及根目录下的产品文档。
