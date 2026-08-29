# V3 地图与 Zou Bot 技术依据

## 地图选择

本地高保真 Demo 使用 MapLibre GL JS。官方文档确认它支持浏览器端地图渲染、Marker、样式文档和直接导入随包 CSS；`fitBounds()` 可让相机以最高适合缩放级别容纳整条路线，适合“全天路线始终可见”的产品要求。

- MapLibre GL JS 官方介绍：https://maplibre.org/maplibre-gl-js/docs/
- `fitBounds()` 官方 API：https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#fitbounds
- Raster source 官方 Style Spec：https://maplibre.org/maplibre-style-spec/sources/#raster

当前底图使用 OpenStreetMap 标准 raster tile，仅服务本地低流量交互演示，并在地图上保留 `© OpenStreetMap contributors` 可见归属。实现不做离线下载、批量抓取或预取。OSMF 明确要求使用 HTTPS 标准 URL、保留可见归属、遵循服务缓存头，并禁止 bulk download / offline prefetch；若进入公开或商业部署，应切换为有 SLA 的地图供应商或自托管瓦片。

- OSMF Tile Usage Policy：https://operations.osmfoundation.org/policies/tiles/

## 路线表达

- 使用上海真实 WGS84 经纬度和 GeoJSON LineString。
- 初始化时用 `fitBounds()` 容纳酒店 → 武康路 → 安福路 → 咖啡 → 浦东美术馆 → 晚餐 → 酒店的全路线。
- 路线底描边与主线分层绘制，保证在复杂底图上仍可读。
- 节点用完成、当前、未来三态表达；Bot Marker 独立于地图实例更新，避免每帧重建地图。

## Zou Bot 动效原则

- 状态机只有一个权威入口：`ZouBotEngine.setState()`。
- `sample(time)` 是纯时间采样；相同状态与时间返回相同姿态。
- 状态中断时先采样当前可见姿态，再作为下一次过渡起点，因此不会跳帧。
- `pause()` / `resume()` 调整时间偏移，不在各页面散落角色定时器。
- AI 与行程共用同一黑白抽象生命体和渲染器，只切换状态与尺寸。
- 减少动态效果时直接采样稳定姿态，保留状态信息而取消空间运动。
