# 走走手机发布记录

## 继续发布 / 用户已确认许可

2026-09-14用户明确声明已取得许可、图片内容为自有并要求直接发布，依据CONTENT-AUTHORIZATION.md解除上一轮许可等待。当前发布分支codex/mobile-cloud-release；预览D1和生产D1已分别创建并应用0001/0002迁移。知识发行号travel-20260914-72591dbecea55e65，7918条60城，来源hash见data/release/knowledge.json。发布只复制data/release/assets.json列出的实际资源；主JS已降至约1.54MB、gzip424KB，完整攻略库改为服务端按城市检索。

供应商账号/models接口实查可用模型为deepseek-flash与deepseek-v4-pro，旧配置deepseek-v4-flash不在列表；正式服务改用已确认可用的deepseek-flash。以下“未获许可/BLOCKED”是上一轮历史快照，不再作为本轮许可阻塞；实际部署与最终验收将在发布后补录。

更新时间：2026-09-14。状态：**BLOCKED，未提交、未推送、未发布新版**。不能把以下本地实现视为正式站点已更新。

## 已核实的项目

| 项目 | 本轮事实 |
| --- | --- |
| 工作目录 | D:/走走，保留既有大量未提交成果 |
| GitHub | https://github.com/3555489035ppx-wq/zouzou ，已是公开仓库，未改变隐私设置 |
| 当前分支 / HEAD | feat/zouzou-v7-refactor / 855a92e86eb3ea2656b1ed2e8cd5855fa8f08ac9 |
| 远端 main | 65495075dbe04bc3f40a3dca0418c0eee233a65e |
| Git 历史 | 两端提交历史不同，已提交最终 tree 相同；不包含工作区新修改，详见内容审计 |
| Cloudflare | Pages 项目 zouzou，Git 集成，生产 main；不另建 Direct Upload 或重复 Actions 发布链路 |
| 已有生产部署 | c89cb80c-bb93-4473-865f-ef3639f8aefa；这是本轮前的旧部署，不是新验收版本 |
| 已关联域名 | https://zouzou.ppx.wiki 、https://zouzou-etq.pages.dev |
| 新部署 / 新 commit | 无，本轮未产生 |
| 远端存储 | 本轮 D1 list 未列出现有数据库；下载的 Pages 配置没有 DB binding。未创建数据库、未应用远端迁移 |

本机网络只读检查：正式域名 `/`、`/api/health`、`/manifest.webmanifest` 均返回 HTTP 200、`text/html`、782 bytes。后两个并非有效 JSON/manifest；首页能返回 HTML 不证明后端或安装能力可用。这也不是中国大陆手机直连证据。

## 本地已实现

- PWA manifest、192/512/180/32 图标、maskable 图标、安装说明页面；复用现有未预裁圆角的走走图像。
- 单个 Service Worker：只缓存带指纹的公共静态资源；API 不缓存；离线导航显示通用页，不缓存分享正文；更新提示不强制刷新输入。
- Pages Functions 入口 `functions/api/[[path]].ts` 和 D1 结构化适配。256位随机访客令牌、仅保存令牌哈希、HTTPS Secure/HttpOnly/SameSite Cookie；身份由服务端决定。
- 私人行程保存/列表/读取，版本冲突返回409；访客需在“我的行程→本机行程与云端保存”明确上传。本地列表不冒充已同步；目前不是全量自动同步方案。
- 私密分享快照：256位随机token、1/7/30天期限、本人链接列表、显式更新、撤销、字段白名单及 no-store；本地旧分享接口保留并适配新UI，明确标注 local-server。
- 社区 D1 适配保留发布/编辑/撤回/评论/收藏/点赞/关注/分页、事务和幂等契约。历史 group-plans 尚未迁移，云端入口明确503；原本地实现保留。
- AI 云端适配：真实供应商请求与知识约束排程分开标注，保留版本/模型元数据；请求校验、超时、错误提示、访客及全局次数限制；远程失败不静默回退。**没有发起真实模型调用**。
- 外部地图统一城市/地址/可信坐标系，未知坐标按文字搜索；分享页复用地图按钮，前台恢复重新检查分享有效性。

## 不可跳过的发布阻塞

