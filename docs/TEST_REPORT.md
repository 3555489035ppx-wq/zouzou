# 走走｜测试报告

> 最后更新：2026-08-31；本报告记录本轮最终本地回归结果。

## 已完成

- `pnpm test`：33 个测试文件、197 个用例通过。
- 状态机转移、TripIntent/TripUnderstanding/GeneratedPlan/GroupPlan 运行时校验已有单元测试。
- 规划器必去地点保留、上海博物馆东馆候选、AMap POI 超时降级已有回归覆盖。
- 旅行主链路和地图状态已有 Playwright 场景，已验证文本 → 三方案 → 详情以及地图未匹配降级。

## 最终回归结果

- `pnpm typecheck`：通过。
- `pnpm test`：通过，33 个测试文件、197 个用例。
- `pnpm build`：通过；仅有 Zod 注释提示和产物体积提示，不影响构建结果。
- `pnpm test:e2e`：通过，28/28，耗时约 1.3 分钟。
- `pnpm release:preflight`：通过；提示生产环境仍需配置精确 `CORS_ORIGIN`，并确认地图瓦片/步行路线服务的归属、归因和 SLA。
- 非环境文件凭据扫描：未发现凭据字面量；本轮未输出或提交任何环境变量值。

## 发布前命令

```text
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## 已修复的回归

- 规划器饮食变量引用导致的运行时异常。
- 必去地点被同义 POI 替换后无法识别的问题。
- 高德解析长时间无响应导致地图永久 loading 的问题。
- 旅行方案中缺少上海博物馆东馆候选的问题。
- 协作接口和 AI 响应缺少客户端运行时校验的问题。

## 截图验收

- 基线：`research/taskbook-baseline/`
- 最终：`research/taskbook-final/`（最终回归生成）
- 最终截图均按 393×852 生成，覆盖首页、创建、理解、方案、详情、行程、社区、社区详情和个人页。
- 目标尺寸：393×852，另检查 375 和 430 宽度下的 Safe Area/底部操作区。
- Impeccable bundled detector：当前环境缺少其 detector bundle，脚本未能执行；因此以实机截图和自动化回归结果作为本轮 UI 验收证据。
