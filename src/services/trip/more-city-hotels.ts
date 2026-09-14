import type { CityHotelSpec } from './cityHotelSpecs'

/** Named accommodation candidates for the third city coverage layer. */
export const moreCityHotelSpecs: Record<string, CityHotelSpec[]> = {
  天津: [
    { name: '天津之眼亚朵酒店', area: '海河 / 天津之眼', tier: 'budget', nightly: { min: 320, max: 560 }, anchorTerms: ['天津之眼', '古文化街', '海河'], summary: '靠近海河与天津之眼，适合夜景和老城线。' },
    { name: '天津意式风情区智选假日酒店', area: '意式风情区', tier: 'comfort', nightly: { min: 520, max: 860 }, anchorTerms: ['意式风情区', '解放桥', '海河'], summary: '位于海河东侧片区，串联意风区、解放桥和古文化街较顺。' },
    { name: '天津丽思卡尔顿酒店', area: '和平区 / 海河', tier: 'premium', nightly: { min: 1500, max: 2800 }, anchorTerms: ['五大道', '解放桥', '海河'], summary: '适合重视服务和休息质量、以五大道与海河为主线的住法。' },
  ],
  济南: [
    { name: '济南大明湖亚朵酒店', area: '大明湖 / 老城', tier: 'budget', nightly: { min: 300, max: 520 }, anchorTerms: ['大明湖', '曲水亭街', '趵突泉'], summary: '靠近泉城老城和大明湖，适合把泉水线集中走完。' },
    { name: '济南泉城广场希尔顿欢朋酒店', area: '泉城广场 / 历下', tier: 'comfort', nightly: { min: 450, max: 760 }, anchorTerms: ['趵突泉', '泉城广场', '黑虎泉'], summary: '位于泉城核心片区，去趵突泉、护城河和大明湖都较方便。' },
    { name: '济南绿发贵和洲际酒店', area: '泉城广场 / 历下', tier: 'premium', nightly: { min: 1100, max: 2200 }, anchorTerms: ['泉城广场', '趵突泉', '黑虎泉'], summary: '位于历下区天地坛街3号，原称鲁能贵和洲际；适合泉城广场与老城泉水线。', source: { label: 'IHG：济南绿发贵和洲际酒店', url: 'https://www.ihg.com.cn/intercontinental/hotels/cn/zh/jinan/tnach/hoteldetail', kind: 'official', checkedAt: '2026-09-06' } },
  ],
  福州: [
    { name: '福州三坊七巷亚朵酒店', area: '三坊七巷 / 鼓楼', tier: 'budget', nightly: { min: 320, max: 560 }, anchorTerms: ['三坊七巷', '乌塔', '达明美食街'], summary: '适合把三坊七巷、乌塔和老城早餐放在步行半径内。' },
    { name: '福州世茂洲际酒店', area: '台江 / 茶亭', tier: 'comfort', nightly: { min: 650, max: 980 }, anchorTerms: ['茶亭', '五一广场', '上下杭'], summary: '位于台江区广达路108号，邻近茶亭地铁站；去西湖与福建博物院需另安排交通。', source: { label: 'IHG：福州世茂洲际酒店', url: 'https://www.ihg.com/intercontinental/hotels/cn/zh/fuzhou/focha/hoteldetail', kind: 'official', checkedAt: '2026-09-06' } },
    { name: '福州香格里拉大酒店', area: '鼓楼 / 五一广场', tier: 'premium', nightly: { min: 1000, max: 1800 }, anchorTerms: ['三坊七巷', '上下杭', '鼓楼'], summary: '服务和休息优先，适合连续安排老城与闽江夜景。' },
  ],
  宁波: [
    { name: '宁波天一广场亚朵酒店', area: '天一广场 / 老城', tier: 'budget', nightly: { min: 320, max: 560 }, anchorTerms: ['天一阁', '鼓楼', '月湖公园'], summary: '位于老城核心，适合天一阁、鼓楼和月湖步行串联。' },
    { name: '宁波东钱湖华茂希尔顿酒店', area: '东钱湖 / 联心路', tier: 'comfort', nightly: { min: 700, max: 1100 }, anchorTerms: ['东钱湖', '韩岭'], summary: '位于东钱湖旅游度假区联心路99号，适合湖区住宿；前往老外滩和市中心需单独安排交通。预算区间仅用于方案分档。', source: { label: '希尔顿：宁波东钱湖华茂希尔顿酒店', url: 'https://www.hilton.com/zh-hans/hotels/ngbqahi-hilton-ningbo-dongqian-lake/', kind: 'official', checkedAt: '2026-09-06' } },
    { name: '宁波香格里拉大酒店', area: '三江口', tier: 'premium', nightly: { min: 1000, max: 1900 }, anchorTerms: ['老外滩', '天一广场', '月湖公园'], summary: '适合看重江景和服务、以市中心人文线为主的行程。' },
  ],
  无锡: [
    { name: '无锡南长街亚朵酒店', area: '南长街 / 古运河', tier: 'budget', nightly: { min: 300, max: 520 }, anchorTerms: ['南长街', '清名桥', '东林书院'], summary: '适合把古运河、南长街和老城小吃集中安排。' },
    { name: '无锡太湖饭店', area: '滨湖区 / 太湖', tier: 'comfort', nightly: { min: 650, max: 980 }, anchorTerms: ['鼋头渚', '蠡园', '太湖'], summary: '适合以太湖、鼋头渚和蠡湖为主线，减少市区与湖区往返。' },
    { name: '无锡君来洲际酒店', area: '梁溪区 / 太湖广场', tier: 'premium', nightly: { min: 900, max: 1700 }, anchorTerms: ['南长街', '无锡博物院', '清名桥'], summary: '适合市中心老城与展馆线，兼顾休息品质。' },
  ],
  合肥: [
    { name: '合肥淮河路步行街亚朵酒店', area: '淮河路 / 老城', tier: 'budget', nightly: { min: 280, max: 480 }, anchorTerms: ['淮河路步行街', '李鸿章故居', '逍遥津'], summary: '老城步行方便，适合包公园、故居和淮河路一线。' },
    { name: '合肥栢景朗廷酒店', area: '政务区 / 天鹅湖', tier: 'comfort', nightly: { min: 600, max: 980 }, anchorTerms: ['天鹅湖', '安徽博物院', '大蜀山'], summary: '适合政务区展馆、天鹅湖和大蜀山方向的行程。' },
    { name: '合肥君悦酒店', area: '政务区', tier: 'premium', nightly: { min: 1000, max: 1800 }, anchorTerms: ['安徽博物院', '天鹅湖', '大蜀山'], summary: '服务和休息优先，适合把城市展馆与近郊自然分开安排。' },
  ],
  南昌: [
    { name: '南昌滕王阁亚朵酒店', area: '滕王阁 / 老城', tier: 'budget', nightly: { min: 300, max: 520 }, anchorTerms: ['滕王阁', '万寿宫', '八一起义纪念馆'], summary: '适合赣江老城线，把滕王阁、万寿宫和老城早餐放近些。' },
    { name: '南昌红谷滩万达嘉华酒店', area: '红谷滩 / 赣江', tier: 'comfort', nightly: { min: 520, max: 860 }, anchorTerms: ['秋水广场', '南昌之星', '江西省博物馆'], summary: '更适合红谷滩、赣江夜景和省博物馆一侧的住法。' },
    { name: '南昌喜来登酒店', area: '红谷滩 / 赣江', tier: 'premium', nightly: { min: 850, max: 1500 }, anchorTerms: ['秋水广场', '南昌之星', '滕王阁'], summary: '适合看重江景和服务、想把老城与红谷滩分日游玩的用户。' },
  ],
  郑州: [
    { name: '郑州二七广场亚朵酒店', area: '二七广场 / 老城', tier: 'budget', nightly: { min: 300, max: 520 }, anchorTerms: ['二七纪念塔', '德化街', '人民公园'], summary: '位于市中心老城，适合二七广场、德化街和河南博物院线。' },
    { name: '郑州万达文华酒店', area: '金水区 / CBD', tier: 'comfort', nightly: { min: 650, max: 980 }, anchorTerms: ['河南博物院', '郑东新区CBD', '大玉米'], summary: '适合博物院与郑东新区之间的城市行程。' },
    { name: '郑州绿地JW万豪酒店', area: '郑东新区CBD', tier: 'premium', nightly: { min: 1000, max: 1900 }, anchorTerms: ['大玉米', '郑东新区CBD', '河南博物院'], summary: '适合高预算、重视城市天际线和休息质量的行程。' },
  ],
  洛阳: [
    { name: '洛阳应天门亚朵酒店', area: '隋唐洛阳城 / 老城', tier: 'budget', nightly: { min: 280, max: 500 }, anchorTerms: ['应天门', '洛邑古城', '丽景门'], summary: '适合把应天门、洛邑古城和老城夜逛安排在步行半径内。' },
    { name: '洛阳钼都利豪国际饭店', area: '洛龙区 / 新区', tier: 'comfort', nightly: { min: 420, max: 760 }, anchorTerms: ['洛阳博物馆', '龙门石窟', '隋唐洛阳城'], summary: '适合新区博物馆与龙门石窟方向，住宿更安静。' },
    { name: '洛阳东山宾馆', area: '龙门石窟', tier: 'premium', nightly: { min: 800, max: 1500 }, anchorTerms: ['龙门石窟', '香山寺', '伊河'], summary: '适合以龙门石窟为主、愿意住在景区附近减少早晚往返的用户。' },
  ],
  兰州: [
    { name: '兰州中山桥亚朵酒店', area: '中山桥 / 黄河风情线', tier: 'budget', nightly: { min: 300, max: 520 }, anchorTerms: ['中山桥', '白塔山', '黄河母亲'], summary: '适合黄河风情线和老城逛吃，晚上回酒店方便。' },
    { name: '兰州皇冠假日酒店', area: '安宁区 / 黄河沿线', tier: 'comfort', nightly: { min: 520, max: 900 }, anchorTerms: ['甘肃省博物馆', '黄河风情线', '白塔山'], summary: '适合博物馆、黄河线和城市西侧行程。' },
    { name: '兰州盛达希尔顿酒店', area: '城关区 / 老城', tier: 'premium', nightly: { min: 850, max: 1500 }, anchorTerms: ['张掖路', '正宁路夜市', '中山桥'], summary: '适合高预算老城逛吃与黄河夜景线。' },
  ],
  西宁: [
    { name: '西宁东关清真大寺亚朵酒店', area: '东关 / 老城', tier: 'budget', nightly: { min: 280, max: 500 }, anchorTerms: ['东关清真大寺', '莫家街', '新千夜市'], summary: '适合老城清真文化与夜市线，吃饭和散步都方便。' },
    { name: '西宁富力万达文华酒店', area: '城西区', tier: 'comfort', nightly: { min: 550, max: 900 }, anchorTerms: ['青海省博物馆', '湟水河', '南山公园'], summary: '适合博物馆、滨水线和南山公园的城市行程。' },
    { name: '青海宾馆', area: '城中区 / 老城', tier: 'premium', nightly: { min: 650, max: 1100 }, anchorTerms: ['东关清真大寺', '中心广场', '莫家街'], summary: '适合以老城人文和休息品质为主的高预算行程。' },
  ],
  海口: [
    { name: '海口骑楼老街亚朵酒店', area: '骑楼老街 / 老城', tier: 'budget', nightly: { min: 300, max: 540 }, anchorTerms: ['骑楼老街', '得胜沙市场', '云洞图书馆'], summary: '适合骑楼、老城早餐和海口湾散步，步行体验好。' },
    { name: '海口朗廷酒店', area: '西海岸 / 海口湾', tier: 'comfort', nightly: { min: 700, max: 1200 }, anchorTerms: ['云洞图书馆', '假日海滩', '世纪大桥'], summary: '适合海口湾、西海岸与云洞图书馆一侧。' },
    { name: '海口鲁能希尔顿酒店', area: '西海岸', tier: 'premium', nightly: { min: 900, max: 1700 }, anchorTerms: ['假日海滩', '西秀海滩', '火山口公园'], summary: '适合度假休息优先、把海滩和火山口分日安排的用户。' },
  ],
  珠海: [
    { name: '珠海情侣路亚朵酒店', area: '情侣路 / 香洲', tier: 'budget', nightly: { min: 320, max: 560 }, anchorTerms: ['情侣路', '珠海渔女', '香炉湾'], summary: '适合海岸线、珠海渔女和日月贝夜景。' },
    { name: '珠海华发喜来登酒店', area: '十字门 / 海岸', tier: 'comfort', nightly: { min: 650, max: 1100 }, anchorTerms: ['日月贝', '情侣路', '横琴'], summary: '适合海岸与横琴方向，房间舒适度更优先。' },
    { name: '珠海瑞吉酒店', area: '十字门 / 横琴', tier: 'premium', nightly: { min: 1300, max: 2600 }, anchorTerms: ['日月贝', '横琴', '情侣路'], summary: '适合高预算海岸度假和城市建筑线。' },
  ],
  泉州: [
    { name: '泉州西街亚朵酒店', area: '西街 / 古城', tier: 'budget', nightly: { min: 300, max: 540 }, anchorTerms: ['西街', '开元寺', '中山路'], summary: '古城步行方便，适合开元寺、西街和古城小吃线。' },
    { name: '泉州万达文华酒店', area: '丰泽区 / 东海', tier: 'comfort', nightly: { min: 550, max: 900 }, anchorTerms: ['泉州博物馆', '蟳埔村', '清源山'], summary: '适合东海、蟳埔和清源山方向，空间更宽裕。' },
    { name: '泉州悦华酒店', area: '鲤城区 / 老城', tier: 'premium', nightly: { min: 750, max: 1300 }, anchorTerms: ['开元寺', '西街', '天后宫'], summary: '适合以古城人文为主、重视服务和返程便利的用户。' },
  ],
  银川: [
    { name: '银川鼓楼亚朵酒店', area: '鼓楼 / 兴庆老城', tier: 'budget', nightly: { min: 280, max: 500 }, anchorTerms: ['鼓楼', '南关清真大寺', '怀远夜市'], summary: '适合银川老城、早市和夜市线。' },
    { name: '银川国际交流中心酒店', area: '金凤区 / 阅海', tier: 'comfort', nightly: { min: 480, max: 820 }, anchorTerms: ['宁夏博物馆', '阅海公园', '览山公园'], summary: '适合博物馆、湿地和城市西侧日落线。' },
    { name: '银川喜来登酒店', area: '金凤区', tier: 'premium', nightly: { min: 850, max: 1500 }, anchorTerms: ['宁夏博物馆', '阅海公园', '西夏王陵'], summary: '适合自驾或包车分日走市区与西夏王陵的高预算方案。' },
  ],
  呼和浩特: [
    { name: '呼和浩特大召寺亚朵酒店', area: '大召寺 / 玉泉老城', tier: 'budget', nightly: { min: 280, max: 500 }, anchorTerms: ['大召寺', '塞上老街', '席力图召'], summary: '老城步行方便，适合大召寺、塞上老街和地方早餐。' },
    { name: '呼和浩特香格里拉大酒店', area: '回民区 / 老城', tier: 'comfort', nightly: { min: 600, max: 1000 }, anchorTerms: ['清真大寺', '大召寺', '伊斯兰风情街'], summary: '适合老城人文与回民区逛吃线。' },
    { name: '内蒙古饭店', area: '新城区 / 博物院', tier: 'premium', nightly: { min: 700, max: 1200 }, anchorTerms: ['内蒙古博物院', '大青山', '青城公园'], summary: '适合博物馆、城市公园和北郊自然线。' },
  ],
  太原: [
    { name: '太原柳巷亚朵酒店', area: '柳巷 / 老城', tier: 'budget', nightly: { min: 280, max: 500 }, anchorTerms: ['柳巷', '钟楼街', '食品街'], summary: '适合老城逛吃和钟楼街夜走。' },
    { name: '太原万达文华酒店', area: '杏花岭区', tier: 'comfort', nightly: { min: 560, max: 900 }, anchorTerms: ['山西博物院', '汾河公园', '柳巷'], summary: '适合城市展馆、汾河和老城线的平衡。' },
    { name: '太原洲际酒店', area: '长风商务区', tier: 'premium', nightly: { min: 850, max: 1500 }, anchorTerms: ['山西博物院', '中国煤炭博物馆', '汾河公园'], summary: '适合高预算、重视展馆和休息质量的用户。' },
  ],
  南宁: [
    { name: '南宁三街两巷亚朵酒店', area: '三街两巷 / 老城', tier: 'budget', nightly: { min: 300, max: 540 }, anchorTerms: ['三街两巷', '中山路夜市', '水街'], summary: '适合老城Citywalk、夜市和本地早餐。' },
    { name: '南宁万丽酒店', area: '青秀区 / 民歌湖', tier: 'comfort', nightly: { min: 600, max: 980 }, anchorTerms: ['民歌湖', '南湖公园', '青秀山'], summary: '适合青秀山、南湖和民歌湖一侧的行程。' },
    { name: '南宁香格里拉', area: '青秀区 / 东盟商务区', tier: 'premium', nightly: { min: 1000, max: 1800 }, anchorTerms: ['青秀山', '民歌湖', '南湖公园'], summary: '适合高预算城市度假和青秀区慢行。' },
  ],
  宜昌: [
    { name: '宜昌滨江亚朵酒店', area: '西陵区 / 滨江', tier: 'budget', nightly: { min: 280, max: 500 }, anchorTerms: ['滨江公园', '夷陵广场', '宜昌博物馆'], summary: '适合老城、滨江和夜景线，吃饭与散步方便。' },
    { name: '宜昌万达皇冠假日酒店', area: '伍家岗区', tier: 'comfort', nightly: { min: 480, max: 820 }, anchorTerms: ['葛洲坝', '天然塔', '滨江公园'], summary: '适合城市江景与葛洲坝方向。' },
    { name: '宜昌均瑶禧玥酒店', area: '西陵区 / 长江沿线', tier: 'premium', nightly: { min: 650, max: 1100 }, anchorTerms: ['宜昌博物馆', '滨江公园', '葛洲坝'], summary: '适合重视休息质量、分日去三峡大坝与市区的用户。' },
  ],
  威海: [
    { name: '威海幸福门亚朵酒店', area: '幸福门 / 环翠海滨', tier: 'budget', nightly: { min: 300, max: 540 }, anchorTerms: ['幸福门', '威海公园', '海源公园'], summary: '适合海滨公园、幸福门和老城晨走。' },
    { name: '威海蓝海御华大饭店', area: '环翠区 / 海滨', tier: 'comfort', nightly: { min: 520, max: 900 }, anchorTerms: ['威海公园', '刘公岛', '幸福门'], summary: '适合市区海岸与刘公岛码头线。' },
    { name: '威海抱海大酒店', area: '环翠区 / 海滨', tier: 'premium', nightly: { min: 800, max: 1400 }, anchorTerms: ['幸福门', '威海公园', '火炬八街'], summary: '适合高预算海滨住宿，市区与高区景点分日更顺。' },
  ],
}
