import { regionalCityImages } from './regional-city-images'
import { cityCoverImages } from './city-cover-images'

export type CityImage = {
  src: string
  alt: string
  landmark: string
  sourceUrl: string
  credit: string
  license: string
  licenseUrl: string | null
  downloadUrl: string
}

/**
 * Real landmark photos used by destination cards and community covers.
 * The files are downloaded from Wikimedia Commons by the image sync script;
 * source and license metadata stays next to the UI mapping for attribution.
 */
export const cityImages: Record<string, CityImage> = {
  上海: {
    src: '/assets/cities/shanghai-bund.jpg',
    alt: '上海外滩江岸与城市天际线',
    landmark: '外滩',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Bund,_Shanghai.jpg',
    credit: 'Jinbo Bu 布锦波',
    license: 'Public domain',
    licenseUrl: null,
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/The_Bund%2C_Shanghai.jpg/1280px-The_Bund%2C_Shanghai.jpg',
  },
  杭州: {
    src: '/assets/cities/hangzhou-west-lake.jpg',
    alt: '杭州西湖湖面与岸边景色',
    landmark: '西湖',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:West_Lake,_Hangzhou.jpg',
    credit: 'Evan Hemingway',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/West_Lake%2C_Hangzhou.jpg/1280px-West_Lake%2C_Hangzhou.jpg',
  },
  苏州: {
    src: '/assets/cities/suzhou-garden.jpg',
    alt: '苏州古典园林亭台与水景',
    landmark: '苏州园林',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Classical_Gardens_of_Suzhou_pavilion,_August_2016.jpg',
    credit: 'Jason Zhang',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Classical_Gardens_of_Suzhou_pavilion%2C_August_2016.jpg/1280px-Classical_Gardens_of_Suzhou_pavilion%2C_August_2016.jpg',
  },
  南京: {
    src: '/assets/cities/nanjing-city-wall.jpg',
    alt: '南京城墙与城市绿地',
    landmark: '南京城墙',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:2024Apr_-_Nanjing_City_Wall_(south_section)_-_img_10.jpg',
    credit: 'Chainwit.',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/2024Apr_-_Nanjing_City_Wall_%28south_section%29_-_img_10.jpg/1280px-2024Apr_-_Nanjing_City_Wall_%28south_section%29_-_img_10.jpg',
  },
  成都: {
    src: '/assets/cities/chengdu-anshun-bridge.jpg',
    alt: '成都安顺廊桥夜景',
    landmark: '安顺廊桥',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Anshun_Bridge_Night.jpg',
    credit: 'Limesave',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Anshun_Bridge_Night.jpg/1280px-Anshun_Bridge_Night.jpg',
  },
  厦门: {
    src: '/assets/cities/xiamen-gulangyu.jpg',
    alt: '从厦门中山路方向眺望鼓浪屿',
    landmark: '鼓浪屿',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gulangyu_Island_from_Zhongshan_Road,_Xiamen.jpg',
    credit: 'Slyronit',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Gulangyu_Island_from_Zhongshan_Road%2C_Xiamen.jpg/1280px-Gulangyu_Island_from_Zhongshan_Road%2C_Xiamen.jpg',
  },
  北京: {
    src: '/assets/cities/beijing-skyline.jpg',
    alt: '北京城市天际线',
    landmark: '北京城市天际线',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Beijing_skyline_(cropped).jpg',
    credit: 'Picrazy2',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Beijing_skyline_%28cropped%29.jpg/1280px-Beijing_skyline_%28cropped%29.jpg',
  },
  广州: {
    src: '/assets/cities/guangzhou-canton-tower.jpg',
    alt: '广州塔与城市夜色',
    landmark: '广州塔',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Canton_Tower_20241027.jpg',
    credit: 'Tim Wu',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Canton_Tower_20241027.jpg/1280px-Canton_Tower_20241027.jpg',
  },
  重庆: {
    src: '/assets/cities/chongqing-hongyadong.jpg',
    alt: '重庆洪崖洞临江建筑夜景',
    landmark: '洪崖洞',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hongya_Cave_31492-Chongqing_(43945415804).jpg',
    credit: 'xiquinhosilva',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Hongya_Cave_31492-Chongqing_%2843945415804%29.jpg/1280px-Hongya_Cave_31492-Chongqing_%2843945415804%29.jpg',
  },
  西安: {
    src: '/assets/cities/xian-city-wall.jpg',
    alt: '西安古城墙与城门',
    landmark: '西安城墙',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Xi-an_city_wall.jpg',
    credit: 'Felix Andrews (Floybix)',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Xi-an_city_wall.jpg/1280px-Xi-an_city_wall.jpg',
  },
  深圳: {
    src: '/assets/cities/shenzhen-skyline.jpg',
    alt: '从南山眺望深圳城市天际线',
    landmark: '深圳湾城市天际线',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shenzhen_Skyline_from_Nanshan.jpg',
    credit: 'Simbaxu',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Shenzhen_Skyline_from_Nanshan.jpg/1280px-Shenzhen_Skyline_from_Nanshan.jpg',
  },
  长沙: {
    src: '/assets/cities/changsha-orange-island.jpg',
    alt: '长沙橘子洲与湘江景色',
    landmark: '橘子洲',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Orange_Isle_2021122601.jpg',
    credit: 'Huangdan2060',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Orange_Isle_2021122601.jpg/1280px-Orange_Isle_2021122601.jpg',
  },
  青岛: {
    src: '/assets/cities/qingdao-zhanqiao.jpg',
    alt: '青岛栈桥与海岸线',
    landmark: '栈桥',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:20240729_Zhanqiao_01.jpg',
    credit: 'Windmemories',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/20240729_Zhanqiao_01.jpg/1280px-20240729_Zhanqiao_01.jpg',
  },
  武汉: {
    src: '/assets/cities/wuhan-yellow-crane-tower.jpg',
    alt: '从黄鹤楼远眺武汉城市景色',
    landmark: '黄鹤楼',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wuhan_from_YellowCraneTower.jpg',
    credit: 'Harald Groven',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Wuhan_from_YellowCraneTower.jpg',
  },
  昆明: {
    src: '/assets/cities/kunming-dianchi.jpg',
    alt: '昆明滇池与西山远景',
    landmark: '滇池',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:20260222_Kunming_Dianchi_Lake,_looking_at_the_West_Mountain_from_the_East_Bank.jpg',
    credit: 'Ngguls',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/20260222_Kunming_Dianchi_Lake%2C_looking_at_the_West_Mountain_from_the_East_Bank.jpg/1280px-20260222_Kunming_Dianchi_Lake%2C_looking_at_the_West_Mountain_from_the_East_Bank.jpg',
  },
  三亚: {
    src: '/assets/locations/sanya-bay-sunrise.jpg',
    alt: '三亚湾沙滩与城市海湾天际线',
    landmark: '三亚湾',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sanya_Bay_-_01.jpg',
    credit: 'Anna Frodesiak',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Sanya_Bay_-_01.jpg',
  },
  桂林: {
    src: '/assets/cities/guilin-scenery.jpg',
    alt: '桂林山水与喀斯特峰林',
    landmark: '桂林山水',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Guilin_Scenery.jpg',
    credit: 'Katie Crutchley',
    license: 'Public domain',
    licenseUrl: null,
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Guilin_Scenery.jpg',
  },
  哈尔滨: {
    src: '/assets/cities/harbin-saint-sophia.jpg',
    alt: '哈尔滨圣索菲亚教堂',
    landmark: '圣索菲亚教堂',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Saint_Sophia_Cathedral,_Harbin_10.jpg',
    credit: '闫恩铭 / Enming Yan',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Saint_Sophia_Cathedral%2C_Harbin_10.jpg/1280px-Saint_Sophia_Cathedral%2C_Harbin_10.jpg',
  },
  贵阳: {
    src: '/assets/cities/guiyang-jiaxiu-pavilion.jpg',
    alt: '贵阳甲秀楼与南明河',
    landmark: '甲秀楼',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jiaxiu_Pavilion,_Guiyang.jpg',
    credit: 'xiquinhosilva',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Jiaxiu_Pavilion%2C_Guiyang.jpg/1280px-Jiaxiu_Pavilion%2C_Guiyang.jpg',
  },
  张家界: {
    src: '/assets/cities/zhangjiajie-tianzishan.jpg',
    alt: '张家界武陵源天子山峰林',
    landmark: '武陵源',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:1_tianzishan_wulingyuan_zhangjiajie_2012.jpg',
    credit: 'chensiyuan',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/1_tianzishan_wulingyuan_zhangjiajie_2012.jpg/1280px-1_tianzishan_wulingyuan_zhangjiajie_2012.jpg',
  },
  ...regionalCityImages,
}

