# 走走｜真实地图与天气服务研究

研究日期：2026-08-29

本笔记只记录官方文档、官方定价/条款页面和官方 GitHub 仓库中核实到的事实；价格、配额和条款仍应在正式上线前再次查看控制台。

## 当前项目状态

- `package.json` 已安装 `maplibre-gl`。
- `src/components/RealRouteMap.tsx` 已有 MapLibre + OSM raster fallback，也有高德 JS API 2.0 的条件加载分支。
- `src/services/amap/provider.ts` 已读取 `VITE_AMAP_KEY` 和 `VITE_AMAP_SECURITY_KEY`，但安全密钥目前会以明文配置到浏览器，仅适合本地开发；生产应改为代理服务。
- `src/services/map.ts` 仍返回 `tripDays` 的本地路线，`src/services/amap/poi.ts` 仍为空适配器。
- `src/services/weather.ts` 返回 Seed Data；首页天气文字仍是固定演示值。
- `src/demo-data/trips.ts` 的地点和路线仍是演示数据。地图当前把站点直线连接起来，不等于道路级真实步行路径。

## 供应商结论

### AMap / 高德

适合：中国大陆优先、需要中文 POI、步行/驾车/公交路径、GCJ-02 坐标的产品。

- JS API 2.0 官方定位为免费 Web 地图渲染引擎，同时提供 POI、路线、地理编码、定位和天气等能力；非商业使用可免费，商业使用需要按高德要求取得商用授权。
- 新建的 JS API Key 需要配合安全密钥；官方建议把安全密钥放在服务端，通过代理转发。
- 高德天气 Web Service 使用城市 `adcode`，`extensions=base` 返回实况，`extensions=all` 返回预报；实况和预报都应以接口返回的 `reporttime`/`reporttime` 字段为准。
- 当前公开基础服务计费页显示，天气预报查询的公开价格档为 30 元/万次；基础 LBS 为 30/24/18 元/万次分档，实际还受账号认证、月配额减免和控制台策略影响。
- 高德服务使用 GCJ-02。不要把 WGS84 GPS 点或 OSM WGS84 点直接当作高德点使用。

官方来源：

- JS API 2.0 概述：https://lbs.amap.com/api/javascript-api-v2/summary
- JS API 准备与 Key：https://lbs.amap.com/api/javascript-api-v2/prerequisites
- JS API 安全密钥：https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode
- POI 搜索：https://lbs.amap.com/api/javascript-api-v2/tutorails/search-poi
- 路径规划 2.0：https://lbs.amap.com/api/webservice/guide/api/newroute
- 天气查询：https://lbs.amap.com/api/webservice/guide/api-advanced/weatherinfo
- 基础服务价格与配额：https://lbs.amap.com/pages/base_service_price
- 坐标系 FAQ：https://lbs.amap.com/faq/advisory/others/39838

### 百度地图

适合：愿意更换地图 SDK/坐标适配、希望使用公开基础配额的中国大陆 Web 应用。

- 当前百度配额页列出个人开发者的 JS API 地理编码/路线等多项基础能力通常为 5,000 次/日，地点检索为 100 次/日；企业试用和授权版额度更高。
- 配额超出后，公开配额流量包页面显示基础服务 300 元/12 万次、基础搜索服务 300 元/12 万次；这是额外购买价格，不是所有功能的永久免费承诺。
- 百度国内默认使用 BD09LL；WGS84/GCJ02/BD09LL 之间必须按百度规则转换，否则地图位置会偏移。
- 百度老版本页面仍存在“无使用次数限制”等历史文案，实际项目应以新文档和控制台当前配额为准。

官方来源：

- JS API：https://lbs.baidu.com/docs/jsapi?title=jsapi4%2Findex
- 当前配额与流量包：https://lbs.baidu.com/cashier/quota?from=index
- 坐标转换说明：https://lbsyun.baidu.com/docs/webapi?title=geoconv%2Fguide%2Fchangeposition-base
- Web Service：https://api.map.baidu.com/lbsapi/webservice.htm

### QWeather / 和风天气

适合：地图用高德、天气单独拆出，且希望中国天气数据和低成本按量计费。

- 免费订阅公开规格为 1,000 次请求/天，提供实时、小时/每日预报等基本能力；免费订阅使用 CC BY-SA 4.0 条件。
- 标准按量计费的天气和基础服务每月前 50,000 次为 0 元，之后一档为 0.0007 元/次；例如 100,000 次约为 35 元，最终以账单和计算器为准。
- 官方文档要求使用项目自己的 API Host；旧的公共 API Host 会从 2026 年起逐步停止服务。凭据应放服务端，并配置 API/应用限制。

官方来源：

