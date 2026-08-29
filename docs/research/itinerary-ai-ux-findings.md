# 走走：完整攻略生成的研究结论

更新时间：2026-08-30

## 产品结构

Trip.com 的官方 Trip.Planner 将目的地、日期/时长、旅行风格、交通、酒店、餐厅和景点放在同一条可编辑时间轴，并提供地图预览与实时可用性提示。马蜂窝的公开产品页同样把酒店、景点、美食和活动组合成可调整的行程。走走因此把生成入口收敛为四个必填条件：目的地、天数、预算、想做什么；到达站、返程、住宿偏好和截图作为可选约束。

## 事实层与灵感层

- 事实层：官方地点页、预约/开放时间和高德 POI 链接。长沙的岳麓山、橘子洲预约提示使用湖南省政府公开信息；湖南博物院开放时间和免费/预约说明使用博物院公开信息。
- 灵感层：本地知识库只保留社区攻略的标题、作者、点赞数（如果来源明确）、地点提示和原始链接，不复制正文、图片或评论。社区线索不能直接覆盖价格、营业时间、路线或预约事实。
- 未收录的城市显示“候选层待核验”，不把模板地点伪装成已验证商户。

## 生成规则

1. 先解析城市、天数、预算、人数、节奏、目的和固定到达/返程锚点。
2. 以城市知识库匹配必去地点与偏好，按片区分配景点、餐饮、小吃、活动和自由探索时间。
3. 根据预算与晚数从经济、舒适、高星三个住宿档位中选择，住宿单独计入预算。
4. 每个地点保留停留时间、移动时间、营业窗口、价格估算、来源和核验状态。
5. 生成三种密度（最匹配、最轻松、体验最丰富），重新检查时间顺序、营业窗口、必去覆盖和预算上限。

## 来源

- [Trip.com 官方 Trip.Planner 介绍](https://www.trip.com/newsroom/trip-com-launches-trip-planner-smart-itineraries-tailored-to-your-travel-style-with-real-time-recommendations/)
- [Trip.com Trip Planner](https://au.trip.com/webapp/tripmap/tripplanner?curr=USD&locale=en-AU&source=t_online_homepage)
- [马蜂窝](https://www.mfw.com/)
- [湖南省人民政府：岳麓山、橘子洲预约提示](https://enghunan.gov.cn/hneng/SP/sp2023/2023MayDay/202304/t20230426_29324698.html)
- [湖南博物院：马王堆汉墓展参观信息](https://web.hnmuseum.com/en/content/changsha-mawangdui-han-dynasty-tombs-exhibition)
- [高德地图 URI API](https://lbs.amap.com/api/uri-api/summary)
- [小红书开放平台快速开始](https://openaccount.xiaohongshu.com/docs/quick-start)

