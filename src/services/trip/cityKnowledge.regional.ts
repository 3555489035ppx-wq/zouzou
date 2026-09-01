import type { CityAdditionalSpec } from './cityKnowledge.expanded'

type PlaceTuple = [name: string, area: string, category?: 'attraction' | 'activity']
type FoodTuple = [name: string, area: string, dietaryTags?: string[], category?: 'food' | 'restaurant']
type RegionalCatalog = {
  center: [number, number]
  landmarks: PlaceTuple[]
  local: PlaceTuple[]
  foods: FoodTuple[]
}

const catalogs: Record<string, RegionalCatalog> = {
  康定: {
    center: [101.956, 30.051],
    landmarks: [
      ['康定情歌木格措风景区', '康定北线', 'attraction'], ['跑马山风景区', '康定市区', 'attraction'], ['新都桥', '新都桥镇', 'attraction'], ['塔公草原', '塔公草原远线', 'attraction'], ['折多山', '折多山远线', 'attraction'],
      ['鱼子西', '新都桥远线', 'attraction'], ['贡嘎雪山观景台', '新都桥远线', 'attraction'], ['康定情歌广场', '康定老城', 'activity'], ['溜溜城', '康定老城', 'activity'], ['将军桥—西大街', '康定老城', 'activity'],
    ],
    local: [
      ['康定老城晨走', '溜溜城 / 将军桥', 'activity'], ['沿河东路散步', '康定河沿线', 'activity'], ['情歌广场转经筒', '康定老城', 'activity'], ['锅庄舞体验', '康定老城', 'activity'], ['高原咖啡休息', '情歌广场片区', 'activity'],
      ['新都桥光影摄影', '新都桥镇', 'activity'], ['折多山垭口看雪', '折多山远线', 'activity'], ['318自驾补给', '康定老城', 'activity'], ['藏式手工艺逛店', '溜溜城', 'activity'], ['康定河晨练', '康定市区', 'activity'],
    ],
    foods: [
      ['牦牛肉鲜菌汤锅', '将军桥 / 溜溜城', ['meat']], ['藏餐牦牛盖被', '康定老城藏餐馆', ['meat']], ['青稞饼', '情歌广场小吃铺', [], 'food'], ['酥油茶', '康定老城茶馆', ['dairy'], 'food'], ['牦牛酸奶', '溜溜城甜品铺', ['dairy'], 'food'],
      ['糌粑', '康定老城藏餐馆', ['dairy'], 'food'], ['康定凉粉', '西大街小吃铺', ['spicy'], 'food'], ['牦牛肉粉', '市区早餐铺', ['meat']], ['烤牦牛肉', '沿河东路烧烤铺', ['meat', 'spicy'], 'food'], ['康杰老字号蒸饺', '康定老城', ['meat'], 'food'],
    ],
  },
  稻城亚丁: {
    center: [100.297, 29.037],
    landmarks: [
      ['稻城亚丁景区', '香格里拉镇景区', 'attraction'], ['冲古寺', '亚丁景区短线', 'attraction'], ['洛绒牛场', '亚丁景区长线', 'attraction'], ['牛奶海', '亚丁景区长线', 'attraction'], ['五色海', '亚丁景区长线', 'attraction'],
      ['仙乃日', '亚丁景区', 'attraction'], ['央迈勇', '亚丁景区', 'attraction'], ['夏诺多吉', '亚丁景区', 'attraction'], ['稻城白塔', '稻城县城', 'attraction'], ['桑堆红草地', '桑堆镇远线', 'attraction'],
    ],
    local: [
      ['香格里拉镇慢走', '香格里拉镇', 'activity'], ['亚丁村晨雾', '亚丁村', 'activity'], ['稻城县城白塔晨走', '稻城县城', 'activity'], ['海子山古冰帽观景', '海子山远线', 'activity'], ['俄初山摄影', '香格里拉镇远线', 'activity'],
      ['藏式民居与手工艺', '香格里拉镇', 'activity'], ['高原星空观察', '香格里拉镇', 'activity'], ['亚丁村藏寨散步', '亚丁村', 'activity'], ['稻城河谷慢走', '稻城县城', 'activity'], ['高原咖啡休息', '香格里拉镇', 'activity'],
    ],
    foods: [
      ['松茸鸡汤', '香格里拉镇餐馆', ['meat']], ['藏香猪', '香格里拉镇藏餐馆', ['meat', 'pork']], ['青稞饼', '亚丁村小吃铺', [], 'food'], ['酥油茶', '香格里拉镇茶馆', ['dairy'], 'food'], ['牦牛肉', '稻城县城餐馆', ['meat']],
      ['糌粑', '稻城县城藏餐馆', ['dairy'], 'food'], ['牦牛酸奶', '香格里拉镇甜品铺', ['dairy'], 'food'], ['藏式包子', '稻城县城早餐铺', ['meat'], 'food'], ['高原土豆', '稻城家常菜馆', [], 'food'], ['稻城米线', '稻城县城早餐铺', ['meat'], 'food'],
    ],
  },
  九寨沟: {
    center: [103.599, 33.263],
    landmarks: [
      ['九寨沟风景名胜区', '漳扎镇景区', 'attraction'], ['五花海', '日则沟', 'attraction'], ['诺日朗瀑布', '诺日朗中心', 'attraction'], ['长海', '则查洼沟', 'attraction'], ['珍珠滩瀑布', '日则沟', 'attraction'],
      ['镜海', '日则沟', 'attraction'], ['树正群海', '树正沟', 'attraction'], ['则查洼沟', '九寨沟景区', 'attraction'], ['日则沟', '九寨沟景区', 'attraction'], ['神仙池', '九寨沟远线', 'attraction'],
    ],
    local: [
      ['沟口藏寨夜逛', '漳扎镇', 'activity'], ['彰扎镇早市', '漳扎镇', 'activity'], ['藏羌歌舞体验', '沟口演艺片区', 'activity'], ['中查沟慢走', '中查沟远线', 'activity'], ['甘海子观景', '九寨沟远线', 'activity'],
      ['九寨沟沟口晨练', '漳扎镇', 'activity'], ['藏式手工艺逛店', '沟口藏寨', 'activity'], ['高原星空观察', '漳扎镇', 'activity'], ['九寨千古情', '漳扎镇', 'activity'], ['沟口咖啡休息', '漳扎镇', 'activity'],
    ],
    foods: [
      ['牦牛肉汤锅', '漳扎镇餐馆', ['meat']], ['藏式土火锅', '沟口藏餐馆', ['meat', 'dairy']], ['酥油茶', '漳扎镇茶馆', ['dairy'], 'food'], ['青稞饼', '沟口小吃铺', [], 'food'], ['牦牛酸奶', '藏寨甜品铺', ['dairy'], 'food'],
      ['虫草花鸡汤', '漳扎镇餐馆', ['meat'], 'food'], ['蕨麻猪', '九寨沟藏餐馆', ['meat', 'pork']], ['糌粑', '沟口藏餐馆', ['dairy'], 'food'], ['牦牛肉面', '漳扎镇早餐铺', ['meat']], ['洋芋糍粑', '九寨沟小吃铺', [], 'food'],
    ],
  },
  大理: {
    center: [100.267, 25.606],
    landmarks: [
      ['大理古城', '大理古城', 'attraction'], ['洱海生态廊道', '洱海西岸', 'attraction'], ['崇圣寺三塔', '古城北线', 'attraction'], ['苍山', '苍山景区', 'attraction'], ['喜洲古镇', '喜洲远线', 'attraction'],
      ['双廊古镇', '洱海东岸远线', 'attraction'], ['小普陀', '洱海东岸', 'attraction'], ['龙龛码头', '古城南线', 'attraction'], ['蝴蝶泉', '喜洲远线', 'attraction'], ['沙溪古镇', '剑川远线', 'attraction'],
    ],
    local: [
      ['古城南门晨走', '大理古城', 'activity'], ['才村环海骑行', '洱海西岸', 'activity'], ['龙龛码头看日出', '古城南线', 'activity'], ['磻溪S湾慢走', '洱海西岸', 'activity'], ['床单厂艺术区', '大理古城', 'activity'],
      ['下关菜市场逛吃', '下关老城', 'activity'], ['喜洲田园散步', '喜洲远线', 'activity'], ['白族扎染体验', '周城村', 'activity'], ['洱海生态廊道看风', '洱海西岸', 'activity'], ['古城本地咖啡', '大理古城', 'activity'],
    ],
    foods: [
      ['火烧生皮', '下关 / 古城餐馆', ['meat']], ['乳扇', '古城小吃铺', ['dairy'], 'food'], ['饵块', '大理古城小吃铺', [], 'food'], ['饵丝', '下关早餐铺', ['meat']], ['喜洲粑粑', '喜洲古镇', ['meat'], 'food'],
      ['酸辣鱼', '洱海边白族菜馆', ['seafood', 'spicy']], ['野生菌火锅', '古城南门餐馆', [], 'restaurant'], ['三道茶', '古城白族茶馆', ['dairy'], 'food'], ['凉鸡米线', '古城社区米线店', ['meat'], 'food'], ['石板烧', '古城南门餐馆', ['meat'], 'restaurant'],
    ],
  },
  丽江: {
    center: [100.233, 26.872],
    landmarks: [
      ['丽江古城', '古城核心', 'attraction'], ['玉龙雪山', '玉龙雪山景区', 'attraction'], ['蓝月谷', '玉龙雪山景区', 'attraction'], ['束河古镇', '束河片区', 'attraction'], ['白沙古镇', '玉龙县', 'attraction'],
      ['泸沽湖', '泸沽湖远线', 'attraction'], ['黑龙潭公园', '古城北线', 'attraction'], ['木府', '丽江古城', 'attraction'], ['玉水寨', '玉龙县', 'attraction'], ['拉市海', '拉市海远线', 'attraction'],
    ],
    local: [
      ['古城四方街晨走', '丽江古城', 'activity'], ['狮子山看日落', '古城西侧', 'activity'], ['白沙壁画慢看', '白沙古镇', 'activity'], ['纳西古乐体验', '古城东大街', 'activity'], ['忠义市场逛早市', '古城南门', 'activity'],
      ['束河古镇慢走', '束河片区', 'activity'], ['拉市海骑马或湿地走', '拉市海远线', 'activity'], ['象山菜市场早餐', '丽江老城', 'activity'], ['东巴纸体验', '白沙古镇', 'activity'], ['玉龙雪山看日照金山', '玉龙雪山', 'activity'],
    ],
    foods: [
      ['腊排骨火锅', '古城南门', ['meat', 'pork'], 'restaurant'], ['纳西烤肉', '丽江古城', ['meat']], ['鸡豆凉粉', '古城小吃铺', ['spicy'], 'food'], ['丽江粑粑', '古城四方街', ['meat'], 'food'], ['牦牛肉火锅', '古城北门', ['meat'], 'restaurant'],
      ['纳西烤鱼', '束河古镇', ['seafood']], ['野生菌火锅', '古城餐馆', [], 'restaurant'], ['酥油茶', '古城茶馆', ['dairy'], 'food'], ['玫瑰鲜花饼', '古城伴手礼铺', [], 'food'], ['过桥米线', '丽江老城早餐铺', ['meat'], 'food'],
    ],
  },
  香格里拉: {
    center: [99.708, 27.825],
    landmarks: [
      ['松赞林寺', '香格里拉北线', 'attraction'], ['普达措国家公园', '普达措远线', 'attraction'], ['独克宗古城', '香格里拉老城', 'attraction'], ['纳帕海', '纳帕海环线', 'attraction'], ['虎跳峡', '虎跳峡远线', 'attraction'],
      ['白水台', '香格里拉远线', 'attraction'], ['巴拉格宗', '巴拉格宗远线', 'attraction'], ['石卡雪山', '香格里拉西线', 'attraction'], ['梅里雪山', '德钦远线', 'attraction'], ['小中甸花海', '小中甸远线', 'attraction'],
    ],
    local: [
      ['古城龟山公园转经', '独克宗古城', 'activity'], ['独克宗古城夜景', '香格里拉老城', 'activity'], ['藏民家访体验', '香格里拉近郊', 'activity'], ['纳帕海环湖', '纳帕海环线', 'activity'], ['小中甸牧场慢走', '小中甸远线', 'activity'],
      ['藏式手工艺逛店', '独克宗古城', 'activity'], ['香巴拉时轮坛城', '香格里拉老城', 'activity'], ['牦牛牧场观察', '香格里拉近郊', 'activity'], ['高原咖啡休息', '独克宗古城', 'activity'], ['藏族歌舞体验', '香格里拉老城', 'activity'],
    ],
    foods: [
      ['牦牛火锅', '独克宗古城', ['meat'], 'restaurant'], ['藏香猪', '香格里拉老城', ['meat', 'pork']], ['酥油茶', '独克宗古城茶馆', ['dairy'], 'food'], ['青稞饼', '古城小吃铺', [], 'food'], ['牦牛酸奶', '古城甜品铺', ['dairy'], 'food'],
      ['糌粑', '藏餐馆', ['dairy'], 'food'], ['石锅鸡', '香格里拉餐馆', ['meat'], 'restaurant'], ['松茸鸡', '香格里拉餐馆', ['meat'], 'restaurant'], ['牦牛肉干', '古城伴手礼铺', ['meat'], 'food'], ['尼西土锅鸡', '尼西远线', ['meat'], 'restaurant'],
    ],
  },
  西双版纳: {
    center: [100.797, 22.002],
    landmarks: [
      ['告庄西双景', '景洪市区', 'attraction'], ['曼听公园', '景洪老城', 'attraction'], ['中国科学院西双版纳热带植物园', '勐腊远线', 'attraction'], ['野象谷', '景洪北线', 'attraction'], ['傣族园', '橄榄坝远线', 'attraction'],
      ['总佛寺', '景洪老城', 'attraction'], ['星光夜市', '告庄西双景', 'activity'], ['原始森林公园', '景洪北线', 'attraction'], ['曼远村', '勐腊远线', 'attraction'], ['勐泐大佛寺', '景洪南线', 'attraction'],
    ],
    local: [
      ['傣族早市', '景洪老城', 'activity'], ['告庄夜市慢逛', '告庄西双景', 'activity'], ['江边夜市', '澜沧江沿岸', 'activity'], ['曼阁水果市场', '景洪老城', 'activity'], ['赶摆集市体验', '傣族园', 'activity'],
      ['傣陶手作体验', '景洪市区', 'activity'], ['热带植物园研学', '勐腊远线', 'activity'], ['橄榄坝村寨慢走', '橄榄坝远线', 'activity'], ['澜沧江边散步', '景洪市区', 'activity'], ['泼水广场看夜色', '景洪老城', 'activity'],
    ],
    foods: [
      ['傣味手抓饭', '告庄餐馆', ['meat'], 'restaurant'], ['菠萝饭', '傣族园', [], 'food'], ['香茅草烤鱼', '告庄夜市', ['seafood']], ['包烧', '景洪傣味馆', ['seafood', 'spicy'], 'food'], ['舂鸡脚', '告庄夜市', ['meat', 'spicy'], 'food'],
      ['酸笋', '景洪傣味馆', ['spicy'], 'food'], ['傣味烧烤', '江边夜市', ['meat', 'spicy'], 'restaurant'], ['版纳米线', '景洪早餐铺', ['meat'], 'food'], ['竹筒饭', '傣族园', [], 'food'], ['热带水果', '曼阁水果市场', [], 'food'],
    ],
  },
  腾冲: {
    center: [98.497, 25.017],
    landmarks: [
      ['和顺古镇', '和顺片区', 'attraction'], ['热海景区', '热海远线', 'attraction'], ['火山地热国家地质公园', '马站乡远线', 'attraction'], ['银杏村', '固东镇远线', 'attraction'], ['北海湿地', '北海湿地远线', 'attraction'],
      ['国殇墓园', '腾冲老城', 'attraction'], ['叠水河瀑布', '腾冲老城', 'attraction'], ['云峰山', '腾冲远线', 'attraction'], ['腾冲文庙', '腾冲老城', 'attraction'], ['高黎贡山', '高黎贡山远线', 'attraction'],
    ],
    local: [
      ['和顺古镇早市', '和顺片区', 'activity'], ['热海泡温泉', '热海景区', 'activity'], ['司莫拉佤族村', '腾冲近郊', 'activity'], ['腾冲老城菜市场', '腾冲老城', 'activity'], ['和顺图书馆慢看', '和顺片区', 'activity'],
      ['边贸集市逛吃', '腾冲老城', 'activity'], ['高黎贡山徒步', '高黎贡山远线', 'activity'], ['银杏村秋季散步', '固东镇远线', 'activity'], ['腾冲皮影戏', '腾冲老城', 'activity'], ['本地咖啡休息', '和顺片区', 'activity'],
    ],
    foods: [
      ['大救驾', '腾冲老城', ['meat'], 'restaurant'], ['稀豆粉', '老城早餐铺', [], 'food'], ['饵丝', '腾冲老城', ['meat'], 'food'], ['土锅子', '和顺餐馆', ['meat'], 'restaurant'], ['头脑', '腾冲早餐铺', ['meat'], 'food'],
      ['赶马肉', '腾冲老城餐馆', ['meat']], ['竹筒饭', '司莫拉村', [], 'food'], ['烤乳猪', '和顺餐馆', ['meat', 'pork'], 'restaurant'], ['腾冲卷粉', '老城小吃铺', ['meat'], 'food'], ['松花糕', '和顺古镇', ['dairy'], 'food'],
    ],
  },
  沈阳: {
    center: [123.431, 41.805],
    landmarks: [
      ['沈阳故宫', '沈河区老城', 'attraction'], ['张氏帅府', '沈河区老城', 'attraction'], ['北陵公园', '皇姑区', 'attraction'], ['辽宁省博物馆', '浑南新区', 'attraction'], ['九一八历史博物馆', '大东区', 'attraction'],
      ['中街步行街', '沈河区老城', 'activity'], ['沈阳世博园', '浑南远线', 'attraction'], ['棋盘山', '棋盘山远线', 'attraction'], ['沈阳博物馆', '沈河区老城', 'attraction'], ['中国工业博物馆', '铁西区', 'attraction'],
    ],
    local: [
      ['西塔街早市', '和平区西塔', 'activity'], ['老北市夜逛', '皇寺片区', 'activity'], ['中街老字号慢走', '沈河区老城', 'activity'], ['彩电塔看夜景', '和平区', 'activity'], ['浑河沿岸散步', '浑河新区', 'activity'],
      ['太原街逛吃', '和平区', 'activity'], ['铁西1905文创园', '铁西区', 'activity'], ['东北洗浴体验', '沈阳市区', 'activity'], ['小河沿早市', '大东区', 'activity'], ['辽宁大剧院看演出', '沈河区老城', 'activity'],
    ],
    foods: [
      ['鸡架', '沈阳老城小店', ['meat'], 'food'], ['老边饺子', '中街老城', ['meat'], 'restaurant'], ['锅包肉', '东北菜馆', ['meat', 'pork'], 'restaurant'], ['白肉血肠', '沈阳老城', ['meat', 'pork'], 'restaurant'], ['吊炉饼', '西塔早餐铺', ['meat'], 'food'],
      ['马家烧麦', '回民街区', ['meat'], 'food'], ['冷面', '西塔街', ['meat'], 'food'], ['烤鸡架', '和平区夜宵铺', ['meat'], 'food'], ['东北烧烤', '老北市', ['meat', 'spicy'], 'restaurant'], ['杀猪菜', '东北菜馆', ['meat', 'pork'], 'restaurant'],
    ],
  },
  大连: {
    center: [121.615, 38.914],
    landmarks: [
      ['星海广场', '沙河口区海岸', 'attraction'], ['滨海路', '大连南部海岸', 'attraction'], ['老虎滩海洋公园', '中山区海岸', 'attraction'], ['棒棰岛', '中山区海岸', 'attraction'], ['东港音乐喷泉', '东港商务区', 'activity'],
      ['旅顺口景区', '旅顺远线', 'attraction'], ['金石滩国家旅游度假区', '金石滩远线', 'attraction'], ['大连森林动物园', '南石道街', 'attraction'], ['中山广场', '中山区老城', 'attraction'], ['俄罗斯风情街', '西岗区老城', 'activity'],
    ],
    local: [
      ['东港晨走', '东港商务区', 'activity'], ['付家庄海边散步', '滨海路', 'activity'], ['渔人码头看日落', '老虎滩', 'activity'], ['黑石礁海岸慢走', '黑石礁', 'activity'], ['大连理工校园漫步', '高新园区', 'activity'],
      ['老虎滩渔港逛市场', '老虎滩', 'activity'], ['青泥洼夜逛', '中山区老城', 'activity'], ['本地海鲜市场', '大连老城', 'activity'], ['海边咖啡休息', '星海广场', 'activity'], ['大连洗浴体验', '市区生活线', 'activity'],
    ],
    foods: [
      ['海菜包子', '大连老城早餐铺', ['seafood'], 'food'], ['焖子', '老城小吃铺', [], 'food'], ['鲅鱼饺子', '大连海鲜馆', ['seafood'], 'restaurant'], ['海鲜烧烤', '渔人码头', ['seafood'], 'restaurant'], ['咸鱼饼子', '大连家常菜馆', ['seafood'], 'restaurant'],
      ['烤鱿鱼', '俄罗斯风情街', ['seafood'], 'food'], ['海胆蒸蛋', '大连海鲜馆', ['seafood'], 'restaurant'], ['锅贴', '中山区早餐铺', ['meat'], 'food'], ['樱桃', '大连近郊果园', [], 'food'], ['大连老菜', '中山广场餐馆', ['seafood', 'meat'], 'restaurant'],
    ],
  },
  长春: {
    center: [125.324, 43.817],
    landmarks: [
      ['伪满皇宫博物院', '宽城区老城', 'attraction'], ['重庆路咖啡休息', '宽城区老城', 'activity'], ['净月潭国家森林公园', '净月区', 'attraction'], ['长春世界雕塑公园', '南关区', 'attraction'], ['吉林省博物院', '净月区', 'attraction'], ['长影旧址博物馆', '朝阳区', 'attraction'],
      ['南湖公园', '朝阳区', 'attraction'], ['这有山', '红旗街', 'activity'], ['长春动植物公园', '南关区', 'attraction'], ['桂林路步行街', '朝阳区', 'activity'], ['长春电影制片厂', '朝阳区', 'attraction'],
    ],
    local: [
      ['红旗街夜逛', '红旗街', 'activity'], ['重庆路慢走', '宽城区老城', 'activity'], ['桂林路小吃', '朝阳区', 'activity'], ['南湖公园晨练', '朝阳区', 'activity'], ['伪满建筑漫步', '宽城区老城', 'activity'],
      ['净月潭骑行', '净月区', 'activity'], ['东北洗浴体验', '长春市区', 'activity'], ['社区早市', '长春老城', 'activity'], ['电影主题街区', '长影片区', 'activity'], ['伊通河夜走', '南关区', 'activity'],
    ],
    foods: [
      ['长春冷面', '桂林路小吃铺', ['meat'], 'food'], ['锅包肉', '东北菜馆', ['meat', 'pork'], 'restaurant'], ['长春酱肉', '老城熟食铺', ['meat', 'pork'], 'food'], ['白肉血肠', '东北菜馆', ['meat', 'pork'], 'restaurant'], ['酸菜白肉', '长春家常菜馆', ['meat', 'pork'], 'restaurant'],
      ['东北烧烤', '红旗街夜宵', ['meat', 'spicy'], 'restaurant'], ['鸡架', '长春社区小店', ['meat'], 'food'], ['老字号饺子', '重庆路老城', ['meat'], 'restaurant'], ['粘豆包', '早市小吃铺', [], 'food'], ['熏酱熟食', '长春老城', ['meat', 'pork'], 'food'],
    ],
  },
  延吉: {
    center: [129.513, 42.904],
    landmarks: [
      ['延边博物馆', '延吉市区', 'attraction'], ['中国朝鲜族民俗园', '延吉南线', 'attraction'], ['帽儿山国家森林公园', '延吉南线', 'attraction'], ['延吉西市场', '延吉老城', 'activity'], ['延吉恐龙王国', '延吉新区', 'attraction'],
      ['延边大学', '延吉市区', 'attraction'], ['布尔哈通河', '延吉市区', 'attraction'], ['延吉公园', '延吉老城', 'attraction'], ['图们口岸', '图们远线', 'attraction'], ['长白山', '长白山远线', 'attraction'],
    ],
    local: [
      ['水上市场早市', '延吉老城', 'activity'], ['西市场逛吃', '延吉老城', 'activity'], ['延边大学网红墙', '延吉市区', 'activity'], ['帽儿山晨走', '延吉南线', 'activity'], ['民俗园服饰体验', '朝鲜族民俗园', 'activity'],
      ['布尔哈通河夜走', '延吉市区', 'activity'], ['东市场本地采买', '延吉老城', 'activity'], ['朝鲜族歌舞体验', '延吉市区', 'activity'], ['东北洗浴体验', '延吉市区', 'activity'], ['图们口岸一日线', '图们远线', 'activity'],
    ],
    foods: [
      ['延吉冷面', '西市场', ['meat'], 'food'], ['石锅拌饭', '延边大学片区', [], 'restaurant'], ['米肠', '水上市场', ['meat'], 'food'], ['辣白菜', '西市场', ['spicy'], 'food'], ['参鸡汤', '延吉老城餐馆', ['meat'], 'restaurant'],
      ['朝鲜族烤肉', '延边大学片区', ['meat'], 'restaurant'], ['打糕', '水上市场', [], 'food'], ['大酱汤', '延吉老城', ['spicy'], 'restaurant'], ['明太鱼', '延吉餐馆', ['seafood'], 'restaurant'], ['紫菜饭团', '延吉早餐铺', [], 'food'],
    ],
  },
  漠河: {
    center: [122.539, 52.972],
    landmarks: [
      ['北极村', '北极村', 'attraction'], ['北红村', '北红村远线', 'attraction'], ['九曲十八弯', '漠河远线', 'attraction'], ['白桦林', '漠河近郊', 'attraction'], ['乌苏里浅滩', '北极村远线', 'attraction'],
      ['龙江第一湾', '漠河远线', 'attraction'], ['胭脂沟', '漠河远线', 'attraction'], ['北极星广场', '漠河县城', 'attraction'], ['松苑原始森林', '漠河县城', 'attraction'], ['漠河舞厅', '漠河县城', 'activity'],
    ],
    local: [
      ['找北邮局', '北极村', 'activity'], ['最北一家打卡', '北极村', 'activity'], ['北极村晨雾', '北极村', 'activity'], ['冬季冰雪活动', '北极村', 'activity'], ['鄂伦春文化体验', '漠河近郊', 'activity'], ['漠河老城夜走', '漠河县城', 'activity'],
      ['北红村炕体验', '北红村远线', 'activity'], ['漠河早市', '漠河县城', 'activity'], ['松苑晨走', '漠河县城', 'activity'], ['俄罗斯风情逛街', '漠河县城', 'activity'], ['观北极光', '北极村季节线', 'activity'],
    ],
    foods: [
      ['蓝莓', '漠河市场', [], 'food'], ['东北铁锅炖', '漠河县城', ['meat'], 'restaurant'], ['杀猪菜', '漠河家常菜馆', ['meat', 'pork'], 'restaurant'], ['锅包肉', '漠河餐馆', ['meat', 'pork'], 'restaurant'], ['鱼宴', '漠河江边餐馆', ['seafood'], 'restaurant'],
      ['野生菌', '漠河餐馆', [], 'food'], ['俄式列巴', '漠河县城面包店', [], 'food'], ['冻梨', '北极村小吃铺', [], 'food'], ['羊肉串', '漠河县城夜宵', ['meat'], 'food'], ['大列巴', '漠河伴手礼铺', [], 'food'],
    ],
  },
  温州: {
    center: [120.699, 27.994],
    landmarks: [
      ['江心屿', '鹿城区江心屿', 'attraction'], ['五马街', '鹿城老城', 'activity'], ['南塘文化旅游区', '鹿城南塘', 'attraction'], ['温州博物馆', '瓯海区', 'attraction'], ['雁荡山', '乐清远线', 'attraction'],
      ['楠溪江', '永嘉远线', 'attraction'], ['洞头景区', '洞头远线', 'attraction'], ['朔门街', '鹿城老城', 'activity'], ['墨池公园', '鹿城老城', 'attraction'], ['印象南塘', '鹿城南塘', 'activity'],
    ],
    local: [
      ['五马街早茶', '鹿城老城', 'activity'], ['纱帽河慢走', '鹿城老城', 'activity'], ['南塘夜景', '鹿城南塘', 'activity'], ['温州菜市场逛吃', '鹿城老城', 'activity'], ['洞头海岸慢走', '洞头远线', 'activity'],
      ['江心屿骑行', '江心屿', 'activity'], ['塘河夜游', '鹿城南塘', 'activity'], ['瓯海茶山散步', '瓯海区', 'activity'], ['温州鼓词体验', '鹿城老城', 'activity'], ['朔门街老城摄影', '鹿城老城', 'activity'],
    ],
    foods: [
      ['温州鱼丸', '鹿城老城小吃铺', ['seafood'], 'food'], ['瘦肉丸', '五马街小吃铺', ['meat'], 'food'], ['灯盏糕', '鹿城早市', ['seafood'], 'food'], ['糯米饭', '温州早餐铺', ['meat'], 'food'], ['胶冻', '温州老城小吃铺', ['seafood'], 'food'],
      ['鸭舌', '鹿城熟食铺', ['meat'], 'food'], ['猪脏粉', '温州早餐铺', ['meat', 'pork'], 'food'], ['鱼饼', '温州老城', ['seafood'], 'food'], ['麦饼', '楠溪江沿线', [], 'food'], ['永嘉麦饼', '永嘉老城', ['meat'], 'food'],
    ],
  },
  台州: {
    center: [121.420, 28.656],
    landmarks: [
      ['神仙居', '仙居远线', 'attraction'], ['天台山', '天台远线', 'attraction'], ['国清寺', '天台远线', 'attraction'], ['临海古城', '临海老城', 'attraction'], ['紫阳街', '临海老城', 'activity'],
      ['大陈岛', '椒江海岛远线', 'attraction'], ['蛇蟠岛', '三门远线', 'attraction'], ['台州府城墙', '临海老城', 'attraction'], ['长屿硐天', '温岭远线', 'attraction'], ['石塘渔村', '温岭海岸远线', 'attraction'],
    ],
    local: [
      ['紫阳街早走', '临海老城', 'activity'], ['临海古城墙慢走', '临海老城', 'activity'], ['石塘渔村看海', '温岭海岸远线', 'activity'], ['大陈岛海岸散步', '椒江海岛远线', 'activity'], ['椒江海门老街', '椒江老城', 'activity'],
      ['台州府城夜景', '临海老城', 'activity'], ['天台茶园体验', '天台远线', 'activity'], ['海鲜市场逛早市', '椒江老城', 'activity'], ['临海小吃慢吃', '临海老城', 'activity'], ['黄岩古街散步', '黄岩老城', 'activity'],
    ],
    foods: [
      ['台州糊', '椒江老城早餐铺', ['seafood'], 'food'], ['临海麦虾', '临海老城', ['seafood'], 'food'], ['姜汤面', '台州早餐铺', ['seafood'], 'food'], ['蛋清羊尾', '临海小吃铺', ['dairy'], 'food'], ['食饼筒', '临海老城', ['seafood'], 'food'],
      ['炒米面', '台州老城', ['seafood'], 'food'], ['嵌糕', '温岭小吃铺', ['meat'], 'food'], ['乌饭麻糍', '台州小吃铺', [], 'food'], ['麦饼', '石塘渔村', ['seafood'], 'food'], ['三门青蟹', '三门海鲜馆', ['seafood'], 'restaurant'],
    ],
  },
  丽水: {
    center: [119.922, 28.468],
    landmarks: [
      ['古堰画乡', '莲都区远线', 'attraction'], ['仙都景区', '缙云远线', 'attraction'], ['南尖岩', '遂昌远线', 'attraction'], ['云和梯田', '云和远线', 'attraction'], ['遂昌金矿国家矿山公园', '遂昌远线', 'attraction'],
      ['松阳古村落', '松阳远线', 'attraction'], ['龙泉青瓷小镇', '龙泉远线', 'attraction'], ['丽水市博物馆', '莲都区', 'attraction'], ['白云森林公园', '丽水市区', 'attraction'], ['处州府城', '丽水老城', 'activity'],
    ],
    local: [
      ['松阳老街晨走', '松阳老城', 'activity'], ['古堰画乡写生', '古堰画乡', 'activity'], ['云和梯田看晨雾', '云和远线', 'activity'], ['畲族村寨体验', '景宁远线', 'activity'], ['龙泉青瓷手作', '龙泉青瓷小镇', 'activity'],
      ['遂昌矿山公园慢看', '遂昌远线', 'activity'], ['丽水老城早餐', '丽水老城', 'activity'], ['处州府城夜走', '丽水老城', 'activity'], ['山地咖啡休息', '莲都区', 'activity'], ['摄影采风慢线', '丽水山地', 'activity'],
    ],
    foods: [
      ['缙云烧饼', '缙云老城', ['meat'], 'food'], ['泡精肉', '丽水老城', ['meat'], 'food'], ['黄粿', '丽水小吃铺', [], 'food'], ['仙都土面', '缙云老城', ['meat'], 'food'], ['遂昌烤薯', '遂昌老城', [], 'food'],
      ['麦豆饭', '丽水家常菜馆', [], 'food'], ['竹筒饭', '景宁畲族村', [], 'food'], ['畲族乌米饭', '景宁远线', [], 'food'], ['山粉圆', '丽水老城', ['meat'], 'food'], ['鱼头豆腐', '丽水家常菜馆', ['seafood'], 'restaurant'],
    ],
  },
  乌鲁木齐: {
    center: [87.617, 43.826],
    landmarks: [
      ['新疆维吾尔自治区博物馆', '沙依巴克区', 'attraction'], ['国际大巴扎', '天山区老城', 'attraction'], ['红山公园', '天山区', 'attraction'], ['天山天池', '阜康远线', 'attraction'], ['南山牧场', '南山远线', 'attraction'],
      ['水磨沟公园', '水磨沟区', 'attraction'], ['新疆古生态园', '新市区', 'attraction'], ['新疆美术馆', '沙依巴克区', 'attraction'], ['丝绸之路国际滑雪场', '南山远线', 'attraction'], ['达坂城风力发电', '达坂城远线', 'attraction'],
    ],
    local: [
      ['二道桥巴扎逛吃', '天山区老城', 'activity'], ['和平渠散步', '乌鲁木齐老城', 'activity'], ['北园春市场', '沙依巴克区', 'activity'], ['红山日落', '天山区', 'activity'], ['南山牧场骑马', '南山远线', 'activity'],
      ['新疆歌舞体验', '国际大巴扎', 'activity'], ['夜市慢逛', '乌鲁木齐老城', 'activity'], ['烤馕房看制作', '天山区老城', 'activity'], ['友好商圈夜走', '沙依巴克区', 'activity'], ['果蔬市场逛吃', '乌鲁木齐老城', 'activity'],
    ],
    foods: [
      ['烤羊肉串', '二道桥夜市', ['meat', 'spicy'], 'food'], ['手抓肉', '新疆餐馆', ['meat'], 'restaurant'], ['大盘鸡', '乌鲁木齐老城', ['meat', 'spicy'], 'restaurant'], ['抓饭', '老城清真餐馆', ['meat'], 'restaurant'], ['馕', '二道桥巴扎', [], 'food'],
      ['烤包子', '天山区小吃铺', ['meat'], 'food'], ['酸奶疙瘩', '巴扎甜品铺', ['dairy'], 'food'], ['新疆拌面', '乌鲁木齐社区面馆', ['meat', 'spicy'], 'restaurant'], ['架子肉', '新疆餐馆', ['meat'], 'restaurant'], ['炒米粉', '乌鲁木齐小吃铺', ['spicy', 'meat'], 'food'],
    ],
  },
  喀什: {
    center: [75.990, 39.470],
    landmarks: [
      ['喀什古城', '喀什老城', 'attraction'], ['艾提尕尔清真寺', '喀什老城', 'attraction'], ['香妃园', '喀什东城', 'attraction'], ['喀什东巴扎', '喀什老城', 'activity'], ['高台民居', '喀什老城', 'attraction'],
      ['盘龙古道', '塔县远线', 'attraction'], ['白沙湖', '塔县远线', 'attraction'], ['喀拉库勒湖', '塔县远线', 'attraction'], ['莎车古城', '莎车远线', 'attraction'], ['喀什老城巷道', '喀什老城', 'activity'],
    ],
    local: [
      ['老城巷道晨走', '喀什老城', 'activity'], ['百年茶馆喝茶', '喀什老城', 'activity'], ['东巴扎早市', '喀什老城', 'activity'], ['手工艺街慢逛', '喀什古城', 'activity'], ['喀什夜市', '喀什老城', 'activity'],
      ['牛羊巴扎体验', '喀什近郊', 'activity'], ['木卡姆音乐体验', '喀什老城', 'activity'], ['古城开城仪式', '喀什古城', 'activity'], ['香妃故里慢走', '喀什东城', 'activity'], ['塔县高原自驾线', '塔县远线', 'activity'],
    ],
    foods: [
      ['烤包子', '喀什老城', ['meat'], 'food'], ['缸子肉', '喀什老城餐馆', ['meat'], 'restaurant'], ['鸽子汤', '喀什早餐铺', ['meat'], 'restaurant'], ['手抓饭', '喀什老城餐馆', ['meat'], 'restaurant'], ['烤羊肉', '喀什夜市', ['meat', 'spicy'], 'food'],
      ['新疆拌面', '喀什老城', ['meat', 'spicy'], 'restaurant'], ['馕', '东巴扎', [], 'food'], ['酸奶疙瘩', '喀什巴扎', ['dairy'], 'food'], ['鸽子面', '喀什早餐铺', ['meat'], 'food'], ['喀什酸奶冰淇淋', '喀什古城', ['dairy'], 'food'],
    ],
  },
  拉萨: {
    center: [91.141, 29.646],
    landmarks: [
      ['布达拉宫', '拉萨老城', 'attraction'], ['大昭寺', '八廓街', 'attraction'], ['八廓街', '拉萨老城', 'activity'], ['罗布林卡', '城西片区', 'attraction'], ['西藏博物馆', '城西片区', 'attraction'],
      ['色拉寺', '城北片区', 'attraction'], ['哲蚌寺', '城西北远线', 'attraction'], ['宗角禄康公园', '布达拉宫北侧', 'attraction'], ['纳木错', '纳木错远线', 'attraction'], ['羊卓雍措', '山南远线', 'attraction'],
    ],
    local: [
      ['八廓街转经', '八廓街', 'activity'], ['甜茶馆体验', '八廓街', 'activity'], ['光明港琼茶馆', '拉萨老城', 'activity'], ['拉萨菜市场', '拉萨老城', 'activity'], ['宗角禄康晨练', '布达拉宫北侧', 'activity'],
      ['色拉寺辩经', '城北片区', 'activity'], ['仙足岛散步', '拉萨河沿岸', 'activity'], ['传统手工艺逛店', '八廓街', 'activity'], ['藏戏体验', '拉萨老城', 'activity'], ['牦牛博物馆', '城西片区', 'activity'],
    ],
    foods: [
      ['藏面', '八廓街早餐铺', ['meat'], 'food'], ['甜茶', '光明港琼茶馆', ['dairy'], 'food'], ['酥油茶', '拉萨老城茶馆', ['dairy'], 'food'], ['糌粑', '藏餐馆', ['dairy'], 'food'], ['牦牛肉', '八廓街藏餐馆', ['meat'], 'restaurant'],
      ['藏式土火锅', '拉萨老城', ['meat', 'dairy'], 'restaurant'], ['石锅鸡', '拉萨餐馆', ['meat'], 'restaurant'], ['藏式酸奶', '八廓街甜品铺', ['dairy'], 'food'], ['卡塞', '拉萨小吃铺', ['dairy'], 'food'], ['青稞酒', '拉萨藏餐馆', [], 'food'],
    ],
  },
  林芝: {
    center: [94.362, 29.649],
    landmarks: [
      ['巴松措', '工布江达远线', 'attraction'], ['雅鲁藏布大峡谷', '米林远线', 'attraction'], ['鲁朗林海', '鲁朗远线', 'attraction'], ['南迦巴瓦峰', '派镇远线', 'attraction'], ['尼洋河', '林芝市区', 'attraction'],
      ['林芝桃花沟', '嘎拉村季节线', 'attraction'], ['苯日景区', '林芝近郊', 'attraction'], ['比日神山', '林芝市区', 'attraction'], ['嘎拉桃花村', '林芝近郊', 'attraction'], ['雅尼湿地', '林芝近郊', 'attraction'],
    ],
    local: [
      ['鲁朗石锅体验', '鲁朗远线', 'activity'], ['八一镇夜市', '林芝市区', 'activity'], ['尼洋河晨走', '林芝市区', 'activity'], ['嘎拉村赏花', '嘎拉村季节线', 'activity'], ['林芝农贸市场', '八一镇', 'activity'],
      ['工布藏族村落慢走', '林芝近郊', 'activity'], ['南迦巴瓦看日照金山', '派镇远线', 'activity'], ['桃花节季节体验', '林芝近郊', 'activity'], ['松茸市场逛吃', '八一镇', 'activity'], ['高原咖啡休息', '林芝市区', 'activity'],
    ],
    foods: [
      ['鲁朗石锅鸡', '鲁朗远线', ['meat'], 'restaurant'], ['藏香猪', '林芝餐馆', ['meat', 'pork']], ['松茸', '八一镇餐馆', [], 'food'], ['青稞饼', '林芝小吃铺', [], 'food'], ['酥油茶', '林芝藏餐馆', ['dairy'], 'food'],
      ['林芝烤鱼', '尼洋河沿线', ['seafood'], 'restaurant'], ['蕨麻', '林芝餐馆', [], 'food'], ['牦牛肉', '八一镇藏餐馆', ['meat'], 'restaurant'], ['糌粑', '林芝藏餐馆', ['dairy'], 'food'], ['野生菌汤', '林芝餐馆', [], 'restaurant'],
    ],
  },
}

