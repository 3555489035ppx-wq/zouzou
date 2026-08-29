# 中国境内旅行/步行应用：真实地图与天气接入方案

> 调研日期：2026-08-29。范围限定为高德、腾讯位置服务、百度地图、MapLibre、OpenStreetMap/OSMF、Open-Meteo、WeatherAPI 的官方文档、条款、价格/配额页面，以及官方 GitHub 仓库。价格、配额和条款会变化，正式上线前应再次打开原文复核。

## 结论先行

对 `D:\走走` 这种 React/Vite、主要面向中国境内城市步行路线的产品，建议采用“国内地图供应商适配器 + 天气供应商适配器”的边界：

1. 生产地图优先接入高德 JS API 2.0；高德官方将其定义为免费 Web 地图渲染引擎，但商业目的使用仍需事先取得商用授权。当前仓库已有高德 provider 边界，这条路径改动最小。[高德 JS API 2.0 概述](https://lbs.amap.com/api/javascript-api-v2/summary)、[高德开放平台服务协议](https://lbs.amap.com/pages/terms/)
2. 天气如果只需要当前天气、短期预报，最省钱的商业组合是“国内地图 + WeatherAPI Free”：官方价格页列出 `$0/月`、`100K calls/月`，并把 Commercial Use 标为 Yes；但必须保护 API key，并按免费层要求提供回链/署名。[WeatherAPI 价格](https://www.weatherapi.com/pricing.aspx)、[WeatherAPI 条款](https://www.weatherapi.com/terms.aspx)
3. Open-Meteo 很适合非商业原型或评估：免费层无 key，但限制为非商业使用，官方价格页列出 600 次/分钟、5,000 次/小时、10,000 次/日、300,000 次/月，且无 uptime 保证。商业上线要购买 customer endpoint 的商业许可，不能把免费层当成商用许可。[Open-Meteo 价格](https://open-meteo.com/en/pricing)、[Open-Meteo 官方仓库 README](https://github.com/open-meteo/open-meteo#terms--privacy)
4. MapLibre GL JS 只是开源渲染引擎，不提供地图数据、POI、路线或天气，也没有统一的“免费生产瓦片”。它可以作为国内供应商地图的前端渲染层，但瓦片、样式、坐标和服务条款必须由实际数据供应商单独负责。[MapLibre GL JS 文档](https://maplibre.org/maplibre-gl-js/docs/)、[MapLibre GL JS 官方仓库](https://github.com/maplibre/maplibre-gl-js)
5. 不应把 `tile.openstreetmap.org` 作为公开商业产品的生产底图依赖：OSMF 允许正常的人工交互浏览，但明确无 SLA、可能无通知封禁，禁止批量下载/离线预取；商业服务尤其要考虑访问随时撤回。[OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
6. 中国境内必须把“商用授权、地图审核/备案、测绘资质边界、用户定位隐私、坐标系”作为上线门槛，而不是上线后的补充工作。《地图管理条例》规定互联网地图服务单位应依法取得相应测绘资质、地图数据服务器设在境内、使用依法审核批准的地图并按规定备案；移动互联网应用登载使用地图还应按自然资源部/工信部通知履行地图审核和 ICP 备案等程序。[地图管理条例](https://www.gov.cn/zhengce/zhengceku/2015-12/14/content_10403.htm)、[自然资源部办公厅/工业和信息化部办公厅关于规范移动互联网应用程序中登载使用地图行为的通知](https://hnca.miit.gov.cn/zwgk/tzgg/tz/art/2024/art_270c90866b994bb69a020ce812de6278.html)

## 供应商核查

### 国内地图：高德、腾讯位置服务、百度地图

| 供应商 | 适合的接入 | 官方公开的额度/价格要点 | 商业/生产结论 | 坐标要点 |
| --- | --- | --- | --- | --- |
| 高德 | JS API 2.0 + WebService API；支持地图、POI、地理编码、步行规划、天气等 | 当前基础服务计费页：基础 LBS 0–30 万次为 30 元/万次，30–100 万次为 24 元/万次，超过 100 万次为 18 元/万次；JS 地图图面初始化为 3 元/万次；天气预报为 30 元/万次。月配额表中，个人认证开发者的 JS 地图图面初始化为 150 万次/月、QPS 10；基础 LBS 服务共享配额为 15 万次/月、QPS 3；天气为 5,000 次/月、QPS 3。企业/技术服务许可档位更高。[基础服务计费说明](https://lbs.amap.com/pages/base_service_price) | JS API 概述明确：非商业可免费，商业目的须事先取得商用授权；法人/组织自行运营或为第三方开发商业系统，都需要事先购买技术服务许可。条款还禁止抓取、预读取、存储原始地图数据、封装服务以及压力测试。[JS API 概述](https://lbs.amap.com/api/JavaScript-api/summary)、[服务协议](https://lbs.amap.com/pages/terms/) | 高德底图使用 GCJ-02；GPS/WGS84 坐标应使用官方 `AMap.convertFrom` 转换后再叠加，官方示例一次最多转换 40 组坐标。[高德坐标说明](https://lbs.amap.com/api/javascript-api-v2/guide/abc/basetype)、[其他坐标转高德坐标](https://lbs.amap.com/api/javascript-api-v2/guide/transform/convertfrom) |
| 腾讯位置服务 | WebService API + 在线地图/JavaScript GL API；适合把步行规划、地点搜索、天气放在同一账户体系 | 配额页（最近更新时间 2025-11-13）列出：个人 WebService 步行规划 6,000 PV/日、QPS 5；技术公益 300,000 PV/日、QPS 100；商业授权 500,000 PV/日、QPS 200。天气分别为 6,000/5、10,000/5、3,000,000/200。商业授权客户还可购买流量包 300 元/10 万次、并发包 400 元/10 QPS/月。[配额限制说明](https://lbs.qq.com/dev/console/quotaImprove) | 配额页明确：个人/非商业可使用在线地图和 JavaScript GL API；企业或其他非公益机构持续使用必须办理商业授权，企业技术公益额度最长为 180 天测试额度。WMTS 栅格瓦片是高级付费服务，试用需商务开通，不是免费生产瓦片。[配额限制说明](https://lbs.qq.com/dev/console/quotaImprove)、[WMTS 栅格瓦片服务](https://lbs.qq.com/service/webService/webServiceGuide/WMTS) | 腾讯定位 SDK 文档说明默认坐标为 GCJ-02，并支持 WGS84/GCJ-02；WebService 文档还提醒 key 应分配额度，尽量不要在网页端直接调用带 key 的 WebService。[腾讯定位 SDK 坐标说明](https://tencentlocation.github.io/doc/com/tencent/map/geolocation/TencentLocationManager.html)、[WebService 入门指南](https://lbs.qq.com/service/webService/webServiceGuide/overview) |
| 百度地图 | JSAPI 4.0（新项目）；JSAPI GL/3.0 文档目前标为历史版本；Web API 可补充天气、地理编码和路线 | 当前权益页：JS API 步行路线规划个人 5,000 次/日、QPS 3；企业试用 100,000/30；企业授权 300,000/200。国内天气 Web API 为个人 5,000/3、企业试用 100,000/30、企业授权 3,000,000/1,000。配额流量包基础服务 300 元/12 万次；步行等基础服务并发为 40 元/QPS/月。[开发者权益/配额提升](https://lbsyun.baidu.com/solutions/privilege)、[配额提升价格](https://lbsyun.baidu.com/cashier/quota?from=privilege) | 百度服务条款规定非商业可申请免费配额；商业目的或直接/间接获益须事先取得特别书面许可，商业使用不享有免费配额/并发，购买商用授权与购买配额是两件事。条款禁止直接抓取、复制、封装，并要求地图审核/备案和保留审图号等权利声明。[服务条款](https://lbsyun.baidu.com/docs/pcsa?title=law/open/law)、[JSAPI GL 服务介绍](https://lbsyun.baidu.com/docs/jsapi?title=jspopularGL/index) | 国内百度地图默认使用 BD09；官方说明 WGS84/GCJ02 坐标调用百度服务前应先转换为 BD09，并建议只使用百度官方坐标转换，不使用其他渠道的转换方法。国内可选择 GCJ02 或 BD09 返回；海外使用 WGS84。[百度坐标系说明](https://lbsyun.baidu.com/skins/MySkin/resources/iframs/coordinate.html)、[百度 Android 坐标转换说明](https://lbsyun.baidu.com/docs/android?title=androidsdk/guide/tool/coordinate) |

补充判断：三个国内供应商都能覆盖“地图 + 搜索/地理编码 + 步行路线 + 天气”，但免费额度只说明调用额度，不等于商业许可证。高德、腾讯、百度公开页面都把商业授权和调用配额分开或按不同身份管理；不能因为某个接口显示免费，就推断整套商业应用可以零授权上线。

### MapLibre 与 OpenStreetMap/OSMF

- MapLibre GL JS 官方仓库采用 3-Clause BSD，官方文档将它描述为“在浏览器中用 WebGL 渲染 vector tiles 的 TypeScript library”。它的 `style` 只是引用数据源；官方示例使用 Demo tiles/MapTiler，并提示真实项目应取得数据供应商自己的 key。因此 MapLibre 的软件许可不授予任何地图数据或瓦片服务权利。[MapLibre GL JS 官方仓库](https://github.com/maplibre/maplibre-gl-js)、[MapLibre 文档 Introduction](https://maplibre.org/maplibre-gl-js/docs/)
- OSM 数据可使用，但 `tile.openstreetmap.org` 是捐赠支持的公共瓦片基础设施，不是无限量免费 CDN。OSMF 要求使用准确的 HTTPS URL、可见 `© OpenStreetMap contributors` 归属、合适的 User-Agent/Referer，并遵守缓存头（无法读取时至少缓存 7 天）。[OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- OSMF 明确禁止批量抓取、预取、离线下载、后台预热和制作瓦片归档；服务 best-effort、无 SLA，商业服务或募资服务的访问可能随时撤回。结论是：本地 Demo 或低流量人工浏览可以按政策使用；公开商业生产环境应换成有 SLA 且明确允许生产/离线策略的 OSM 衍生供应商，或自托管瓦片，不应继续依赖标准 OSM 公共瓦片。[OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- OSM 数据分发采用 ODbL，分发或展示时需提供 OpenStreetMap 归属及 ODbL 链接/说明；MapLibre 的 BSD 许可与 OSM 数据许可是两层不同义务。[OSMF Attribution Guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)

## 天气 API 核查

| API | 免费层 | 商用限制 | 接入注意 |
| --- | --- | --- | --- |
| Open-Meteo | 免费、无需 API key。官方价格页给出 600 calls/min、5,000 calls/hour、10,000 calls/day、300,000 calls/month；免费层无 uptime 保证。官方仓库同时要求超过 10,000 次/日先联系。[价格](https://open-meteo.com/en/pricing)、[官方仓库 Terms & Privacy](https://github.com/open-meteo/open-meteo#terms--privacy) | 免费层明确仅面向 open-source developer 和 non-commercial use。商业使用需订阅 customer API：Standard 1M calls/月、Professional 5M、Enterprise 50M+；官方页面没有展示固定货币价格，需订阅页面或邮件询价。[商业许可与计划](https://open-meteo.com/en/pricing) | Forecast API 输入是 WGS84 经纬度；支持当前、小时和日预报，默认 7 天，最多 16 天。[官方 API 文档](https://open-meteo.com/en/docs)。数据按 CC BY 4.0，展示天气时应在对应位置提供 Open-Meteo 归属。免费 API 服务节点在欧洲和北美，面向中国境内产品需自行验证网络可达性、延迟和跨境数据传输风险。[价格](https://open-meteo.com/en/pricing) |
| WeatherAPI | Free 为 `$0/月`，100,000 calls/月；免费层有实时天气、3 天预报、Search API 等，价格页将 Commercial Use 标为 Yes；免费层列出的 uptime 为 95.5%。[价格](https://www.weatherapi.com/pricing.aspx) | 价格页允许商业使用，但仍受计划的月调用量和每分钟 burst 限制；超额可能暂停、产生超额费用或终止。Free 用户官方“希望”提供回链文字或 logo；条款要求不移除版权/商标声明，且用户依赖天气数据产生的索赔由应用方负责。[价格](https://www.weatherapi.com/pricing.aspx)、[条款](https://www.weatherapi.com/terms.aspx) | API key 不应放进公开仓库或无保护的客户端代码。条款允许 current data 最多缓存 60 分钟、forecast 最多 24 小时、historical 无限制；建议由服务端代理并按这些上限缓存。[WeatherAPI 条款](https://www.weatherapi.com/terms.aspx)、[官方 API 文档](https://www.weatherapi.com/docs/) |
| 国内地图自带天气 | 高德当前个人认证天气 5,000 次/月、QPS 3；腾讯个人天气 6,000 PV/日、QPS 5；百度国内天气 5,000 次/日、QPS 3。各自企业/授权档位见上表。[高德计费/配额](https://lbs.amap.com/pages/base_service_price)、[腾讯配额](https://lbs.qq.com/dev/console/quotaImprove)、[百度权益](https://lbsyun.baidu.com/solutions/privilege) | 与地图供应商的商业授权、key 配额和其他服务条款绑定；额度大时分别购买/申请。 | 如果产品只覆盖中国城市并且已经购买该地图供应商的商业授权，使用同一供应商天气最省坐标和跨境传输处理；如果只追求公开价格最低，WeatherAPI Free 的 100K/月更宽松，但会多一个海外天气供应商和 key/回链管理。 |

## 中国坐标系与合规边界

### 坐标数据模型

不要把一个没有坐标系标记的 `lat/lon` 当作全局真值。建议在数据模型和 provider 边界显式携带 `coordSystem`，至少区分：

- `WGS84`：GPS/全球天气 API 常用；Open-Meteo 文档明确要求 WGS84。
- `GCJ02`：高德和腾讯国内地图常用；高德官方称其为中国国内使用的加密坐标体系，腾讯定位 SDK 默认 GCJ02。
- `BD09`：百度在 GCJ02 基础上再次加密；百度国内地图默认 BD09。
- `EPSG:3857`：Web Mercator 投影坐标，不是可以直接替代经纬度坐标的国内地理坐标系；高德 JS API 文档将其作为地图平面投影使用。[高德投影说明](https://lbs.amap.com/api/javascript-api-v2/guide/abc/components)

推荐的数据流是：

```text
设备/业务原始点（明确来源和坐标系）
        │
        ├─ 国内地图 adapter：按供应商官方转换接口变成 GCJ02 或 BD09
        ├─ Open-Meteo：使用 WGS84
        └─ WeatherAPI：使用明确的十进制度经纬度，并在接入测试中固定来源坐标系
```

不要用非官方“反解密”算法把国内供应商坐标伪装成 WGS84；对外叠加路线时，要保证底图、POI、路线 GeoJSON 和 marker 使用同一坐标系。不同供应商之间切换时，转换应封装在 provider adapter 内，不要散落在页面组件中。

### 上线前合规清单

- 商业授权：确认实际运营主体、收费/广告/项目交付场景，并取得选定地图供应商的商业授权；保留授权书、key 所属主体、服务范围和有效期。高德、腾讯、百度的官方条款都将商业授权与调用配额分别处理。[高德服务协议](https://lbs.amap.com/pages/terms/)、[腾讯配额说明](https://lbs.qq.com/dev/console/quotaImprove)、[百度服务条款](https://lbsyun.baidu.com/docs/pcsa?title=law/open/law)
- 地图审核/备案：对公众提供地图、定位、用户标注、地图数据库等功能前，核实测绘资质、地图审核、审图号、备案和 ICP 义务。国务院条例规定互联网地图服务单位应具备相应测绘资质，地图数据服务器设在中华人民共和国境内，并使用经依法审核批准的地图；移动 App 通知明确要求主办者履行地图审核程序和 ICP 备案。[地图管理条例](https://www.gov.cn/zhengce/zhengceku/2015-12/14/content_10403.htm)、[移动互联网应用地图通知](https://hnca.miit.gov.cn/zwgk/tzgg/tz/art/2024/art_270c90866b994bb69a020ce812de6278.html)
- 用户定位和上传标注：在收集定位、轨迹、用户上传 POI 前，显著说明目的、方式、范围并取得同意；对社区用户新增点做内容和地图安全审校，不允许上传法规禁止表示的内容。[地图管理条例第三十五至三十八条](https://www.gov.cn/zhengce/zhengceku/2015-12/14/content_10403.htm)
- 归属和权利声明：保留供应商要求的 logo、版权、审图号、链接和 OpenStreetMap/天气数据归属，不要把 provider 地图截图、瓦片、POI 数据复制到自有数据库或做成可下载离线包。[高德服务协议](https://lbs.amap.com/pages/terms/)、[百度服务条款](https://lbsyun.baidu.com/docs/pcsa?title=law/open/law)、[OSMF Attribution](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
- 密钥和服务端：高德安全密钥、腾讯 WebService key、百度 ak、WeatherAPI key 不提交仓库；带额度或敏感参数的天气/搜索/路线请求优先通过服务端代理，做来源白名单、速率限制、预算告警和按城市/路线的缓存。腾讯官方入门指南明确提醒不要在网页端直接调用 WebService，WeatherAPI 条款也禁止把 key 暴露在公开代码或无保护客户端。[腾讯 WebService 入门指南](https://lbs.qq.com/service/webService/webServiceGuide/overview)、[WeatherAPI 条款](https://www.weatherapi.com/terms.aspx)

以上是工程与供应商条款的研究结论，不是对具体产品是否需要测绘资质、地图审核或数据出境评估的法律意见；上线前应让实际运营主体按最终功能和发布渠道做专项合规确认。

## 小型项目的最低成本组合

### A. 当前本地原型 / 非商业评估：成本最低

```text
MapLibre GL JS
  + OSM 标准瓦片（仅用户当前视口，保留归属，不预取/离线）
  + Open-Meteo 免费层（非商业，≤10,000 次/日）
```

供应商费用可以是 0，但这只适合本地演示、内部评估或非商业开源项目。它不具备生产 SLA，也不能满足商业天气许可；`D:\走走` 当前的静态地图/天气 Demo 可以保持该模式用于原型验证，但不要把它当成公开商业上线方案。[OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles)、[Open-Meteo Terms](https://github.com/open-meteo/open-meteo#terms--privacy)

### B. 小型商业 Web 应用：推荐的最低现金支出结构

```text
高德 JS API 2.0 + 高德步行/搜索/地理编码
  + WeatherAPI Free（≤100,000 calls/月，Commercial Use = Yes）
```

这里的最低成本不是“全部免费”：地图商业授权仍需向高德办理，授权费用/条件不能从公开页面臆测；高德基础调用超出配额后按公开价计费。WeatherAPI 的免费层把商业使用和 100K/月明确写在价格页，因此适合把天气的现金成本压到 0，但要承担回链、key 保护、95.5% uptime、跨境网络和额外供应商治理成本。若这些运营成本不可接受，则使用已经授权的高德天气，换取单一国内供应商、同一坐标体系和更简单的数据治理。[高德商用与价格](https://lbs.amap.com/pages/terms/)、[高德基础服务计费](https://lbs.amap.com/pages/base_service_price)、[WeatherAPI 价格](https://www.weatherapi.com/pricing.aspx)

### C. 更看重中国境内链路和单一供应商

```text
高德 / 腾讯 / 百度中的一个商业地图栈
  + 同供应商天气
  + 服务端代理、城市级缓存、配额告警
```

这通常不是公开标价下的绝对最低价，但综合上线风险最低：天气不需要再把用户精确坐标发送给境外服务，路线、POI、底图和天气可以统一用同一厂商的 key/授权/审计边界。三家价格差异不能只按“免费调用次数”比较，因为商业许可、授权版配额、QPS、地图审核支持和商务报价是不同维度。[高德配额与价格](https://lbs.amap.com/pages/base_service_price)、[腾讯配额与商业授权](https://lbs.qq.com/dev/console/quotaImprove)、[百度配额与商业条款](https://lbsyun.baidu.com/solutions/privilege)

## 推荐落地顺序（只记录方案，不改源代码）

1. 先保留现有 provider interface；增加明确的坐标系字段和请求来源标记。
2. 生产地图选定一个国内供应商并完成商业授权、key 白名单、地图审核/备案评估；对 `D:\走走` 的现状优先验证高德 JS API 2.0。
3. 将路线规划、地理编码、搜索和天气请求移到服务端适配器，前端只拿最小化结果；按行程/城市缓存，避免每个 marker 或每次重绘重复计费。
4. 天气先用 WeatherAPI Free 做商业成本验证，或在已经购买国内地图授权时直接使用该供应商天气；若选择 Open-Meteo，只在非商业评估阶段使用免费层，商业上线切换 customer API 或自托管并完成许可证审查。
5. 在发布前做一次真实网络、配额耗尽、key 泄露、坐标偏移、审图号/归属可见性和供应商故障演练。

