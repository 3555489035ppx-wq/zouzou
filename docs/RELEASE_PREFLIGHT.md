# 走走发布前门禁

## 本地执行

```text
npm run release:preflight
npm run typecheck
npm test
npm run build
```

`release:preflight` 会检查必需文件、脚本、环境变量说明、地图 provider 配置和生产 CORS 提示。设置 `RELEASE_PREFLIGHT_STRICT=1` 后，警告也会阻止退出成功。

## 生产必须确认

- `CORS_ORIGIN` 使用明确的线上来源，不使用 `*`。
- 若使用 AMap，确认 key、安全密钥、域名白名单、Walking 插件、商用授权和配额。
- 若使用 MapLibre 公共路线服务，确认瓦片与 OSRM 服务的归属、调用量、缓存和 SLA；公共服务仅作为本地/预发布兜底。
- 服务端响应包含 `nosniff`、`SAMEORIGIN`、严格 Referrer Policy、Permissions Policy、CSP 和 `no-store`。
- 旅行文本、截图、精确定位和路线不得进入埋点；生产账号服务必须提供 session 过期、注销、删除和导出。
- 在 320、375、393、402、430、768px 宽度检查安全区、底部导航、弹层、地图归属和键盘弹起。
- 发布前保存 typecheck、Vitest、构建产物、provider health 和性能基线。