const offsets: [number, number][] = [[0, 0], [0.004, 0.003], [-0.005, 0.004], [0.006, -0.004], [-0.004, -0.005], [0.008, 0.002], [-0.007, 0.006], [0.003, -0.008], [-0.009, -0.003], [0.01, -0.006]]

function coordinatesFor(center: [number, number], index: number, name: string, area: string): [number, number] {
  const [longitude, latitude] = offsets[index % offsets.length]
  const remote = /远线|景区|雪山|草原|古镇|村|湖|岛|山|沟|县/.test(`${name}${area}`) ? 2.2 : 1
  return [center[0] + longitude * remote, center[1] + latitude * remote]
}

function buildSpecs(city: string, catalog: RegionalCatalog): CityAdditionalSpec[] {
  const places = catalog.landmarks.map(([name, area, category = 'attraction'], index) => ({
    name,
    category,
    area,
    tags: ['核心看点', '经典', category === 'attraction' ? '景点' : '城市漫步'],
    summary: `${name}是${city}${area}值得优先安排的目的地，适合按同一片区连续游览；开放和预约按当天公开信息为准。`,
    coordinates: coordinatesFor(catalog.center, index, name, area),
    durationMinutes: category === 'attraction' ? 150 : 90,
  } satisfies CityAdditionalSpec))
  const local = catalog.local.map(([name, area, category = 'activity'], index) => ({
    name,
    category,
    area,
    tags: ['本地人项目', '本地生活', '片区慢走'],
    summary: `把${name}作为${city}的本地生活节点，重点感受${area}的日常氛围；不要和远距离片区交叉安排。`,
    coordinates: coordinatesFor(catalog.center, index + catalog.landmarks.length, name, area),
    durationMinutes: 90,
  } satisfies CityAdditionalSpec))
  const foods = catalog.foods.map(([name, area, dietaryTags = [], category = 'food'], index) => ({
    name,
    category,
    area,
    tags: category === 'restaurant' ? ['本地美食', '正餐', '片区就近吃'] : ['本地小吃', '本地美食', '随走随吃'],
    dietaryTags,
    summary: `${name}是${city}常见的地方吃法，口味、配料和当天供应以门店菜单为准；有饮食限制时先逐项确认。`,
    coordinates: coordinatesFor(catalog.center, index + catalog.landmarks.length + catalog.local.length, name, area),
    durationMinutes: category === 'restaurant' ? 80 : 35,
  } satisfies CityAdditionalSpec))
  return [...places, ...local, ...foods]
}

export const cityRegionalSpecs: Record<string, CityAdditionalSpec[]> = Object.fromEntries(
  Object.entries(catalogs).map(([city, catalog]) => [city, buildSpecs(city, catalog)]),
)
