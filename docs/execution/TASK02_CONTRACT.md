# 02 任务书执行契约

执行依据：D:/UI设计1/02_发现与我的_内容及功能实现任务书.md（v3）。保留原项目及既有未提交修改，没有创建替代项目。附件 assets/V04_021.jpg 的工具页坏图已提取到 artifacts/task02-v3/source-V04_021.jpg 并查看。

## 与 01 的共享边界

- 唯一私人行程为 `GeneratedPlan`，稳定编号 `tripId`、版本 `revision`、保存时间 `savedAt`，仍使用 `zouzou-saved-plans-v1`。02 没有建立第二份私人行程表。
- 01 维护 planner 主逻辑、summary、SavedTripExecution 生命周期、分享及邀请 API。02 经协调只修改 planner 的 copyCuratedTrip 和必要来源字段，其余由 01 维护。
- `tripSummary` 和 `tripCounts` 来自同一服务；底部列表和个人列表共同使用无参数的 `TripLibrary`。旧 personalTrips 保留为可打开的旧版路线参考，不自动复制、删除或补造日期。
- 工具 URL 携带 `tripId` 与 `revision`。`TripScope` 对不存在的行程显示选择页；多个行程不会静默选第一条或 activeRouteId。切换明确提示未保存表单处理，重新挂载对应行程表单。
- 私人分享复用 `/api/shares`、现有设备会话与 SQLite。创建前展示脱敏快照；快照固定版本；持链接者可读；撤销后第二会话不能读取。脱敏后地点数和安排数使用与原行程相同的算法，排除的信息使数量可能减少，界面明确说明。

## 02 本地功能边界

- 发现：当前公开发现语料为1200条分日攻略，60城各20条；精选为每城5条共300条，在卡片上标注走走精选。原短途路线保留详情入口供已有引用使用，不计入1200。每次展开20条，已取消108/120上限；城市、场景、关键词和页数仍保存在URL。来源无伪造作者及互动量。
- 封面：有明确src时显示该图，禁止静默替换为同城第一张图；失效时中性降级。用户2026-09-14再次声明三平台朋友素材已授权，人工看过的原图进入data/journey-images/authorized-social-photos.json，保留作者、笔记链接和原像素。本轮图片全量替换尚未完成，未将旧候选的机器分数当成视觉验收通过。
- 图片候选全量注册表约12.4MB，只供素材审查模块。正常发现页使用 `discover-cover-index.ts` 的已选封面索引。分日路线可复用同地点的有来源参考图，不能因图片重复隐藏攻略；重建保留既有审核封面。修改路线地点/图片后运行 `scripts/build-discover-cover-index.ts` 重建索引，不使用随机图片兜底。
- 费用：整数分为记账依据，保留 amount 兼容旧记录；付款日独立于行程日；退款是正数金额加退款类型；分摊支持平均、指定金额与份数；舍入余数确定分配；手动结清不发生转账。未建立协作的行程使用明确标注的本机成员编号；已建立协作的行程读取01服务中accepted成员的真实participant ID。未加入者被拒绝，不降级为示例名单。账本仍仅保存在本机，未声称服务端共同账本。
- 清单：稳定建议编号、删除记录、按名称防重、原勾选和自定义内容保留；负责人和备注可编辑。当前持久化为本机，不宣称多人实时清单。
- 城市记忆：全局入口看全部；带 tripId 的工具入口默认只看本次，能显式切换全部。支持手动/完成记录、照片和编辑删除；同城市不同访问日期可重复记录，城市数量去重。
- 发布：从私人 Trip 生成独立脱敏草稿。旧版本机发布保留且不自动上传。确认隐私预览后才调用 `/api/community/posts/:id`，写入当前服务公开快照；来源私人TripID/版本留在本机，正文/图片/昵称/城市/季节/人群/经检查的安排公开。服务单独计revision，校验作者、expectedRevision和requestId，支持失败重试、新版与撤回。撤回后其他会话404。
- 公开互动：复用01 `sessionUser`设备访客身份，SQLite唯一关系保存点赞/收藏/关注，评论按身份校验删除、同ID重试不重复。公开Feed每页20条摘要，不加载完整正文/图片/安排；详情单独请求，URL恢复关注过滤与加载页数。“我的”同时显示社区收藏和本机路线收藏，范围明确。
- 服务接入：新增server/community.ts，server/index.ts仅增加import与/api/community/分流，经01协调；不改变分享与协作路由。社区使用原SQLite独立community_*表，没有第二套私人Trip数据。
- 本机资料先成功持久化再更新显示；拒绝存储保留旧值。头像/封面裁剪在浏览器本地完成。手机号、微信、Apple 登录缺少服务和凭证，仍明确设备访客。

## 本机数据与迁移说明

既有 `zouzou-demo-v2`、`zouzou-saved-plans-v1`、已勾选清单、费用和城市记忆没有清空。旧金额可按 amount 转为整数分参与计算，新写入明确 amountMinor。旧个人路线引用保留；有完整 Trip 的记录直接使用共享列表。自动测试仅在新的浏览器上下文写入合成数据，未读取或改写用户浏览器里的实际旅行。

生成的 fixtures.json、synthetic-data-export.json 仅为成都/大理/上海的测试数据，用于复现验收；不是用户数据备份。未提交 git、未推送、未公开部署。

## 公开社区验收补充

本轮7项真实浏览器社区验收与11项主流程回归通过，完整260项单测/38文件、类型检查及独立dist-task02构建通过。社区验收在隔离8789 API/4184预览完成，记录在artifacts/task02-v3/community.json与community-trace.zip。B13/B14在当前服务设备访客范围PASS；手机/微信/Apple账号及物理真机仍未验收。

## 供03复用的公开内容接口

前端类型与调用集中在 `src/services/community.ts`。`CommunityFeed` 负责读取摘要、分页、失败/空态及URL恢复；`PublicationEditor` 负责本机草稿与确认发布；`PublicationDetail` 读取服务中的独立公开快照。03可调整布局和样式，保留真实状态、作用域与权限判断。

| 接口 | 契约 |
|---|---|
| GET `/api/community/posts?mode=all/following/saved/mine&cursor=...` | 每页20条摘要与nextCursor；mine只当前会话，其他模式只已公开内容 |
| PUT `/api/community/posts/:id` | UUID id、requestId、expectedRevision、nickname、content白名单；成功返回独立revision，重复requestId不重复创建 |
| GET `/api/community/posts/:id` | 完整公开内容；撤回后仅作者可读，其他会话404 |
| POST `/api/community/posts/:id/retract` | expectedRevision校验；仅作者，重复撤回幂等 |
| PUT `/api/community/posts/:id/reactions` | kind=like/favorite，enabled布尔值，唯一会话关系 |
| PUT `/api/community/authors/:id/follow` | enabled布尔值；只关注实际存在的其他作者 |
| GET/POST `/api/community/posts/:id/comments` | 评论分页/按UUID防重提交；正文按文本渲染 |
| POST `/api/community/posts/:id/comments/:commentId/remove` | 只能删除当前会话自己的评论 |

所有作者权限来自服务端HttpOnly设备会话，不使用客户端ownerId。错误返回400输入不合法、403无权限、404已撤回/不存在、409版本或重试内容冲突；前端保留未成功提交的输入，不展示假成功。未完成私人行程默认并限制为“计划”，完成后可选“已体验”。