- 免费/标准/高级订阅：https://dev.qweather.com/docs/finance/subscription/
- 按量计费：https://dev.qweather.com/docs/finance/pricing/
- API Host：https://dev.qweather.com/docs/configuration/api-host/
- 安全指南：https://dev.qweather.com/docs/best-practices/security-guidelines/
- 实时天气 API：https://dev.qweather.com/docs/api/weather/weather-now/

### Open-Meteo

适合：本地原型、非商业评估，或有能力自托管服务的团队。

- 免费公共 API 无需 Key，支持坐标天气、当前天气、小时/每日预报和地理编码；公开限制为 600 次/分钟、5,000 次/小时、10,000 次/天、300,000 次/月，且无 SLA。
- 免费托管层只适合非商业使用/评估；商业使用应购买客户端点和商业许可，或者自托管。
- 官方 GitHub 服务端是 AGPLv3；自托管不等于零成本，还要承担服务器、模型数据更新、监控和许可证义务。
- Open-Meteo 文档要求天气坐标使用 WGS84；不能把高德 GCJ-02 坐标原样当成高精度天气坐标。

官方来源：

- API 文档：https://open-meteo.com/en/docs
- 地理编码：https://open-meteo.com/en/docs/geocoding-api
- 价格与限制：https://open-meteo.com/en/pricing
- 官方服务端仓库：https://github.com/open-meteo/open-meteo

### GitHub 开源组件

GitHub 上免费的是渲染器、格式和路由引擎代码，不是无限量的底图/POI/天气数据，也不自动提供 SLA。

- MapLibre GL JS：https://github.com/maplibre/maplibre-gl-js —— BSD-3-Clause，浏览器端 GPU 矢量地图渲染；项目已经使用，无需因为“真实地图”而更换。
- PMTiles：https://github.com/protomaps/PMTiles —— BSD-3-Clause 参考实现，可把矢量瓦片放进单个静态文件，用对象存储低成本分发；仍需准备合法的 OSM 数据、样式、更新任务和合规流程。
- OSRM：https://github.com/Project-OSRM/osrm-backend —— BSD-2-Clause 路由引擎，可自托管 OSM 路网；公共 demo 不是生产 SLA，也不替代中文 POI/公交数据。
- Valhalla：https://github.com/valhalla/valhalla —— MIT 路由引擎，支持步行/骑行/驾车/多模式、矩阵和等时线；自托管需要准备 OSM/GTFS 数据和 Linux/Docker 运维。
- Open-Meteo：https://github.com/open-meteo/open-meteo —— AGPLv3 天气服务端；适合研究/自托管评估，不应忽略 AGPL 和数据源署名要求。

OSM 官方标准瓦片只提供 best-effort，没有 SLA；要求可见署名、正常 Referer/缓存，并禁止批量下载和离线预取。因此 `tile.openstreetmap.org` 只能作为本地低流量演示 fallback，不应直接作为公开商业产品底图。

官方来源：https://operations.osmfoundation.org/policies/tiles/

## 对走走的推荐组合

1. 当前本地原型：高德 JS API 2.0 负责中国地图显示；天气先接 Open-Meteo 或高德天气，保留 Seed fallback；不要把 OSM 标准瓦片当生产服务。
2. 中国大陆小规模公开测试：高德地图 + 高德 Web Service（POI/路径/天气）或“高德地图 + 和风天气”；所有 REST Key 放 BFF/Serverless，前端只访问 `/api/*`。
3. 如果目标是最低长期数据费且能运维：MapLibre + 合法 OSM/PMTiles + 自托管 OSRM/Valhalla + 自托管 Open-Meteo；这不是最快上线方案，也不包含高德级别的中国 POI/公交质量。

## 必须提前设计的风险

- 坐标系：高德 GCJ-02、百度 BD09LL、OSM/Open-Meteo WGS84 要在数据模型中标明；不要只用 `lng/lat` 两个无来源字段。
- 密钥：Vite 的 `VITE_*` 变量会进入浏览器构建产物；只能放可限制的 JS Key。Web Service Key、安全密钥、QWeather Key 必须服务端保存。
- 缓存：天气按城市/日期缓存 5–15 分钟，POI 缓存短期结果，路线按点位和交通方式缓存，避免每次渲染请求接口。
- 真实路线：不能用站点直线连线冒充道路路线，应把路径接口返回的 `polyline/geometry` 传给地图组件。
- 国内公开上线：互联网地图、定位、标注和地图数据库服务可能涉及地图审核、审图号、测绘资质、境内服务器和个人位置信息保护要求，正式上线前应让地图供应商和专业合规人员确认。

相关官方规定：https://www.gov.cn/zhengce/zhengceku/2015-12/14/content_10403.htm