/**
 * Place-level photos keep a route and its discovery cards from reusing one
 * generic city cover. These are real location photos downloaded from Wikimedia
 * Commons; attribution is recorded in the mapping and source manifest.
 */
const shanghaiLocationImages: CityImage[] = [
  {
    src: '/assets/locations/shanghai-wukang-mansion.jpg',
    alt: '上海武康大楼街角实景',
    landmark: '武康大楼',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wukang_Mansion,_Shanghai,_May_2016_01.JPG',
    credit: 'SSYoung',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Wukang_Mansion%2C_Shanghai%2C_May_2016_01.JPG/1280px-Wukang_Mansion%2C_Shanghai%2C_May_2016_01.JPG',
  },
  {
    src: '/assets/locations/shanghai-wukang-road.jpg',
    alt: '上海武康路林荫街景',
    landmark: '武康路',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wukang_Road,_Shanghai,_May_2016.JPG',
    credit: 'SSYoung',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Wukang_Road%2C_Shanghai%2C_May_2016.JPG/1280px-Wukang_Road%2C_Shanghai%2C_May_2016.JPG',
  },
  {
    src: '/assets/locations/shanghai-anfu-road.jpg',
    alt: '上海安福路店铺实景',
    landmark: '安福路',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:A_brunch_spot_at_Anfu_Rd.jpg',
    credit: 'RunningTurtle8964',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/A_brunch_spot_at_Anfu_Rd.jpg/1280px-A_brunch_spot_at_Anfu_Rd.jpg',
  },
  {
    src: '/assets/locations/shanghai-library.jpg',
    alt: '上海图书馆东馆外立面实景',
    landmark: '上海图书馆',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shanghai_Library_East_Hall.jpg',
    credit: 'NMaia',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Shanghai_Library_East_Hall.jpg/1280px-Shanghai_Library_East_Hall.jpg',
  },
  {
    src: '/assets/locations/shanghai-drama-center.jpg',
    alt: '上海话剧艺术中心花园建筑实景',
    landmark: '上海话剧艺术中心',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shanghai_Dramatic_Arts_Center.JPG',
    credit: 'Fayhoo',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Shanghai_Dramatic_Arts_Center.JPG/1280px-Shanghai_Dramatic_Arts_Center.JPG',
  },
]

