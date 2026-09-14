# 走走手机发布记录

更新时间：2026-09-14。当前状态：**代码和图片已上传GitHub，Cloudflare预览构建中，生产尚未发布新版。** 线上最终版本以 /build.json 和本页后续结果为准。

## 发布目标与版本

| 项目 | 核实结果 |
| --- | --- |
| 原项目 | D:/走走；保留未纳入发布的采集、研究及本地修改 |
| GitHub | https://github.com/3555489035ppx-wq/zouzou ，原仓库已公开，未改变隐私 |
| 发布分支 | codex/mobile-cloud-release |
| 历史整合 | 原HEAD855a92e与main6549507最终tree相同；已正常合并，不强推 |
| 发布提交 | 2322148整合、df8ba60合并、180ae08回归与构建输入 |
| 唯一生产链路 | 现有Cloudflare Pages项目zouzou，Git集成，生产main |
| 正式域名 | https://zouzou.ppx.wiki；项目域名 https://zouzou-etq.pages.dev |
| 新预览 / 生产 | 88b58da7已成功，b4f6c42；离线修复继续推送 / 生产未执行 |
| 旧生产参考 | c89cb80c-bb93-4473-865f-ef3639f8aefa，仅旧静态版 |

## 内容清单

- 保留当前首页、原灰色Bot、授权图片、导航及Trip数据结构；继续下线三场景创建，不删除历史旅行。
- 用户声明图片自有且已取得许可，依据[CONTENT-AUTHORIZATION](CONTENT-AUTHORIZATION.md)发布。保留历史permission=unknown、verified=false，不把声明改写为事实核验。
- 知识版本travel-20260914-72591dbecea55e65：7918条reviewed、60城；12个实际输入及哈希见data/release/knowledge.json。只发布审核汇总，不上传逐条原始采集账本或WorkBuddy资料。
- 发现广场1200条、60城各20条、精选300条；修复真实来源路线丢失、图片回退、异步知识加载与旧计数断言。
- 按data/release/assets.json发布1178个实际资源，745115741字节，精简图片目录587条；原11.4GB采集材料仍留本机，图片URL路径不变。
- 完整指南库改为服务端按城市/查询检索；主JS约1.54MB/gzip424KB，发现懒加载块约2.21MB/gzip333KB；开发图片审核页不进入生产包。
- PWA图标、manifest、安装页和更新提示；单SW只缓存指纹资源，不缓存API或分享HTML，离线显示通用页。
- Pages Functions接入私人行程、分享、社区、旅行协作和AI；服务器随机访客身份，Secure/HttpOnly/SameSite Cookie，令牌仅哈希入库。
- 云端保存为显式操作，不冒充账号同步；分享支持1/7/30天、本人列表、显式更新与撤销，排除私人备注、原截图、住宿和到离信息。
- 未确认坐标用完整城市/地址搜索外部地图；室内资料不足时拒绝交付，不补造地点。

## Cloudflare配置与存储

根目录为仓库根，命令npm run build:release，产物dist，显式采用vite.config.ts，避免本机旧vite.config.js。Node24、pnpm11.24.0。仅/api/*交给Functions。

| 环境 | D1 / DB绑定 | 已应用迁移 |
| --- | --- | --- |
| preview | zouzou-preview / 55bf70c1-9248-4927-a332-8d115113fbee | 0001、0002、0003 |
| production | zouzou-production / a006a1c1-0c82-4fab-96ef-e9d618d851c0 | 0001、0002、0003 |

双环境隔离，迁移只建结构，无预置行程或清库；数据库不随构建重建。DEEPSEEK_API_KEY直接配置为Cloudflare服务端Secret；旧高德客户端Key变量已清空，日志和仓库不含密钥值。

账号/models实查支持deepseek-flash和deepseek-v4-pro，当前使用前者。本机handler连接真实供应商的理解及直接生成已成功，3套方案校验通过；远端Worker链路仍需另验。当前文字适配没有可用视觉供应商，截图需用户填写确认。访客有效30天，换设备/清Cookie不能保证找回；未接手机号、微信或Apple账号。

## 验证与发布

完整类型检查、574/574全量测试和完整发布构建通过；Worker平台编译通过。实际证据见[ACCEPTANCE](ACCEPTANCE.md)。

```powershell
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/vitest/vitest.mjs run
npm run build:release
node scripts/verify-cloud-release.mjs <verified-https-url> preview
node scripts/verify-cloud-ui.mjs <verified-https-url> preview
```

prepare-release-assets.ts供维护者从本机完整采集和审核材料更新投影；Cloudflare不执行它，只读取已提交投影，因此不依赖私有采集目录。非生产分支先预览，通过后正常合入main触发唯一生产链路。

## 恢复与设备边界

备份D:/走走-release-backups/20260914-mobile-200627，58826文件、34.113GB，robocopy FAILED=0，含工作/暂存patch；其中有私人资料，不能上传。原4183/8787及用户数据未清理。

回滚应选具备兼容D1接口的已验收Pages部署，保留表与迁移。旧c89cb80c仅静态版，回到它会失去云端功能，不能视为完整回滚。D1恢复须先核实Time Travel恢复点和影响，不随前端回退重建数据库。

实体iPhone/Android安装、系统分享/地图、国内Wi-Fi/蜂窝无VPN及软键盘仍需设备验收；电脑浏览器与Cloudflare部署成功不证明这些条件通过。
