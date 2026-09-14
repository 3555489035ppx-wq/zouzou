# 手机版本验收

更新时间：2026-09-14。**本地全量回归及完整发布构建通过，代码图片已上传GitHub；Cloudflare预览构建中，生产和真机尚未验收。**

## 自动验证

| 检查 | 结果 | 证据与边界 |
| --- | --- | --- |
| 全量Vitest | PASS，574/574，0失败 | qa/2026-09-14-mobile-release/final-unit-results.json |
| 完整TypeScript | PASS | tsc -b，含云端和Functions |
| 完整发布构建 | PASS | 同目录final-build.log，1178真实资源全部复制，非审计空壳 |
| Worker平台编译 | PASS | Wrangler Pages Functions，gzip约1.86MB |
| 发布输入闭包 | PASS | 补齐import脚本；测试只读公开审核汇总，不上传13245条原始审核账本 |
| 汇总输入变更复验 | PASS，11/11 | reviewedGuideKnowledge，保留数量/来源断言 |
| 本地隔离浏览器 | PASS，35检查 | 同目录browser/results.json，SQLite模拟D1，不等同线上 |
| 双环境真实D1迁移 | PASS | 0001私人数据、0002社区、0003协作均执行成功 |
| 本机handler→真实DeepSeek | PASS | understand约5782ms；直接generate约6593ms，deepseek-flash，3套校验通过；非Worker/D1验收 |
| 预览API与UI闭环 | 待验证 | 将记录preview/results.json、preview/ui-results.json |
| 生产SHA/知识版本/闭环 | 待验证 | 将记录production/results.json、production/ui-results.json |

## 回归修复依据

- 发现1178/1200缺口恢复已有真实来源路线，60城各20条；不伪造新来源。
- 图片、早餐、混排、详情异步知识和天数组合相关45项通过。
- 城市旧测试比较top15，当前UI使用每城20条广场目录；改为验证实际计数、同城非空详情、唯一ID和全国总数。
- 餐厅旧排序断言更新为当前有来源的规范店铺；新增同一家店不同菜名不得重复占候选的检查。
- 五城旧来源不保证排前8；分别检查旧批次可召回、真实前后端检索一致、来源去重及三方案生成。
- 半天时间和轻松密度修复；室内发布出口重新校验实际站点，待选或室外场所不能冒充可行室内方案。
- 原535/571项失败报告保留为历史，不再代表当前全量结果；未通过删测试或补造数据取得PASS。

## 任务书剩余验收

| 项目 | 当前状态 |
| --- | --- |
| 原工程保护、授权范围、发布清单 | PASS，见CONTENT-AUTHORIZATION与RELEASE |
| GitHub/Pages/build SHA一致 | 待远端核验 |
| 脱离本机服务的真实云端读写 | 待远端闭环 |
| 私人行程、分享权限/期限/撤销 | 本地通过；远端及再次部署后持久化待验 |
| 旅行协作 | D1适配17项通过，远端邀请链路待验 |
| 最新知识及模型 | 明确版本7918条60城；真实模型本机调用通过，Worker待验 |
| PWA与手机页面 | 本地尺寸、manifest、SW和离线通过；实体机未测 |
| 外部地图、系统分享 | 自动链接/坐标通过；真实App调起、取消和剪贴板限制未测 |
| 更新保留输入与云数据 | 不强刷已实现；真实旧新版本升级待验 |
| 国内无VPN | NOT RUN，无国内手机Wi-Fi/蜂窝证据 |
| 截图识别 | 当前DeepSeek文字适配不支持，明确错误，由用户填写确认 |

不公开Secret、本机备份、用户旅行原始资料或独立WorkBuddy库；没有删除生产数据。电脑访问远端的结果不能替代实体手机或中国大陆网络验收。