const sanyaLocationImages: CityImage[] = [
  {
    src: '/assets/locations/sanya-bay-sunrise.jpg',
    alt: '三亚湾沙滩与城市海湾天际线',
    landmark: '三亚湾',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sanya_Bay_-_01.jpg',
    credit: 'Anna Frodesiak',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Sanya_Bay_-_01.jpg',
  },
  {
    src: '/assets/locations/sanya-yalong-bay.jpg',
    alt: '亚龙湾热带海岸与椰林',
    landmark: '亚龙湾',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Strand_in_der_Yalong_Bay_Bucht_in_Sanya_auf_der_Insel_Hainan.jpg',
    credit: 'Kusafiri',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Strand_in_der_Yalong_Bay_Bucht_in_Sanya_auf_der_Insel_Hainan.jpg',
  },
  {
    src: '/assets/locations/sanya-wuzhizhou.jpg',
    alt: '蜈支洲岛海岸与清澈海水',
    landmark: '蜈支洲岛',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wuzhizhou_Island_seaside_scenery.jpg',
    credit: '我乃野云鹤',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/00/Wuzhizhou_Island_seaside_scenery.jpg',
  },
  {
    src: '/assets/locations/sanya-seafood-noodle.jpg',
    alt: '三亚糟粕醋海鲜粉',
    landmark: '糟粕醋海鲜粉',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Zaopocu_seafood_rice_noodle_soup_at_Qiansheng_Hainanfen,_Sanya_(20230326124453).jpg',
    credit: 'N509FZ',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Zaopocu_seafood_rice_noodle_soup_at_Qiansheng_Hainanfen%2C_Sanya_(20230326124453).jpg',
  },
]

