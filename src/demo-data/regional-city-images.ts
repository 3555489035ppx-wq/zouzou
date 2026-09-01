import type { CityImage } from './city-images'

const commonsFile = (title: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}?width=1280`
const ccBy = 'https://creativecommons.org/licenses/by/3.0/'
const ccBySa30 = 'https://creativecommons.org/licenses/by-sa/3.0/'
const ccBySa40 = 'https://creativecommons.org/licenses/by-sa/4.0/'
const cc0 = 'https://creativecommons.org/publicdomain/zero/1.0/deed.en'

/**
 * Free-to-reuse regional covers. Each entry keeps the Commons file page and
 * license beside the image so Discover can show an attributable asset.
 */
export const regionalCityImages: Record<string, CityImage> = {
  康定: {
    src: '/assets/cities/kangding-city.jpg', alt: '康定山城与高原景色', landmark: '康定',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kangding_from_above.jpg', credit: 'NoGhost', license: 'CC BY-SA 4.0', licenseUrl: ccBySa40, downloadUrl: commonsFile('Kangding from above.jpg'),
  },
  稻城亚丁: {
    src: '/assets/cities/daocheng-yading.jpg', alt: '稻城地区高原景色', landmark: '稻城亚丁',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Daocheng,_Garze,_Sichuan,_China_-_panoramio_(3).jpg', credit: '西風', license: 'CC BY 3.0', licenseUrl: ccBy, downloadUrl: commonsFile('Daocheng, Garze, Sichuan, China - panoramio (3).jpg'),
  },
  九寨沟: {
    src: '/assets/cities/jiuzhaigou-valley.jpg', alt: '九寨沟高山湖泊与森林', landmark: '九寨沟风景名胜区',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jiuzhaigou_Sichuan_China_Jiuzhaigou-Valley-02.jpg', credit: 'CEphoto, Uwe Aranas', license: 'CC BY-SA 3.0', licenseUrl: ccBySa30, downloadUrl: commonsFile('Jiuzhaigou Sichuan China Jiuzhaigou-Valley-02.jpg'),
  },
  大理: {
    src: '/assets/cities/dali-yunnan.jpg', alt: '大理古城与苍山一带景色', landmark: '大理古城',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Dali_Yunnan_China_Temple-01.jpg', credit: 'CEphoto, Uwe Aranas', license: 'CC BY-SA 3.0', licenseUrl: ccBySa30, downloadUrl: commonsFile('Dali Yunnan China Temple-01.jpg'),
  },
  丽江: {
    src: '/assets/cities/lijiang-old-town.jpg', alt: '丽江古城夜间街巷', landmark: '丽江古城',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lijiang_Yunnan_China-Evening-atmosphere-in-old-town-Lijiang-01.jpg', credit: 'CEphoto, Uwe Aranas', license: 'CC BY-SA 3.0', licenseUrl: ccBySa30, downloadUrl: commonsFile('Lijiang Yunnan China-Evening-atmosphere-in-old-town-Lijiang-01.jpg'),
  },
  香格里拉: {
    src: '/assets/cities/shangri-la.jpg', alt: '香格里拉高原城镇景色', landmark: '香格里拉',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shangri-La,_Deqen,_Yunnan,_China_-_panoramio_(9).jpg', credit: 'christiali', license: 'CC BY 3.0', licenseUrl: ccBy, downloadUrl: commonsFile('Shangri-La, Deqen, Yunnan, China - panoramio (9).jpg'),
  },
  西双版纳: {
    src: '/assets/cities/jinghong-city.jpg', alt: '西双版纳景洪城市景色', landmark: '景洪',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:City_of_Jinghong,_Yunnan,_China_in_2015.JPG', credit: 'Ericmetro', license: 'CC BY-SA 4.0', licenseUrl: ccBySa40, downloadUrl: commonsFile('City of Jinghong, Yunnan, China in 2015.JPG'),
  },
  腾冲: {
    src: '/assets/cities/tengchong-volcano.jpg', alt: '腾冲火山地貌', landmark: '腾冲火山地热国家地质公园',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tengchong_volcanic_rock_03.jpg', credit: 'STW932', license: 'CC BY-SA 4.0', licenseUrl: ccBySa40, downloadUrl: commonsFile('Tengchong volcanic rock 03.jpg'),
  },
  沈阳: {
    src: '/assets/cities/shenyang-expo.jpg', alt: '沈阳世博园景色', landmark: '沈阳世博园',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shenyang-shiboyuan2.jpg', credit: 'Emmanuel Grolleau', license: 'CC BY-SA 3.0', licenseUrl: ccBySa30, downloadUrl: commonsFile('Shenyang-shiboyuan2.jpg'),
  },
  大连: {
    src: '/assets/cities/dalian-xinghai-bay.jpg', alt: '大连星海湾海岸景色', landmark: '星海广场',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Dalian_Liaoning_China_Two-Chinese-at-Xinghai-Bay-01.jpg', credit: 'CEphoto, Uwe Aranas', license: 'CC BY-SA 3.0', licenseUrl: ccBySa30, downloadUrl: commonsFile('Dalian Liaoning China Two-Chinese-at-Xinghai-Bay-01.jpg'),
  },
  长春: {
    src: '/assets/cities/changchun-cbd.jpg', alt: '长春文化广场与城市天际线', landmark: '长春城市风貌',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Changchun_CBD_viewed_from_the_Cultural_Square,_2024.jpg', credit: 'Licjar Xeymelloz', license: 'CC0', licenseUrl: cc0, downloadUrl: commonsFile('Changchun CBD viewed from the Cultural Square, 2024.jpg'),
  },
  延吉: {
    src: '/assets/cities/yanji-bridge.jpg', alt: '延吉桥梁与城市夜景', landmark: '延吉城市夜景',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Yanji_Bridge_(Nightscape).jpg', credit: 'Theodore Xu', license: 'CC BY-SA 4.0', licenseUrl: ccBySa40, downloadUrl: commonsFile('Yanji Bridge (Nightscape).jpg'),
  },
  漠河: {
    src: '/assets/cities/mohe-north.jpg', alt: '漠河北境森林与河流景色', landmark: '漠河',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:%E6%BC%A0%E6%B2%B3%E6%99%AF%E8%89%B21_Northernmost_China--Mohe_(1798574024).jpg', credit: 'Zzzxxxrrr', license: 'CC BY-SA 4.0', licenseUrl: ccBySa40, downloadUrl: commonsFile('漠河景色1 Northernmost China--Mohe (1798574024).jpg'),
  },
  温州: {
    src: '/assets/cities/wenzhou-city.jpg', alt: '温州城市与山水景色', landmark: '温州城市风貌',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wenzhou-city-in-Zhejiang-China.jpg', credit: 'Benjamii', license: 'CC0', licenseUrl: cc0, downloadUrl: commonsFile('Wenzhou-city-in-Zhejiang-China.jpg'),
  },
  台州: {
    src: '/assets/cities/taizhou-fanfenyuan.jpg', alt: '台州地方小吃粉圆', landmark: '台州本地小吃',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fanfenyuan,_a_kind_of_food_in_Taizhou,_Zhejiang,_China.jpg', credit: 'Rowingbohe', license: 'CC BY-SA 4.0', licenseUrl: ccBySa40, downloadUrl: commonsFile('Fanfenyuan, a kind of food in Taizhou, Zhejiang, China.jpg'),
  },
  丽水: {
    src: '/assets/cities/lishui-lingshan.jpg', alt: '丽水灵山寺与山地景色', landmark: '丽水山水',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lingshan_Temple,_Lishui,_Zhejiang,_China.jpg', credit: 'Huangdan2060', license: 'CC0', licenseUrl: cc0, downloadUrl: commonsFile('Lingshan Temple, Lishui, Zhejiang, China.jpg'),
  },
  乌鲁木齐: {
    src: '/assets/cities/urumqi-city.jpg', alt: '乌鲁木齐城市景色', landmark: '乌鲁木齐城市风貌',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:%E4%B8%AD%E5%9B%BD%E6%96%B0%E7%96%86%E4%B9%8C%E9%B2%81%E6%9C%A8%E9%BD%90%E5%B8%82China_Xinjiang_Urumqi,_China_Xinjiang_Urumqi_-_panoramio.jpg', credit: '罗布泊', license: 'CC BY 3.0', licenseUrl: ccBy, downloadUrl: commonsFile('中国新疆乌鲁木齐市China Xinjiang Urumqi, China Xinjiang Urumqi - panoramio.jpg'),
  },
  喀什: {
    src: '/assets/cities/kashgar-market.jpg', alt: '喀什周日市场生活场景', landmark: '喀什东巴扎',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kashgar_Sunday_Market_(23954726961).jpg', credit: 'Laika ac from UK', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/', downloadUrl: commonsFile('Kashgar Sunday Market (23954726961).jpg'),
  },
  拉萨: {
    src: '/assets/cities/lhasa-barkhor.jpg', alt: '拉萨八廓街转经场景', landmark: '八廓街',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:An_elderly_Tibetan_women_holding_a_prayer_wheel_on_Lhasa,_Barkhor.jpg', credit: 'Luca Galuzzi (Lucag)', license: 'CC BY-SA 2.5', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5/', downloadUrl: commonsFile('An elderly Tibetan women holding a prayer wheel on Lhasa, Barkhor.jpg'),
  },
  林芝: {
    src: '/assets/cities/nyingchi-bayi.jpg', alt: '林芝八一镇与山地景色', landmark: '林芝八一镇',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bayi,_Nyingchi,_Tibet,_China_-_panoramio_(26).jpg', credit: 'ping lin', license: 'CC BY-SA 3.0', licenseUrl: ccBySa30, downloadUrl: commonsFile('Bayi, Nyingchi, Tibet, China - panoramio (26).jpg'),
  },
}