1. 新 reviewed 库7918条、60城，全部 `permission=unknown`；不能用 Schema `version=1` 或文件时间充当已获准的知识发行版本。19,826条claims全部verified=false。当前没有本任务可放行的完整知识发行版。
2. `src/private-assets/bloub/PRIVATE_LOCAL_REFERENCE.md` 明确要求仅本地使用、单独权利审查后才能发布；仍有运行时引用。封面421/458来自baidu目录，展示审核不能代替许可记录。不得悄悄换掉用户要求保留的Bot或把未知许可改成approved。
3. `public`有10,745文件、11,412,900,185 bytes。Vite默认会整目录复制，不能从当前完整public直接部署。尚需“确有使用且允许公开”的资产依赖清单。
4. 本地代码审计构建主JS约13,803.84kB，gzip约1,853.32kB；AI依赖图仍包含12个数据JSON。运行时许可开关不阻止静态打包。知识检索拆分与客户端按需加载未完成。
5. 全量回归535项中512通过、23失败，见验收文档；不能以定向测试通过替代全站通过。
6. 远端 D1、绑定、迁移、预览AI凭据、供应商账号/地区可用性、线上真实生成、协作迁移、正式分享域名配置及生产全链路均未完成。

## 知识版本

本地候选：`data/travel-guides-reviewed-20-cities.json`，schema version=1，generatedAt=2026-09-14T10:17:40.468Z，7918条，60城。同版语义审计哈希匹配，但许可未放行。独立 `kb-29cccb2937580e908d0a` 仅包含4个自编规则，不能给7918条攻略背书。

云端 `KNOWLEDGE_RELEASE_APPROVED=false`、`KNOWLEDGE_VERSION` 空值时全部AI路由返回503。**不得仅翻开关解决阻塞**：先生成获准的运行时投影、来源索引与不可变发行号，并从客户端/服务端包中移除不应公开的资料。当前包禁止公开发布。

## 后续发布链路

先确定许可范围及素材处理方案，再完成知识拆分、23项失败的修复与协作迁移。逐文件审查新发布清单；新配置不能包含真实密钥、private原文或WorkBuddy资料。重新fetch并核对远端，按正常merge/PR流程整合main，不强推、不用ours策略掩盖差异。

复用现有 Pages Git 集成：分别配置隔离预览D1和生产D1，将binding命名为DB；应用 `migrations/0001_private_trips.sql` 和 `0002_community.sql`，验证真实D1事务/并发和原数据迁移。Secrets只放Cloudflare服务端。核实构建根目录、命令、产物目录和生产分支；非生产分支先预览，再按既有保护流程合并main触发唯一生产链路。

最终需把 Git commit、Pages deployment、`/build.json` 的sha、API知识版本对应起来，并进行A/B设备分享和部署后持久化检查。本轮没有合法可发布产物，未执行这些步骤。

## 本地验证与恢复

仓库外备份：`D:/走走-release-backups/20260914-mobile-200627`，58,826文件、34.113GB、robocopy FAILED=0，含tracked-working.patch和tracked-index.patch。仅作恢复备份，不是替代开发项目，也不要上传；其中包含本地私人数据。

`node scripts/build-mobile-audit.mjs` 输出 `dist-mobile-audit`，跳过11.4GB public复制，**仅为本地代码检查，不是完整生产构建**。本地QA服务按需从原public读取图片，不能拿此产物上传。`build.json` 明确记录dirty及auditOnly。

复验命令：

```powershell
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/vitest/vitest.mjs run server/cloud server/trip-sharing.test.ts src/services/ai.test.ts src/services/mapLauncher.test.ts src/services/places.test.ts server/community.test.ts
node scripts/build-mobile-audit.mjs
node node_modules/tsx/dist/cli.mjs scripts/mobile-cloud-audit-server.ts
# 另一个终端，QA服务只监听127.0.0.1:4196
node node_modules/tsx/dist/cli.mjs scripts/mobile-cloud-browser-audit.ts
```

原pnpm-workspace配置中workerd构建许可未确定，`pnpm exec`会触发自动install并报IGNORED_BUILDS；本轮未擅自更改该策略，使用现有锁定依赖的Node入口验证。工程没有现成lint脚本，不声称lint通过。

本轮没有生产变化，因此无需生产回滚。未来回滚需先核对Cloudflare可回退部署及其API/DB兼容性；数据库只采用兼容新增迁移，不删除新表或分享记录。远端DB尚未创建，所以本轮没有远端DB备份或已验证恢复点；不得用本机备份冒充。旧生产部署ID保留为参考，当前API检查未通过，不能称为“完整可用版本”。

收尾：最终类型检查通过，最新local-server提示改动后本地分享4项重新通过，tracked目标diff whitespace检查通过。停止4196验证服务并删除本轮生成的dist-mobile-audit与synthetic local-test.sqlite的清理调用被执行环境策略拒绝，未改用其他方式绕过；这些仅本机测试内容暂留且被Git忽略。原4183/8787服务未操作，证据截图和脚本保留。不得上传审计产物或测试数据库。