const sanyaAdditionalImages: CityImage[] = [
  {
    src: '/assets/locations/sanya-tianya-haijiao.jpg', alt: '天涯海角海岸巨石与海面', landmark: '天涯海角',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tianya_Haijiao_-_01.jpg', credit: 'Anna Frodesiak', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Tianya_Haijiao_-_01.jpg',
  },
  {
    src: '/assets/locations/sanya-phoenix-island.jpg', alt: '凤凰岛与三亚湾海岸线', landmark: '凤凰岛',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Phoenix_Island,_Sanya_Bay_-_01.jpg', credit: 'Anna Frodesiak', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Phoenix_Island%2C_Sanya_Bay_-_01.jpg',
  },
  {
    src: '/assets/locations/sanya-dadonghai.jpg', alt: '大东海沙滩与热带海岸', landmark: '大东海',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Dadonghai_beach_Sanya.jpg', credit: 'Kellykaneshiro', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Dadonghai_beach_Sanya.jpg',
  },
  {
    src: '/assets/locations/sanya-bay-03.jpg', alt: '三亚湾椰林与海湾景色', landmark: '三亚湾椰林',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sanya_Bay_03.jpg', credit: 'Zhangmoon618', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Sanya_Bay_03.jpg',
  },
  {
    src: '/assets/locations/sanya-bay-12.jpg', alt: '三亚湾海边晚霞与城市轮廓', landmark: '三亚湾晚霞',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sanya_Bay_12.JPG', credit: 'Huangdan2060', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Sanya_Bay_12.JPG',
  },
  {
    src: '/assets/locations/sanya-bay-23.jpg', alt: '三亚湾海岸步道与海面', landmark: '三亚湾步道',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sanya_Bay_23.JPG', credit: 'Huangdan2060', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Sanya_Bay_23.JPG',
  },
  {
    src: '/assets/locations/sanya-bay-24.jpg', alt: '三亚湾海岸与远山', landmark: '三亚湾远山',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sanya_Bay_24.JPG', credit: 'Huangdan2060', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Sanya_Bay_24.JPG',
  },
]

const cityImageGalleries: Record<string, CityImage[]> = Object.fromEntries(
  Object.keys(cityImages).map((city) => {
    if (city === '上海') return [city, [...shanghaiLocationImages, ...(cityCoverImages[city] ?? [])]]
    if (city === '三亚') return [city, [...sanyaLocationImages, ...sanyaAdditionalImages]]
    return [city, [cityImages[city], ...(cityCoverImages[city] ?? [])]]
  }),
) as Record<string, CityImage[]>

export function getCityImage(city: string): CityImage {
  return cityImages[city] ?? cityImages['上海']
}

export function getCityImageGallery(city: string): CityImage[] {
  return cityImageGalleries[city] ?? [getCityImage(city)]
}
