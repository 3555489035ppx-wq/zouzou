# 手机版本验收

更新时间：2026-09-14。**代码图片已上传GitHub并部署正式域名；自动化代码、真实云端与浏览器验收通过。实体手机和中国大陆网络验收仍NOT RUN。** 已验收业务提交91fce69；生产部署53c20425，预览部署a1050f70。

## 自动验证

| 检查 | 结果 | 证据与边界 |
| --- | --- | --- |
| 全量Vitest | PASS，576/576，0失败 | qa/2026-09-14-mobile-release/release-unit-results.json |
| 完整TypeScript | PASS | tsc -b，含云端和Functions |
| 完整发布构建 | PASS | 同目录final-build.log，1178真实资源全部复制，非审计空壳 |
| Worker平台编译 | PASS | Wrangler Pages Functions，gzip约1.86MB |
| 发布输入闭包 | PASS | 补齐import脚本；测试只读公开审核汇总，不上传13245条原始审核账本 |
| 汇总输入变更复验 | PASS，11/11 | reviewedGuideKnowledge，保留数量/来源断言 |
| 本地隔离浏览器 | PASS，35检查 | 同目录browser/results.json，SQLite模拟D1，不等同线上 |
| 双环境真实D1迁移 | PASS | 0001私人数据、0002社区、0003协作均执行成功 |
| 本机handler→真实DeepSeek | PASS | understand约5782ms；直接generate约6593ms，deepseek-flash，3套校验通过；非Worker/D1验收 |
| 预览UI闭环 | PASS，10检查 | preview/ui-results.json：真实模型、选用、D1保存/恢复、继续同Trip、分享创建/撤销、200%字体 |
| 预览API/PWA扩展 | PASS，50/50 | preview/results.json，实际模型、D1、权限、快照、协作、320/390/430页面、图片、离线 |
| 生产API/PWA | PASS，45/45 | production/results.json，正式域名真实模型/D1/分享权限与撤销/多尺寸/离线；不含预览协作5项 |
| 生产UI | PASS，10/10 | production/ui-results.json，真实页面生成→选用→D1保存→同身份恢复→分享/撤销及200%字体 |
| SHA与知识版本 | PASS | GitHub main、生产Pages和build.json同为91fce69，knowledgeVersion一致且dirty=false |
| 跨真实预览部署持久化 | PASS | persistence-results.json，b4f6c42→91fce69私人行程与旧分享仍有效，探针链接已撤销 |
| 真实旧新版SW升级 | PASS，5/5 | update-results.json，出现/激活更新不刷新文档，草稿和已保存行程未改变，重新打开仍保留 |
| 200%字体真实票券布局 | PASS | preview/layout-results.json；等待实际票券渲染后检查并截图，不用空页面断言代替 |

## 回归修复依据

- 发现1178/1200缺口恢复已有真实来源路线，60城各20条；不伪造新来源。
- 图片、早餐、混排、详情异步知识和天数组合相关45项通过。
- 城市旧测试比较top15，当前UI使用每城20条广场目录；改为验证实际计数、同城非空详情、唯一ID和全国总数。
- 餐厅旧排序断言更新为当前有来源的规范店铺；新增同一家店不同菜名不得重复占候选的检查。
- 五城旧来源不保证排前8；分别检查旧批次可召回、真实前后端检索一致、来源去重及三方案生成。
- 半天时间和轻松密度修复；室内发布出口重新校验实际站点，待选或室外场所不能冒充可行室内方案。
- 原535/571项失败报告保留为历史，不再代表当前全量结果；未通过删测试或补造数据取得PASS。
- 云端特有离线问题：Pages将offline.html重定向至offline，缓存响应redirected=true不能用于导航。先复现红色回归，再改为返回相同离线正文的新Response；单测、最小远端复现及预览/生产完整离线检查均通过。

## 任务书剩余验收

| 项目 | 当前状态 |
| --- | --- |
| 原工程保护、授权范围、发布清单 | PASS，见CONTENT-AUTHORIZATION与RELEASE |
| GitHub/Pages/build SHA一致 | PASS；后续文档提交的最新SHA以build.json为准 |
| 脱离本机服务的真实云端读写 | PASS；所有远端检查直接访问Pages或正式HTTPS，不访问localhost |
| 私人行程、分享权限/期限/撤销 | PASS；本地到期/冲突测试，远端权限/更新/撤销和预览跨部署持久化通过 |
| 旅行协作 | PASS；D1适配17项，预览真实创建/双访客加入/邀请撤销链路通过 |
| 最新知识及模型 | PASS；7918条60城版本匹配，预览和正式Worker真实DeepSeek生成通过 |
| PWA与手机页面 | 自动尺寸、manifest、SW、离线和更新通过；实体机未测 |
| 外部地图、系统分享 | 自动链接/坐标通过；真实App调起、取消和剪贴板限制未测 |
| 更新保留输入与云数据 | PASS；实际b4f6c42→91fce69升级及D1跨部署检查 |
| 国内无VPN | NOT RUN，无国内手机Wi-Fi/蜂窝证据 |
| 截图识别 | 当前DeepSeek文字适配不支持，明确错误，由用户填写确认 |

不公开Secret、本机备份、用户旅行原始资料或独立WorkBuddy库；没有删除生产数据。电脑访问远端的结果不能替代实体手机或中国大陆网络验收。
