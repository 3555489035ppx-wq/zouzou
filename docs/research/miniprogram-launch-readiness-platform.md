# 走走｜微信小程序上线与阿里云部署准备度研究

> 研究日期：2026-08-30  
> 研究范围：只核对平台、部署和合规要求；本次不修改业务代码。  
> 资料优先级：微信开放文档、阿里云帮助文档、DeepSeek 官方文档。模型、平台规则、价格和审核要求可能变化，正式提审前应再次打开官方页面确认。

## 一、结论先行

### 1. 当前项目可以作为后端和产品原型，但不能直接把当前 Vite 网页包上传成微信小程序

这是基于当前仓库的工程判断：项目是 React + Vite 的浏览器页面，入口依赖 DOM、`sessionStorage`、`localStorage` 和浏览器 `fetch`；当前并不是包含 `app.json`、页面 WXML/WXSS/JS 或其他小程序构建产物的小程序工程。小程序仍需用微信开发者工具完成预览、上传和发布流程。[当前项目构建配置](../../package.json) · [当前 Vite 配置](../../vite.config.ts) · [微信开发者工具概览](https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html)

### 2. 300 元阿里云服务器大概率可以承载“内部 HR、小规模访问”的第一版，但现在不能仅凭价格确认

这是工程推断，不是阿里云官方最低规格承诺。当前项目调用 DeepSeek 远程 API，不在 ECS 上运行模型，因此服务器主要承担静态前端、Node API、攻略 JSON/图片和数据库；只要你的实例有公网访问能力、可安装 Node.js/Nginx、磁盘和内存满足实际并发，低流量内部使用通常可行。最终要以你实例的地域、CPU、内存、系统盘、公网带宽和到期时间为准。[当前服务入口](../../server/index.ts) · [阿里云 Node.js 部署前提](https://help.aliyun.com/zh/ecs/user-guide/quick-deployment-of-node-js-environment) · [阿里云 ECS 公网 IP 说明](https://help.aliyun.com/zh/ecs/user-guide/ip-address/)

### 3. 真正上线前最大的工作不是买服务器，而是“小程序端重做 + 生产数据层 + 账号与合规”

当前仓库已经有文本理解、可选视觉理解、城市攻略和图片素材，但服务端目前只有健康检查、攻略查询和旅行理解接口；认证适配器仍是演示实现，行程主要保存在浏览器会话/本地存储中，不能作为多手机共享的生产数据层。[当前 API 入口](../../server/index.ts) · [当前认证适配器](../../src/services/auth/adapter.ts) · [当前本地存储实现](../../src/services/platform.ts)

## 二、当前仓库与生产小程序的差距

| 项目 | 当前仓库事实 | 上线影响 |
| --- | --- | --- |
| 客户端 | React/Vite Web 页面，开发端口为 4173 | 需要迁移到原生小程序、Taro、uni-app 或其他小程序构建链；这是工程判断。[Vite 配置](../../vite.config.ts) |
| 后端 | Node `http` 服务，当前监听 `127.0.0.1:8787` | 生产上应让 Nginx/Caddy 对外监听 443，再反向代理到 Node；这是工程判断。[server/index.ts](../../server/index.ts) · [阿里云 SSL 部署](https://help.aliyun.com/zh/ecs/user-guide/ssl) |
| 数据 | 行程暂存于浏览器 `sessionStorage`/`localStorage` | 多部手机不会天然共享，需增加服务端认证、数据库和行程 CRUD；这是工程判断。[平台存储实现](../../src/services/platform.ts) |
| 登录 | `localAuthAdapter` 接受演示验证码，不是真实微信登录或 HR 账号体系 | 生产必须使用服务端会话、微信登录或受控的企业账号/PIN，并记录权限；这是工程判断。[认证适配器](../../src/services/auth/adapter.ts) |
| AI | DeepSeek 通过服务端调用，视觉模型可选 | 方向可保留；密钥必须只放服务端环境变量，不能放小程序包。[DeepSeek 首次调用](https://api-docs.deepseek.com/zh-cn/) |
| 图片 | 城市推荐图已下载到 `public/assets/cities` | 可打包为小程序本地资源，或迁移到对象存储；若改用远程图片，需要检查对应域名和证书。来源见 [IMAGE_SOURCES.md](../IMAGE_SOURCES.md) |

## 三、微信小程序上线的官方要求

### 3.1 `wx.request` 等网络请求必须配置合法域名

官方事实：小程序的 `wx.request`、`wx.uploadFile`、`wx.downloadFile` 和 WebSocket 等网络能力使用预先配置的服务器域名；HTTPS 请求域名不能使用普通 IP 或 `localhost`，域名需完成 ICP 备案；正式网络请求还会校验证书。开发者工具里的“不校验请求域名、TLS 版本及 HTTPS 证书”只适合开发调试，不能作为正式版配置。[微信开放文档：网络](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)

对走走的落地含义：

- 小程序调用 AI/攻略/行程接口时，建议统一使用 `https://api.<你的域名>/api/...`，然后在小程序后台配置该域名为 request 合法域名。[微信开放文档：网络](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- 如果小程序把截图作为文件上传，需配置 uploadFile 合法域名；如果继续把压缩后的 base64 放在 JSON 请求里，则仍受请求体大小和服务端限制约束。这是基于当前媒体接口的工程判断。[当前媒体接口](../../server/trip-vision.ts) · [微信开放文档：网络](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- 当前本地 `127.0.0.1`、办公室局域网地址和 Vite 代理只能用于开发/内测，不是正式版 API 地址。局域网 IP 例外属于微信文档中的局域网通信能力，不能替代公网正式部署。[微信开放文档：局域网通信](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/mDNS.html) · [微信开放文档：网络](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)

### 3.2 HTTPS、域名和备案

官方事实：微信小程序服务器域名需使用 HTTPS/WSS；证书要有效、受系统信任、域名匹配、证书链完整，且 TLS 至少支持 1.2。微信文档还明确列出服务器域名需要 ICP 备案。[微信开放文档：网络](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)

官方事实：在中国内地 ECS 上托管网站，对外提供服务前通常需要 ICP 备案；阿里云备案说明还提示，ICP备案完成后，网站开通之日起 30 日内办理公安联网备案，实际以主体所在地管局要求为准。[阿里云个人网站 ICP 备案快速入门](https://help.aliyun.com/zh/icp-filing/basic-icp-service/getting-started/quick-start-for-icp-filing-for-personal-websites) · [阿里云搭建网站流程](https://help.aliyun.com/zh/ecs/user-guide/build-a-website/)

基于两份官方要求的工程判断：上线至少需要准备一个已实名认证的域名、ICP备案/小程序备案所需主体材料、DNS 解析、可信证书，以及 Nginx 或其他 HTTPS 终止层；只买 ECS 公网 IP 不能绕过微信的合法域名配置。[阿里云 DNS 解析](https://help.aliyun.com/zh/dns/beginner-s-guide) · [阿里云 SSL 部署](https://help.aliyun.com/zh/ecs/user-guide/ssl)

### 3.3 体验版与正式版不能混用

官方事实：微信开发工具和小程序后台区分开发版、体验版、审核/提审版本和线上版本；体验版用于指定成员测试，正式版本需要走上传、审核和发布流程。开发者工具的调试跳过域名校验不能代表正式版已经满足网络要求。[微信开发者工具项目页](https://developers.weixin.qq.com/miniprogram/dev/devtools/project.html) · [微信开发者助手：版本与成员管理](https://developers.weixin.qq.com/miniprogram/dev/devtools/mydev.html) · [微信开放文档：网络](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)

上线验收时应至少覆盖：未开启调试绕过时的真机请求、登录、截图/图片、AI 超时与错误回退、不同网络、安卓/iOS、审核账号和正式域名。这里的测试清单是基于平台网络校验和当前项目接口的工程建议。[微信开放文档：网络](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html) · [当前 AI 接口](../../server/index.ts)

### 3.4 小程序备案、隐私与权限

官方事实：微信已为新增及存量小程序提供备案流程；小程序完成备案后才进入后续发布等环节，具体审核时间以平台和管局实际通知为准。[微信开放文档：小程序备案操作指引](https://developers.weixin.qq.com/miniprogram/product/record/guidelines.html)

官方事实：涉及个人信息处理的小程序，需要在后台填写用户隐私保护指引；只有声明对应信息类型并同步用户已阅读同意隐私规则后，才能调用相应隐私接口或组件。[微信开放文档：用户隐私保护指引填写说明](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/) · [微信开放文档：隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)

走走目前可能涉及的隐私/权限范围包括：用户选择的截图或图片、微信登录身份、行程文本、可能的位置信息，以及服务端发送给 DeepSeek/视觉模型的旅行描述或图片。这是基于当前代码和产品功能的工程判断，正式隐私指引必须按最终实际调用填写，不能照抄此列表。[当前媒体接口](../../server/trip-vision.ts) · [当前 AI 服务](../../src/services/ai.ts) · [微信隐私信息映射说明](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/miniprogram-intro.html)

## 四、阿里云 ECS 上线条件

### 4.1 实例和网络

官方事实：ECS 对外提供 Web 服务需要公网访问能力；阿里云文档说明可通过固定公网 IP 或 EIP 访问公网，且默认不会自动为实例分配公网 IPv4。[阿里云 ECS IP 地址](https://help.aliyun.com/zh/ecs/user-guide/ip-address/) · [阿里云 ECS 入门指引](https://help.aliyun.com/zh/ecs/quick-start)

官方事实：阿里云 Node.js 扩展程序部署前提包括实例处于运行状态、拥有固定公网 IP 或 EIP、云助手正常，并支持 Alibaba Cloud Linux 3、Ubuntu 20.04 及以上等系统。[阿里云 Node.js 环境部署](https://help.aliyun.com/zh/ecs/user-guide/quick-deployment-of-node-js-environment)

建议的安全组最小规则（工程落地建议，端口用途依据阿里云官方示例）：

| 端口 | 用途 | 建议 |
| --- | --- | --- |
| 80/TCP | HTTP 跳转 HTTPS、证书校验 | 对公网开放或按实际证书方案开放。[阿里云安全组](https://help.aliyun.com/zh/ecs/user-guide/start-using-security-groups) |
| 443/TCP | 小程序正式 HTTPS | 对公网开放。[阿里云安全组](https://help.aliyun.com/zh/ecs/user-guide/start-using-security-groups) |
| 22/TCP | Linux SSH | 只允许管理员办公网/固定公网 IP，不建议长期对 `0.0.0.0/0` 开放。[阿里云安全组](https://help.aliyun.com/zh/ecs/user-guide/start-using-security-groups) |
| 8787/TCP | 当前 Node 本地服务 | 不对公网开放；由 Nginx 反向代理到 `127.0.0.1:8787`。这是基于当前代码的工程判断。[当前 server/index.ts](../../server/index.ts) |

### 4.2 域名解析和证书

官方事实：阿里云 DNS 的 A 记录用于把域名指向 IPv4 地址；因此应把 `api.<你的域名>` 的 A 记录指向 ECS 固定公网 IP/EIP。[阿里云 DNS 域名解析](https://help.aliyun.com/zh/dns/beginner-s-guide)

官方事实：阿里云提供将 SSL 证书部署到 Nginx 等 Web 服务器的方案；证书文件和私钥需要放在服务器安全路径，Nginx 监听 443，安全组和系统防火墙必须允许 443。[阿里云部署 SSL 证书](https://help.aliyun.com/zh/ecs/user-guide/ssl) · [阿里云 Nginx SSL 配置](https://help.aliyun.com/zh/ssl-certificate/install-ssl-certificates-on-nginx-servers-or-tengine-servers)

工程建议：不要把 DeepSeek Key、视觉模型 Key、微信 AppSecret 或数据库密码放进小程序包、Git 仓库或前端 `VITE_` 变量；它们应只存在于 ECS 服务端环境变量或受控密钥系统中。DeepSeek 的官方调用方式是服务端携带 API Key 访问兼容接口，当前项目也已经把模型调用放在 `server/`。[DeepSeek 首次调用](https://api-docs.deepseek.com/zh-cn/) · [阿里云安全最佳实践](https://help.aliyun.com/zh/ecs/user-guide/best-security-practices) · [当前服务端 AI 适配](../../server/trip-intent.ts)

### 4.3 300 元服务器是否够用

以下是工程估算，不是官方最低配置：

- 内部 HR、小并发：建议至少 1 vCPU、2 GiB 内存、20 GiB 可用磁盘、固定公网 IP/EIP、可用 80/443 出入方向；若实例只有 1 GiB 内存，构建和日志空间会更紧张。[阿里云 Node.js 环境部署](https://help.aliyun.com/zh/ecs/user-guide/quick-deployment-of-node-js-environment) · [阿里云 ECS 入门指引](https://help.aliyun.com/zh/ecs/quick-start)
- 服务器不需要 GPU，因为 DeepSeek/视觉模型由外部 API 提供；这是基于当前项目配置和 DeepSeek API 架构的工程推断。[DeepSeek 首次调用](https://api-docs.deepseek.com/zh-cn/) · [当前环境变量示例](../../.env.example)
- 300 元是否足够还取决于是一次性购买还是包年包月、实例是否带公网带宽、磁盘是否独立计费、域名/证书/备案/AI 调用是否另计费；价格不能替代规格核验。[阿里云 ECS 计费概述](https://help.aliyun.com/zh/ecs/product-overview/billing-overview) · [阿里云 ECS IP 地址](https://help.aliyun.com/zh/ecs/user-guide/ip-address/)

## 五、微信云开发是否适合

官方事实：CloudBase/微信云开发提供小程序后端相关能力，官方资料覆盖小程序环境、云函数、数据库和云存储；云函数运行环境可以使用 Node.js 依赖。[CloudBase 微信小程序快速开始](https://docs.cloudbase.net/en/quick-start/frameworks/wechat-miniprogram) · [微信开放文档：云开发起步](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html) · [微信开放文档：云函数使用 npm](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions/npm.html) · [微信开放文档：云数据库 API](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/database/)

基于当前项目的工程判断：

- CloudBase 适合不想维护 ECS、希望把行程数据、图片和云函数集中托管的方案；AI Key 可以放在云函数，不放小程序端。[CloudBase 微信小程序快速开始](https://docs.cloudbase.net/en/quick-start/frameworks/wechat-miniprogram) · [DeepSeek 首次调用](https://api-docs.deepseek.com/zh-cn/)
- 当前项目并不能“直接切换”为 CloudBase：仍需把 React/Vite 页面迁移成小程序页面，并把 Node `http` 路由改造成云函数/云托管接口；这是工程判断。[当前 package.json](../../package.json) · [当前 server/index.ts](../../server/index.ts)
- 如果已经有阿里云服务器并且只是内部 HR 使用，优先采用“微信小程序客户端 + ECS 上的 Node API + 数据库”更容易复用当前服务端；CloudBase 作为第二种部署路线，不建议 ECS 与 CloudBase 同时承担同一份行程数据。这是工程判断。[当前 API 集成说明](../API_INTEGRATION.md) · [阿里云 ECS 建站流程](https://help.aliyun.com/zh/ecs/user-guide/build-a-website/)

## 六、正式上线前必须补齐的功能清单

以下是以当前仓库为基准的工程清单；每项不是微信官方的“最低配置”表述，而是为了让当前产品可以真实运行的必要工作。

### A. 小程序客户端

- [ ] 新建小程序工程，迁移首页、旅行输入、理解确认、方案详情、社区/攻略页面和图片资源。[微信开发者工具概览](https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html)
- [ ] 将浏览器 `fetch` 改为小程序 `wx.request`/云函数调用，将 `sessionStorage`/`localStorage` 改为服务端行程接口或小程序存储。[微信开放文档：网络](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html) · [当前 AI 请求实现](../../src/services/ai.ts)
- [ ] 将截图选择改成 `wx.chooseImage`/`wx.chooseMedia`；决定使用 base64 JSON 还是上传到服务端/对象存储，并按方案配置 uploadFile 或下载域名。[微信用户隐私信息映射](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/miniprogram-intro.html) · [当前媒体接口](../../server/trip-vision.ts)
- [ ] 真机验证弱网、超时、模型失败、空 JSON、低置信度和用户取消权限时的回退。[当前视觉回退实现](../../server/trip-vision.ts) · [微信开放文档：网络](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)

### B. 后端、账号和数据库

- [ ] 增加微信 `wx.login` 到服务端会话的登录链路，或实现受控 HR 账号/PIN；不要把 AppSecret 放小程序端。[微信登录官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html) · [当前演示认证](../../src/services/auth/adapter.ts)
- [ ] 增加用户、角色、行程、行程日程、行程成员、操作日志等持久化表和 CRUD 接口；当前项目尚未提供这些生产接口。[当前 server/index.ts](../../server/index.ts) · [当前本地存储](../../src/services/platform.ts)
- [ ] 为 AI 接口增加登录校验、请求频率限制、最大输入/图片大小、错误码、调用超时、费用监控和日志脱敏。[当前请求限制](../../server/index.ts) · [DeepSeek API 文档](https://api-docs.deepseek.com/zh-cn/)
- [ ] 生产环境把 `CORS_ORIGIN`、密钥和数据库配置设为最小权限；当前服务默认允许请求来源回显或 `*`，需要根据最终客户端收紧。这是基于当前代码的安全判断。[当前 CORS 实现](../../server/index.ts) · [阿里云安全最佳实践](https://help.aliyun.com/zh/ecs/user-guide/best-security-practices)

### C. 旅行数据真实性

- [ ] 城市攻略可以继续作为推荐线索，但营业时间、价格、预约、天气和路线应接入有授权的 POI/路线/天气来源并带更新时间。[当前攻略接入说明](../API_INTEGRATION.md) · [旅行攻略来源研究](travel-guide-source-integration.md)
- [ ] 小程序正式展示用户生成内容、攻略摘要或社区内容前，应制定来源、版权、投诉/删除和内容安全处理；这属于上线运营与合规准备，不是把模型输出直接展示即可。[当前攻略来源研究](travel-guide-source-integration.md) · [微信小程序开发框架与规范入口](https://developers.weixin.qq.com/miniprogram/dev/framework/)

### D. 微信后台和发布

- [ ] 注册/认证小程序账号，取得 AppID，完成小程序备案并填写服务类目、名称、头像、简介、隐私指引。[微信小程序备案操作指引](https://developers.weixin.qq.com/miniprogram/product/record/guidelines.html) · [用户隐私保护指引](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/)
- [ ] 在小程序后台配置 request、uploadFile、downloadFile 等实际使用到的合法域名；关闭开发环境的网络校验绕过后进行真机测试。[微信开放文档：网络](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- [ ] 上传开发版，指定体验成员测试，准备审核账号/路径/说明，提交审核，审核通过后发布线上版。[微信开发者工具项目页](https://developers.weixin.qq.com/miniprogram/dev/devtools/project.html) · [微信开发者助手](https://developers.weixin.qq.com/miniprogram/dev/devtools/mydev.html)

## 七、建议的上线架构

```text
微信小程序
  ├─ wx.request https://api.example.com/api/trips/understand
  ├─ wx.request https://api.example.com/api/trips/media/analyze
  └─ wx.request https://api.example.com/api/trips
                    │
                    ▼
              阿里云 ECS
        Nginx :443 + 有效证书
                    │
                    ├─ 静态小程序相关服务/管理页（如需要）
                    └─ Node API 127.0.0.1:8787
                              │
                              ├─ SQLite/MySQL/PostgreSQL 行程数据
                              ├─ data/travel-guides.json 或后续知识库
                              └─ DeepSeek/视觉模型 API（密钥只在服务端）
```

这套架构是基于当前代码复用程度的工程推荐，不是微信或阿里云规定的唯一架构。[当前 API 服务](../../server/index.ts) · [阿里云 ECS 建站流程](https://help.aliyun.com/zh/ecs/user-guide/build-a-website/) · [DeepSeek 首次调用](https://api-docs.deepseek.com/zh-cn/)

## 八、备份与安全

官方事实：阿里云建议使用快照等能力做 ECS 数据保护；安全最佳实践页面给出“每日创建一次自动快照、至少保留 7 天”的建议示例，并提醒备份/快照可能产生额外费用。[阿里云 ECS 安全性](https://help.aliyun.com/zh/ecs/user-guide/best-security-practices) · [阿里云 ECS 灾备方案](https://help.aliyun.com/zh/ecs/user-guide/disaster-recovery-solutions)

走走至少应备份：数据库文件、攻略知识库、用户上传图片/对象存储、Nginx 配置、`.env` 的密钥清单（不备份明文 Key 到公开位置）和发布包。备份对象与频率是基于当前单机架构的工程建议。[当前攻略数据](../../data/travel-guides.json) · [阿里云 ECS 灾备方案](https://help.aliyun.com/zh/ecs/user-guide/disaster-recovery-solutions)

## 九、最终判断

| 能力 | 当前状态 | 上线判断 |
| --- | --- | --- |
| AI 旅行理解/DeepSeek | 已有服务端适配 | 可以复用，但需生产限流、日志脱敏、费用监控和密钥保护。[DeepSeek 官方文档](https://api-docs.deepseek.com/zh-cn/) |
| 视觉识别 | 已有可选服务端接口 | 可以复用，但小程序端需重新实现图片选择/上传和隐私说明。[当前视觉接口](../../server/trip-vision.ts) · [微信隐私指引](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/) |
| 城市攻略 | 20 城、100 条摘要 | 可作为 MVP 知识库；不应把社区摘要直接当营业/路线事实。[当前攻略说明](../API_INTEGRATION.md) |
| 真实城市图片 | 已有本地素材和来源记录 | 可迁移到小程序包或对象存储，需保留署名/授权信息。[图片来源清单](../IMAGE_SOURCES.md) |
| 微信小程序客户端 | 尚未形成小程序工程 | 不能直接提审，需要迁移客户端。[当前 package.json](../../package.json) · [微信开发者工具概览](https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html) |
| 多手机共享行程 | 当前不是生产共享数据层 | 必须增加服务端数据库、登录和权限。[当前本地存储](../../src/services/platform.ts) |
| 阿里云部署 | 尚未核验你的实例规格/公网 IP/域名 | 300 元预算有希望，但必须先核对实例配置；不能凭价格直接承诺。[阿里云 ECS IP](https://help.aliyun.com/zh/ecs/user-guide/ip-address/) |

**推荐路线：**先走“微信小程序客户端 + 现有 Node API 迁移到阿里云 ECS + Nginx/HTTPS + 一台服务器上的持久化数据库”，暂不同时引入 CloudBase。等小程序版稳定后，再决定是否把数据库和函数迁移到 CloudBase。这是基于当前仓库复用程度和已有阿里云资源的工程判断。[当前 API 集成说明](../API_INTEGRATION.md) · [CloudBase 微信小程序快速开始](https://docs.cloudbase.net/en/quick-start/frameworks/wechat-miniprogram) · [阿里云 ECS 建站流程](https://help.aliyun.com/zh/ecs/user-guide/build-a-website/)

## 官方资料索引

- [微信开放文档：网络与合法域名](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- [微信开放文档：局域网通信](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/mDNS.html)
- [微信开放文档：小程序备案操作指引](https://developers.weixin.qq.com/miniprogram/product/record/guidelines.html)
- [微信开放文档：隐私指引填写说明](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/)
- [微信开放文档：隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)
- [微信开放文档：隐私信息类型说明](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/miniprogram-intro.html)
- [微信开放文档：云开发起步](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [CloudBase 微信小程序快速开始](https://docs.cloudbase.net/en/quick-start/frameworks/wechat-miniprogram)
- [阿里云 ECS 入门指引](https://help.aliyun.com/zh/ecs/quick-start)
- [阿里云 ECS 公网 IP](https://help.aliyun.com/zh/ecs/user-guide/ip-address/)
- [阿里云 Node.js 环境](https://help.aliyun.com/zh/ecs/user-guide/quick-deployment-of-node-js-environment)
- [阿里云安全组](https://help.aliyun.com/zh/ecs/user-guide/start-using-security-groups)
- [阿里云 SSL 部署](https://help.aliyun.com/zh/ecs/user-guide/ssl)
- [阿里云 DNS 解析](https://help.aliyun.com/zh/dns/beginner-s-guide)
- [阿里云 ICP 备案](https://help.aliyun.com/zh/icp-filing/basic-icp-service/getting-started/quick-start-for-icp-filing-for-personal-websites)
- [阿里云安全最佳实践](https://help.aliyun.com/zh/ecs/user-guide/best-security-practices)
- [DeepSeek 官方 API 文档](https://api-docs.deepseek.com/zh-cn/)
- [DeepSeek JSON Output](https://api-docs.deepseek.com/zh-cn/guides/json_mode/)

## 十、本次仓库验收记录

- `pnpm typecheck`：通过。
- `pnpm test`：13 个测试文件、120 个测试通过。
- `pnpm test:e2e`：18 个端到端测试通过，覆盖移动尺寸、登录演示、旅行输入到方案详情、社区互动、地图和无横向溢出。
- `pnpm build`：通过；仍有一个已有的 Vite 大 chunk 提示，不阻塞发布，但后续可做代码分包。
- 本次修复：将 `src/services/trip/cityKnowledge.ts` 纳入 `tsconfig.node.json`，并把 E2E 中已经过时的状态文案断言更新为当前诚实的路线状态文案。

以上是仓库工程验证，不等于微信审核通过，也不等于阿里云实例、域名、证书和备案已经配置完成。
