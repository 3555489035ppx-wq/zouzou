import { regionalCityHotelSpecs } from './regional-hotel-specs'

export type CityHotelSpec = {
  name: string
  area: string
  tier: 'budget' | 'comfort' | 'premium'
  nightly: { min: number; max: number }
  anchorTerms: string[]
  summary: string
}

/**
 * Named accommodation candidates for the supported cities. Prices are
 * planning ranges per night, not live quotes; the planner still needs to
 * verify the exact date and room type before a trip is executed.
 */
export const cityHotelSpecs: Record<string, CityHotelSpec[]> = {
  上海: [
    { name: '海友酒店（上海静安寺店）', area: '静安寺 / 静安', tier: 'budget', nightly: { min: 320, max: 520 }, anchorTerms: ['静安寺', '武康路', '安福路'], summary: '靠近静安寺片区，适合把武康路、安福路放进行程并控制住宿成本。' },
    { name: '上海外滩雅致酒店', area: '外滩 / 黄浦', tier: 'comfort', nightly: { min: 650, max: 980 }, anchorTerms: ['外滩', '豫园', '南京路步行街'], summary: '把外滩、豫园和老城线放在较近的住宿半径内，位置与舒适度取平衡。' },
    { name: '上海静安香格里拉大酒店', area: '静安 / 南京西路', tier: 'premium', nightly: { min: 1_200, max: 2_200 }, anchorTerms: ['静安寺', '南京西路', '武康路'], summary: '适合更看重服务与休息质量的行程，前往西侧街区和市中心相对顺路。' },
  ],
  杭州: [
    { name: '汉庭酒店（杭州西湖河坊街店）', area: '河坊街 / 上城', tier: 'budget', nightly: { min: 260, max: 420 }, anchorTerms: ['河坊街', '南宋御街', '西湖'], summary: '靠近老城步行线，适合把河坊街、南宋御街和西湖东南线串起来。' },
    { name: '杭州西湖湖滨银泰亚朵酒店', area: '湖滨 / 上城', tier: 'comfort', nightly: { min: 520, max: 820 }, anchorTerms: ['西湖', '湖滨', '河坊街'], summary: '湖滨与老城之间的位置较均衡，适合首次来杭州、希望少换乘的行程。' },
    { name: '西湖国宾馆', area: '西湖西线 / 杨公堤', tier: 'premium', nightly: { min: 1_100, max: 2_000 }, anchorTerms: ['西湖', '杨公堤', '雷峰塔'], summary: '更适合把西湖西线和酒店休息本身作为体验，预算需要给住宿留出空间。' },
  ],
  苏州: [
    { name: '如家商旅酒店（苏州观前街察院场地铁站店）', area: '观前街 / 姑苏', tier: 'budget', nightly: { min: 220, max: 380 }, anchorTerms: ['观前街', '平江路', '拙政园'], summary: '靠近古城交通与步行线，适合园林、平江路和观前街的短途组合。' },
    { name: '苏州书香府邸平江府', area: '平江路 / 姑苏', tier: 'comfort', nightly: { min: 600, max: 950 }, anchorTerms: ['平江路', '拙政园', '苏州博物馆'], summary: '适合想住在古城氛围里、把平江路和园林安排得更松弛的行程。' },
    { name: '苏州洲际酒店', area: '金鸡湖 / 工业园区', tier: 'premium', nightly: { min: 1_000, max: 1_800 }, anchorTerms: ['金鸡湖', '东方之门', '苏州文化艺术中心'], summary: '适合金鸡湖现代城市线与高品质休息优先的用户，古城需要单独安排交通。' },
  ],
  南京: [
    { name: '汉庭酒店（南京张府园店）', area: '新街口 / 秦淮', tier: 'budget', nightly: { min: 240, max: 400 }, anchorTerms: ['夫子庙', '老门东', '新街口'], summary: '位于老城与新街口之间，适合预算有限且希望兼顾秦淮夜景的行程。' },
    { name: '南京夫子庙美居酒店', area: '夫子庙 / 秦淮', tier: 'comfort', nightly: { min: 500, max: 800 }, anchorTerms: ['夫子庙', '秦淮河', '老门东'], summary: '适合把夫子庙、秦淮河和老门东安排成步行夜线，减少晚间折返。' },
    { name: '金陵状元楼大酒店', area: '夫子庙 / 秦淮', tier: 'premium', nightly: { min: 800, max: 1_400 }, anchorTerms: ['夫子庙', '秦淮河', '老门东'], summary: '更适合重视秦淮片区位置与传统城市体验的用户，价格按日期和房型核验。' },
  ],
  成都: [
    { name: '汉庭酒店（成都春熙路店）', area: '春熙路 / 锦江', tier: 'budget', nightly: { min: 260, max: 430 }, anchorTerms: ['春熙路', '太古里', '人民公园'], summary: '靠近市中心公共交通，适合把春熙路、太古里与老城餐饮放在一条线。' },
    { name: '成都太古里春熙美居酒店', area: '春熙路 / 太古里', tier: 'comfort', nightly: { min: 520, max: 850 }, anchorTerms: ['太古里', '春熙路', '九眼桥'], summary: '适合喜欢市中心逛吃与夜生活、又希望住宿舒适度更稳定的行程。' },
    { name: '成都博舍', area: '太古里 / 锦江', tier: 'premium', nightly: { min: 1_400, max: 2_600 }, anchorTerms: ['太古里', '春熙路', '安顺廊桥'], summary: '把酒店设计、太古里与锦江夜景一起纳入体验，适合高预算慢旅行。' },
  ],
  厦门: [
    { name: '厦门鼓浪屿国际青年旅舍', area: '鼓浪屿', tier: 'budget', nightly: { min: 160, max: 320 }, anchorTerms: ['鼓浪屿', '中山路', '沙坡尾'], summary: '适合预算优先且愿意住岛上的用户，轮渡时间和行李搬运要提前算入。' },
    { name: '厦门中山路步行街亚朵酒店', area: '中山路 / 思明', tier: 'comfort', nightly: { min: 480, max: 780 }, anchorTerms: ['中山路', '八市', '鼓浪屿码头'], summary: '靠近老城逛吃与轮渡方向，适合把中山路、八市和沙坡尾串联。' },
    { name: '厦门瑞颐大酒店', area: '鹭江道 / 思明', tier: 'premium', nightly: { min: 900, max: 1_600 }, anchorTerms: ['鼓浪屿', '中山路', '鹭江道'], summary: '适合更看重海湾视野与服务的行程，海边天气和房价按日期核验。' },
  ],
  北京: [
    { name: '桔子酒店（北京天安门店）', area: '王府井 / 东城', tier: 'budget', nightly: { min: 380, max: 620 }, anchorTerms: ['故宫', '王府井', '天安门'], summary: '适合首次进京、以故宫和中轴线为主且需要控制住宿成本的行程。' },
    { name: '东方圣达酒店（北京天安门广场王府井地铁站店）', area: '王府井 / 东城', tier: 'comfort', nightly: { min: 650, max: 1_000 }, anchorTerms: ['故宫', '王府井', '景山公园'], summary: '位于核心老城活动半径内，适合把故宫、景山和王府井安排得更紧凑。' },
    { name: '北京金茂万丽酒店', area: '王府井 / 东城', tier: 'premium', nightly: { min: 1_100, max: 2_000 }, anchorTerms: ['王府井', '故宫', '天安门'], summary: '适合重视服务、房间休息和核心区位置的用户，价格按入住日核验。' },
  ],
  广州: [
    { name: '汉庭酒店（广州北京路步行街店）', area: '北京路 / 越秀', tier: 'budget', nightly: { min: 240, max: 400 }, anchorTerms: ['北京路', '陈家祠', '越秀公园'], summary: '方便老城步行与地铁移动，适合把北京路、陈家祠和西关安排在一起。' },
    { name: '广州北京路步行街亚朵酒店', area: '北京路 / 越秀', tier: 'comfort', nightly: { min: 500, max: 820 }, anchorTerms: ['北京路', '沙面', '永庆坊'], summary: '适合以老城逛吃为主、希望晚上回酒店方便的行程。' },
    { name: '白天鹅宾馆', area: '沙面 / 荔湾', tier: 'premium', nightly: { min: 1_000, max: 1_900 }, anchorTerms: ['沙面', '永庆坊', '珠江'], summary: '适合把沙面、珠江和西关城市体验放进高品质住宿方案。' },
  ],
  重庆: [
    { name: '布丁酒店（重庆解放碑洪崖洞步行街店）', area: '解放碑 / 渝中', tier: 'budget', nightly: { min: 180, max: 360 }, anchorTerms: ['解放碑', '洪崖洞', '山城步道'], summary: '靠近核心夜景与步行线，适合预算优先但接受老城地形和房间差异的用户。' },
    { name: '重庆解放碑八一广场亚朵酒店', area: '解放碑 / 渝中', tier: 'comfort', nightly: { min: 480, max: 780 }, anchorTerms: ['解放碑', '洪崖洞', '长江索道'], summary: '适合把解放碑、洪崖洞和山城步道作为主线，减少晚间打车。' },
    { name: '重庆来福士洲际酒店', area: '朝天门 / 渝中', tier: 'premium', nightly: { min: 1_100, max: 2_000 }, anchorTerms: ['朝天门', '来福士', '洪崖洞'], summary: '适合重视两江景观和酒店休息质量的用户，山城移动仍要留足缓冲。' },
  ],
  西安: [
    { name: '汉庭酒店（西安钟楼店）', area: '钟楼 / 莲湖', tier: 'budget', nightly: { min: 220, max: 380 }, anchorTerms: ['钟楼', '回民街', '西安城墙'], summary: '适合以钟楼、回民街和城墙为主的老城短途行程，交通半径较集中。' },
    { name: '西安钟楼饭店', area: '钟楼 / 东新街', tier: 'comfort', nightly: { min: 420, max: 700 }, anchorTerms: ['钟楼', '西安城墙', '回民街'], summary: '适合首次到西安、希望住在老城核心并兼顾夜间逛吃的用户。' },
    { name: '西安君悦酒店', area: '曲江 / 雁塔', tier: 'premium', nightly: { min: 900, max: 1_600 }, anchorTerms: ['大雁塔', '大唐不夜城', '陕西历史博物馆'], summary: '适合把曲江文化线与高品质休息作为重点，钟楼方向需要单独核算交通。' },
  ],
  深圳: [
    { name: '全季酒店（深圳罗湖东门店）', area: '东门 / 罗湖', tier: 'budget', nightly: { min: 300, max: 520 }, anchorTerms: ['东门老街', '深圳博物馆', '罗湖'], summary: '适合预算优先、以老城和地铁移动为主的城市短途行程。' },
    { name: '深圳南山科技园希尔顿欢朋酒店', area: '南山科技园', tier: 'comfort', nightly: { min: 520, max: 850 }, anchorTerms: ['华侨城', '深圳湾公园', '世界之窗'], summary: '适合把华侨城、深圳湾和科技园方向放在同一住宿半径内。' },
    { name: '深圳湾安达仕酒店', area: '深圳湾 / 南山', tier: 'premium', nightly: { min: 1_200, max: 2_200 }, anchorTerms: ['深圳湾公园', '人才公园', '华侨城'], summary: '适合重视设计、服务和深圳湾景观的慢旅行，远郊景点需另留交通时间。' },
  ],
  长沙: [
    { name: '长沙五一广场智选假日酒店', area: '五一广场 / 芙蓉', tier: 'budget', nightly: { min: 280, max: 460 }, anchorTerms: ['五一广场', '太平街', '坡子街'], summary: '靠近老城逛吃和地铁，适合把五一广场、太平街安排成晚间主线。' },
    { name: '长沙IFS国金中心亚朵酒店', area: 'IFS / 芙蓉', tier: 'comfort', nightly: { min: 520, max: 850 }, anchorTerms: ['IFS国金中心', '五一广场', '黄兴路步行街'], summary: '适合希望住在老城核心、兼顾夜逛与舒适度的行程。' },
    { name: '长沙尼依格罗酒店', area: 'IFS / 芙蓉', tier: 'premium', nightly: { min: 1_000, max: 1_800 }, anchorTerms: ['IFS国金中心', '五一广场', '湘江'], summary: '适合把城市夜景、服务与休息质量放在高优先级的用户。' },
  ],
  青岛: [
    { name: '青岛栈桥火车站亚朵酒店', area: '栈桥 / 市南', tier: 'budget', nightly: { min: 300, max: 520 }, anchorTerms: ['栈桥', '中山路', '八大关'], summary: '适合老城步行和火车站进出，方便串联栈桥、中山路与八大关。' },
    { name: '青岛海景花园大酒店', area: '香港中路 / 市南', tier: 'comfort', nightly: { min: 600, max: 950 }, anchorTerms: ['五四广场', '奥帆中心', '小麦岛'], summary: '适合希望兼顾海边景观、服务和市南区移动的用户。' },
    { name: '青岛涵碧楼酒店', area: '奥帆中心 / 市南', tier: 'premium', nightly: { min: 1_200, max: 2_200 }, anchorTerms: ['奥帆中心', '五四广场', '小麦岛'], summary: '适合高预算滨海慢旅行，老城景点与海边线需要按路线分日。' },
  ],
  武汉: [
    { name: '汉庭酒店（武汉江汉路步行街店）', area: '江汉路 / 江岸', tier: 'budget', nightly: { min: 240, max: 400 }, anchorTerms: ['江汉路', '汉口江滩', '黎黄陂路'], summary: '适合预算优先、以汉口老城和夜逛为主的行程，公共交通较方便。' },
    { name: '武汉江汉路亚朵酒店', area: '江汉路 / 江岸', tier: 'comfort', nightly: { min: 480, max: 780 }, anchorTerms: ['江汉路', '汉口江滩', '黄鹤楼'], summary: '适合把汉口夜景与武昌景点分日安排、减少住宿搬动的用户。' },
    { name: '武汉万达瑞华酒店', area: '东湖 / 武昌', tier: 'premium', nightly: { min: 900, max: 1_600 }, anchorTerms: ['东湖', '湖北省博物馆', '武汉大学'], summary: '适合把东湖、湖北省博物馆和武昌文化线作为住宿附近主线。' },
  ],
  昆明: [
    { name: '汉庭酒店（昆明翠湖店）', area: '翠湖 / 五华', tier: 'budget', nightly: { min: 220, max: 380 }, anchorTerms: ['翠湖公园', '云南省博物馆', '文林街'], summary: '适合以翠湖、文林街和老城步行线为主的低预算行程。' },
    { name: '昆明中心皇冠假日酒店', area: '南屏街 / 五华', tier: 'comfort', nightly: { min: 500, max: 820 }, anchorTerms: ['昆明老街', '南屏街', '翠湖公园'], summary: '适合首次到昆明、希望住在老城与市中心交通之间的用户。' },
    { name: '昆明索菲特大酒店', area: '南屏街 / 五华', tier: 'premium', nightly: { min: 850, max: 1_500 }, anchorTerms: ['昆明老街', '滇池', '金马碧鸡坊'], summary: '适合重视休息和服务的用户，滇池、西山等方向需要单独安排交通。' },
  ],
  三亚: [
    { name: '三亚大东海酒店', area: '大东海 / 吉阳', tier: 'budget', nightly: { min: 280, max: 520 }, anchorTerms: ['大东海', '鹿回头', '第一市场'], summary: '适合预算优先、想把大东海和市区逛吃放在附近的用户。' },
    { name: '三亚湾红树林度假世界', area: '三亚湾', tier: 'comfort', nightly: { min: 600, max: 1_000 }, anchorTerms: ['三亚湾', '椰梦长廊', '天涯海角'], summary: '适合希望兼顾度假设施与三亚湾日落线的行程，房型差异需核验。' },
    { name: '三亚亚特兰蒂斯', area: '海棠湾', tier: 'premium', nightly: { min: 1_300, max: 2_600 }, anchorTerms: ['海棠湾', '蜈支洲岛', '免税城'], summary: '适合把海棠湾度假与水上体验作为重点，前往市区景点需要留足车程。' },
  ],
  桂林: [
    { name: '桂林象山公园亚朵酒店', area: '象山 / 两江四湖', tier: 'budget', nightly: { min: 260, max: 440 }, anchorTerms: ['象鼻山', '两江四湖', '东西巷'], summary: '适合市区短途和预算优先，方便把象鼻山、两江四湖安排成半日线。' },
    { name: '桂林漓江大瀑布饭店', area: '正阳路 / 两江四湖', tier: 'comfort', nightly: { min: 500, max: 850 }, anchorTerms: ['两江四湖', '东西巷', '象鼻山'], summary: '适合住在市区水岸与老城之间，方便晚间散步和市区餐饮。' },
    { name: '桂林香格里拉大酒店', area: '叠彩区 / 漓江北岸', tier: 'premium', nightly: { min: 900, max: 1_600 }, anchorTerms: ['漓江', '独秀峰', '两江四湖'], summary: '适合重视酒店空间与休息质量的用户，阳朔和龙脊仍需按天规划。' },
  ],
  哈尔滨: [
    { name: '哈尔滨中央大街亚朵酒店', area: '中央大街 / 道里', tier: 'budget', nightly: { min: 280, max: 500 }, anchorTerms: ['中央大街', '圣索菲亚教堂', '松花江'], summary: '适合把中央大街、圣索菲亚教堂和松花江老城线安排在步行半径内。' },
    { name: '哈尔滨中央大街希尔顿欢朋酒店', area: '中央大街 / 道里', tier: 'comfort', nightly: { min: 500, max: 800 }, anchorTerms: ['中央大街', '圣索菲亚教堂', '红专街早市'], summary: '适合希望住在老城、兼顾早餐早市和夜间散步的用户。' },
    { name: '哈尔滨富力丽思卡尔顿酒店', area: '松北 / 江北', tier: 'premium', nightly: { min: 1_100, max: 2_000 }, anchorTerms: ['松花江', '太阳岛', '冰雪大世界'], summary: '适合冰雪季重视江景、服务和休息质量的行程，市中心需核算往返。' },
  ],
  贵阳: [
    { name: '贵阳喷水池中华北路亚朵酒店', area: '喷水池 / 云岩', tier: 'budget', nightly: { min: 260, max: 440 }, anchorTerms: ['喷水池', '甲秀楼', '青云市集'], summary: '适合把老城夜逛、甲秀楼和市区餐饮安排在较近的住宿半径内。' },
    { name: '贵阳亨特索菲特酒店', area: '南明 / 甲秀楼', tier: 'comfort', nightly: { min: 600, max: 950 }, anchorTerms: ['甲秀楼', '青云市集', '南明河'], summary: '适合重视老城位置与舒适度、希望晚上少折返的用户。' },
    { name: '贵阳万丽酒店', area: '观山湖区', tier: 'premium', nightly: { min: 850, max: 1_500 }, anchorTerms: ['贵州省博物馆', '观山湖公园', '金融城'], summary: '适合把观山湖文化与城市新区作为主线的高品质方案，老城需单独安排。' },
  ],
  张家界: [
    { name: '张家界国家森林公园标志门亚朵酒店', area: '武陵源标志门', tier: 'budget', nightly: { min: 260, max: 460 }, anchorTerms: ['武陵源', '金鞭溪', '十里画廊'], summary: '适合把武陵源大景区作为主线、减少景区门口往返的预算方案。' },
    { name: '张家界大成山水国际大酒店', area: '武陵源 / 标志门', tier: 'comfort', nightly: { min: 480, max: 800 }, anchorTerms: ['武陵源', '袁家界', '金鞭溪'], summary: '适合连续游玩武陵源、希望回酒店休息方便的行程。' },
    { name: '张家界京武铂尔曼酒店', area: '武陵源 / 标志门', tier: 'premium', nightly: { min: 800, max: 1_400 }, anchorTerms: ['武陵源', '天子山', '十里画廊'], summary: '适合高预算山景行程，天门山与武陵源应分日安排并核算交通。' },
  ],
  ...regionalCityHotelSpecs,
}
