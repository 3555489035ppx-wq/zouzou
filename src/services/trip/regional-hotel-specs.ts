import type { CityHotelSpec } from './cityHotelSpecs'

/** Named hotel options for the added city and destination layer. */
export const regionalCityHotelSpecs: Record<string, CityHotelSpec[]> = {
  康定: [
    { name: '康定情歌大酒店', area: '康定老城', tier: 'budget', nightly: { min: 260, max: 480 }, anchorTerms: ['溜溜城', '情歌广场', '将军桥'], summary: '住在老城生活半径内，吃饭、补给和适应高原都更方便。' },
    { name: '嘉利悦途酒店（康定溜溜城店）', area: '溜溜城 / 将军桥', tier: 'comfort', nightly: { min: 380, max: 680 }, anchorTerms: ['溜溜城', '将军桥', '西大街'], summary: '靠近溜溜城和老城餐饮线，适合把康定市区逛吃安排得紧凑。' },
    { name: '康定新都桥大酒店', area: '新都桥镇', tier: 'premium', nightly: { min: 650, max: 1_100 }, anchorTerms: ['新都桥', '塔公草原', '贡嘎雪山'], summary: '适合自驾进山、把新都桥光影和周边观景作为主线的高预算行程。' },
  ],
  稻城亚丁: [
    { name: '稻城亚丁祥云酒店', area: '香格里拉镇', tier: 'budget', nightly: { min: 220, max: 420 }, anchorTerms: ['香格里拉镇', '稻城亚丁景区', '冲古寺'], summary: '靠近景区换乘方向，适合早起进景区并控制住宿成本。' },
    { name: '稻城亚丁明宇豪雅酒店', area: '香格里拉镇', tier: 'comfort', nightly: { min: 420, max: 780 }, anchorTerms: ['香格里拉镇', '稻城亚丁景区', '洛绒牛场'], summary: '适合需要更稳定休息、把长线徒步留出恢复时间的行程。' },
    { name: '稻城亚丁日松贡布酒店', area: '香格里拉镇', tier: 'premium', nightly: { min: 900, max: 1_600 }, anchorTerms: ['香格里拉镇', '亚丁景区', '雪山'], summary: '适合高预算慢旅行，优先保证高原行程中的休息质量。' },
  ],
  九寨沟: [
    { name: '九寨沟千鹤国际大酒店', area: '漳扎镇沟口', tier: 'budget', nightly: { min: 260, max: 480 }, anchorTerms: ['九寨沟景区', '漳扎镇', '沟口'], summary: '靠近沟口和餐饮街，适合早进景区并减少接驳折返。' },
    { name: '九寨沟悦榕庄', area: '甘海子度假区', tier: 'comfort', nightly: { min: 900, max: 1_600 }, anchorTerms: ['九寨沟景区', '甘海子', '中查沟'], summary: '适合重视度假氛围和景区周边休息质量的用户，预算要留足。' },
    { name: '九寨沟鲁能希尔顿度假酒店', area: '甘海子度假区', tier: 'premium', nightly: { min: 1_200, max: 2_200 }, anchorTerms: ['九寨沟景区', '甘海子', '藏羌文化'], summary: '适合高预算度假型行程，把酒店休息与九寨沟景区分日安排。' },
  ],
  大理: [
    { name: '大理古城M酒店', area: '大理古城南门', tier: 'budget', nightly: { min: 260, max: 480 }, anchorTerms: ['大理古城', '南门', '龙龛码头'], summary: '古城南门吃饭和租车方便，适合古城、龙龛和洱海西岸连续安排。' },
    { name: '大理洱海天域英迪格酒店', area: '下关 / 洱海东岸', tier: 'comfort', nightly: { min: 700, max: 1_200 }, anchorTerms: ['洱海', '下关', '生态廊道'], summary: '在城市便利与洱海景观之间取平衡，适合不想天天换住处的用户。' },
    { name: '大理实力希尔顿酒店', area: '洱海东岸 / 下关', tier: 'premium', nightly: { min: 1_000, max: 1_800 }, anchorTerms: ['洱海', '下关', '古城'], summary: '适合高预算慢旅行，古城与洱海两条线需按天分开。' },
  ],
  丽江: [
    { name: '丽江古城英迪格酒店', area: '古城南门', tier: 'budget', nightly: { min: 600, max: 1_000 }, anchorTerms: ['丽江古城', '木府', '忠义市场'], summary: '靠近古城南门和木府，适合古城逛吃和市场早餐。' },
    { name: '丽江和府洲际度假酒店', area: '丽江古城北门', tier: 'comfort', nightly: { min: 900, max: 1_600 }, anchorTerms: ['丽江古城', '黑龙潭', '束河古镇'], summary: '适合希望兼顾古城位置与度假感、且不频繁换酒店的行程。' },
    { name: '丽江金茂璞修雪山酒店', area: '玉龙雪山方向', tier: 'premium', nightly: { min: 1_500, max: 3_000 }, anchorTerms: ['玉龙雪山', '蓝月谷', '白沙古镇'], summary: '适合把雪山、日照金山和酒店休息本身作为高预算主线。' },
  ],
  香格里拉: [
    { name: '香格里拉月光国际大酒店', area: '独克宗古城', tier: 'budget', nightly: { min: 260, max: 480 }, anchorTerms: ['独克宗古城', '龟山公园', '松赞林寺'], summary: '住在古城生活半径内，方便转经、吃饭和适应高原节奏。' },
    { name: '香格里拉大酒店', area: '独克宗古城北侧', tier: 'comfort', nightly: { min: 500, max: 900 }, anchorTerms: ['独克宗古城', '松赞林寺', '纳帕海'], summary: '适合以古城和松赞林寺为主、同时重视房间休息的行程。' },
    { name: '松赞林卡酒店', area: '松赞林寺片区', tier: 'premium', nightly: { min: 1_500, max: 2_800 }, anchorTerms: ['松赞林寺', '纳帕海', '独克宗古城'], summary: '适合高预算慢旅行，把藏地文化和高原休息质量放在一起。' },
  ],
  西双版纳: [
    { name: '告庄西双景智选假日酒店', area: '告庄西双景', tier: 'budget', nightly: { min: 280, max: 520 }, anchorTerms: ['告庄西双景', '星光夜市', '澜沧江'], summary: '靠近夜市和江边，适合把白天景区、晚上逛吃串成一条线。' },
    { name: '西双版纳万达文华度假酒店', area: '景洪度假区', tier: 'comfort', nightly: { min: 700, max: 1_300 }, anchorTerms: ['景洪', '曼听公园', '傣族园'], summary: '适合希望有度假配套、再安排市区和热带植物园一日线的用户。' },
    { name: '西双版纳洲际度假酒店', area: '景洪度假区', tier: 'premium', nightly: { min: 1_100, max: 2_000 }, anchorTerms: ['景洪', '傣族园', '曼听公园'], summary: '适合高预算度假型旅行，远线景区不要和市区行程硬拼。' },
  ],
  腾冲: [
    { name: '腾冲官房大酒店', area: '腾冲老城', tier: 'budget', nightly: { min: 260, max: 480 }, anchorTerms: ['腾冲老城', '国殇墓园', '叠水河瀑布'], summary: '老城生活便利，适合早市、文庙和城市文化线。' },
    { name: '腾冲开臣璞悦酒店', area: '和顺古镇方向', tier: 'comfort', nightly: { min: 500, max: 900 }, anchorTerms: ['和顺古镇', '热海景区', '腾冲老城'], summary: '适合古镇与温泉分日安排，兼顾安静休息和出行便利。' },
    { name: '腾冲世纪金源大饭店', area: '腾冲市区', tier: 'premium', nightly: { min: 700, max: 1_200 }, anchorTerms: ['腾冲老城', '和顺古镇', '热海景区'], summary: '适合高预算行程，市区与远线景区按天分区减少折返。' },
  ],
  沈阳: [
    { name: '汉庭酒店（沈阳中街故宫店）', area: '中街 / 沈河老城', tier: 'budget', nightly: { min: 240, max: 420 }, anchorTerms: ['沈阳故宫', '中街', '张氏帅府'], summary: '住在老城步行范围内，适合故宫、帅府和中街连续安排。' },
    { name: '沈阳中街亚朵酒店', area: '中街 / 沈河老城', tier: 'comfort', nightly: { min: 420, max: 720 }, anchorTerms: ['中街', '沈阳故宫', '张氏帅府'], summary: '适合以沈河老城为主、晚上还要逛吃和回酒店方便的行程。' },
    { name: '沈阳康莱德酒店', area: '青年大街 / 和平区', tier: 'premium', nightly: { min: 1_000, max: 1_800 }, anchorTerms: ['中街', '浑河', '沈阳故宫'], summary: '适合高预算商务与旅行混合行程，老城和浑河需按天分开。' },
  ],
  大连: [
    { name: '大连青泥洼桥智选假日酒店', area: '青泥洼桥 / 中山广场', tier: 'budget', nightly: { min: 320, max: 560 }, anchorTerms: ['中山广场', '青泥洼桥', '俄罗斯风情街'], summary: '城市交通和老城吃饭方便，适合中山广场、东港和老街线。' },
    { name: '大连东港希尔顿酒店', area: '东港商务区', tier: 'comfort', nightly: { min: 700, max: 1_200 }, anchorTerms: ['东港', '中山广场', '滨海路'], summary: '适合把东港晨走、老城和滨海路安排得均衡。' },
    { name: '大连城堡豪华精选酒店', area: '星海广场', tier: 'premium', nightly: { min: 1_300, max: 2_400 }, anchorTerms: ['星海广场', '滨海路', '付家庄'], summary: '适合高预算海岸线旅行，老城景点需要单独计算交通。' },
  ],
  长春: [
    { name: '全季酒店（长春重庆路店）', area: '重庆路 / 宽城区', tier: 'budget', nightly: { min: 220, max: 400 }, anchorTerms: ['重庆路', '伪满皇宫', '中街'], summary: '靠近老城和公共交通，适合伪满皇宫、重庆路和早市线。' },
    { name: '长春香格里拉大酒店', area: '人民广场 / 朝阳区', tier: 'comfort', nightly: { min: 550, max: 900 }, anchorTerms: ['重庆路', '桂林路', '南湖公园'], summary: '适合城市老城、桂林路逛吃与南湖公园的平衡行程。' },
    { name: '长春凯悦酒店', area: '人民大街 / 南关区', tier: 'premium', nightly: { min: 900, max: 1_600 }, anchorTerms: ['人民广场', '南湖公园', '净月潭'], summary: '适合高预算休息优先的行程，净月潭需要单独安排半天。' },
  ],
  延吉: [
    { name: '延吉火车站亚朵酒店', area: '延吉火车站 / 市区', tier: 'budget', nightly: { min: 300, max: 520 }, anchorTerms: ['延边大学', '西市场', '水上市场'], summary: '靠近市区交通和早餐线，适合第一次来延吉的逛吃行程。' },
    { name: '延边宾馆', area: '延吉老城', tier: 'comfort', nightly: { min: 420, max: 700 }, anchorTerms: ['西市场', '延边大学', '布尔哈通河'], summary: '老城位置均衡，方便把西市场、大学城和河岸夜走串起来。' },
    { name: '延吉长白山国际酒店', area: '延吉市区', tier: 'premium', nightly: { min: 650, max: 1_100 }, anchorTerms: ['延吉市区', '帽儿山', '长白山'], summary: '适合高预算或要接长白山远线的行程，跨区交通按当天核算。' },
  ],
  漠河: [
    { name: '漠河金马饭店', area: '漠河县城', tier: 'budget', nightly: { min: 180, max: 360 }, anchorTerms: ['北极星广场', '松苑原始森林', '漠河舞厅'], summary: '县城补给和吃饭方便，适合先休整再进北极村。' },
    { name: '漠河观光国际酒店', area: '漠河县城', tier: 'comfort', nightly: { min: 300, max: 520 }, anchorTerms: ['漠河县城', '北极村', '龙江第一湾'], summary: '适合把县城与找北线路分成两天，减少极寒天气下的赶路。' },
    { name: '北极村北极山庄', area: '北极村', tier: 'premium', nightly: { min: 500, max: 900 }, anchorTerms: ['北极村', '北红村', '乌苏里浅滩'], summary: '适合高预算住进景区附近，方便看晨雾、冰雪和找北地标。' },
  ],
  温州: [
    { name: '温州五马街亚朵酒店', area: '五马街 / 鹿城老城', tier: 'budget', nightly: { min: 360, max: 620 }, anchorTerms: ['五马街', '江心屿', '朔门街'], summary: '靠近老城逛吃和江心屿码头方向，适合短途城市行程。' },
    { name: '温州香格里拉大酒店', area: '滨江商务区', tier: 'comfort', nightly: { min: 700, max: 1_200 }, anchorTerms: ['南塘', '江心屿', '塘河'], summary: '适合把老城、南塘夜景和酒店休息质量做平衡。' },
    { name: '温州喜来登酒店', area: '市中心 / 鹿城', tier: 'premium', nightly: { min: 900, max: 1_600 }, anchorTerms: ['五马街', '南塘', '江心屿'], summary: '适合高预算城市游，雁荡山和洞头远线需另外分日。' },
  ],
  台州: [
    { name: '台州皇冠假日酒店', area: '椒江中心', tier: 'budget', nightly: { min: 380, max: 650 }, anchorTerms: ['椒江', '海门老街', '大陈岛'], summary: '适合椒江城市线和海岛出发，远线景区需要单独规划。' },
    { name: '台州希尔顿酒店', area: '椒江商务区', tier: 'comfort', nightly: { min: 550, max: 900 }, anchorTerms: ['椒江', '海门老街', '临海古城'], summary: '适合把椒江、临海古城和城市餐饮按天分开。' },
    { name: '台州耀达国际酒店', area: '椒江中心', tier: 'premium', nightly: { min: 700, max: 1_200 }, anchorTerms: ['椒江', '大陈岛', '临海古城'], summary: '适合高预算休息优先的浙东南路线，神仙居不与市区硬拼。' },
  ],
  丽水: [
    { name: '丽水万地广场亚朵酒店', area: '莲都区中心', tier: 'budget', nightly: { min: 320, max: 560 }, anchorTerms: ['丽水老城', '处州府城', '古堰画乡'], summary: '市区生活便利，适合老城早餐和古堰画乡出发。' },
    { name: '丽水华侨开元名都大酒店', area: '莲都区中心', tier: 'comfort', nightly: { min: 500, max: 850 }, anchorTerms: ['丽水市区', '古堰画乡', '白云森林公园'], summary: '适合市区文化线与周边山水一日线的平衡行程。' },
    { name: '丽水中都曼哈顿酒店', area: '丽水老城', tier: 'premium', nightly: { min: 650, max: 1_100 }, anchorTerms: ['丽水老城', '处州府城', '仙都景区'], summary: '适合高预算慢旅行，缙云、松阳、云和应按方向分日。' },
  ],
  乌鲁木齐: [
    { name: '乌鲁木齐友好大酒店', area: '友好商圈', tier: 'budget', nightly: { min: 320, max: 560 }, anchorTerms: ['新疆博物馆', '红山公园', '友好商圈'], summary: '市中心吃饭和交通方便，适合先逛博物馆再去巴扎。' },
    { name: '乌鲁木齐南航明珠国际酒店', area: '市中心', tier: 'comfort', nightly: { min: 450, max: 780 }, anchorTerms: ['国际大巴扎', '红山公园', '二道桥'], summary: '适合把老城巴扎、红山日落和本地逛吃排成连续线。' },
    { name: '乌鲁木齐希尔顿酒店', area: '红光山 / 新市区', tier: 'premium', nightly: { min: 900, max: 1_600 }, anchorTerms: ['新疆博物馆', '天山天池', '南山牧场'], summary: '适合高预算或自驾远线，市中心逛吃需要单独留交通时间。' },
  ],
  喀什: [
    { name: '喀什古城亚朵酒店', area: '喀什老城', tier: 'budget', nightly: { min: 320, max: 560 }, anchorTerms: ['喀什古城', '东巴扎', '艾提尕尔清真寺'], summary: '老城吃饭和早晨散步方便，适合第一次来喀什。' },
    { name: '喀什深业丽笙酒店', area: '喀什新城', tier: 'comfort', nightly: { min: 550, max: 900 }, anchorTerms: ['喀什古城', '东巴扎', '喀什新城'], summary: '适合希望房间更舒适、白天老城逛吃、晚上安静休息的用户。' },
    { name: '喀什徕宁国际酒店', area: '喀什市区', tier: 'premium', nightly: { min: 750, max: 1_300 }, anchorTerms: ['喀什古城', '高台民居', '塔县远线'], summary: '适合高预算南疆行程，去塔县和盘龙古道需单独安排整天。' },
  ],
  拉萨: [
    { name: '平措康桑青年旅舍', area: '八廓街 / 拉萨老城', tier: 'budget', nightly: { min: 180, max: 360 }, anchorTerms: ['八廓街', '大昭寺', '甜茶馆'], summary: '老城生活半径小，适合预算有限且想把甜茶馆和转经放进日常的用户。' },
    { name: '拉萨香格里拉大酒店', area: '城西片区', tier: 'comfort', nightly: { min: 650, max: 1_100 }, anchorTerms: ['布达拉宫', '罗布林卡', '西藏博物馆'], summary: '适合重视休息与设施、同时安排老城文化线的行程。' },
    { name: '拉萨瑞吉度假酒店', area: '八廓街东侧', tier: 'premium', nightly: { min: 1_200, max: 2_200 }, anchorTerms: ['八廓街', '大昭寺', '布达拉宫'], summary: '适合高预算慢旅行，把老城步行和高原休息质量放在一起。' },
  ],
  林芝: [
    { name: '林芝恒大酒店', area: '八一镇', tier: 'budget', nightly: { min: 280, max: 500 }, anchorTerms: ['八一镇', '尼洋河', '林芝农贸市场'], summary: '市区补给和吃饭方便，适合抵达日先慢游八一镇。' },
    { name: '林芝喜玛拉雅大酒店', area: '八一镇中心', tier: 'comfort', nightly: { min: 420, max: 760 }, anchorTerms: ['八一镇', '尼洋河', '苯日景区'], summary: '适合市区慢游与近郊景点组合，给高原适应留出缓冲。' },
    { name: '林芝五洲皇冠酒店', area: '八一镇', tier: 'premium', nightly: { min: 650, max: 1_100 }, anchorTerms: ['八一镇', '鲁朗林海', '雅鲁藏布大峡谷'], summary: '适合高预算自驾或包车行程，鲁朗和大峡谷应按方向分日。' },
  ],
}
