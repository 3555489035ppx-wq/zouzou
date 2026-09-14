import type { CityImage } from './city-images'

const commonsPage = (title: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}`
const commonsFile = (title: string) => `https://upload.wikimedia.org/wikipedia/commons/${title}`
const foodSearchPage = (city: string, landmark: string) =>
  `https://image.baidu.com/search/index?word=${encodeURIComponent(`${city} ${landmark} 菜品实物 无人物`)}`

const commonsLandmark = (args: {
  src: string
  alt: string
  landmark: string
  title: string
  downloadPath: string
  credit: string
  license: string
  licenseUrl: string
}): CityImage => ({
  src: args.src,
  alt: args.alt,
  landmark: args.landmark,
  kind: 'landmark',
  routeEligible: true,
  sourceUrl: commonsPage(args.title),
  credit: args.credit,
  license: args.license,
  licenseUrl: args.licenseUrl,
  downloadUrl: commonsFile(args.downloadPath),
})

const curatedCommonsRoute = (args: {
  src: string
  alt: string
  landmark: string
  title: string
}): CityImage => ({
  src: args.src,
  alt: args.alt,
  landmark: args.landmark,
  kind: 'landmark',
  routeEligible: true,
  sourceUrl: commonsPage(args.title),
  credit: 'Wikimedia Commons 来源页',
  license: '以来源页标注为准',
  licenseUrl: 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia',
  downloadUrl: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(args.title)}?width=1600`,
})

const foodCandidate = (args: {
  src: string
  city: string
  landmark: string
  alt: string
  originalUrl?: string
}): CityImage => ({
  src: args.src,
  alt: args.alt,
  landmark: args.landmark,
  kind: 'food',
  routeEligible: true,
  sourceUrl: foodSearchPage(args.city, args.landmark),
  credit: '图片检索候选 · 原始来源与授权记录留在后台',
  license: '使用前按后台授权记录核对',
  licenseUrl: null,
  downloadUrl: args.originalUrl ?? foodSearchPage(args.city, args.landmark),
})

/**
 * A small, manually reviewed override pool for routes that previously had no
 * valid anchor image. Unlike the city gallery derivatives, these entries are
 * tied to a real first stop and are eligible for a user-facing cover.
 */
export const verifiedPlaceImages: Record<string, CityImage[]> = {
  武汉: [
    {
      src: '/assets/journey-images/wikimedia/wuhan-east-lake-lingbo.jpg',
      alt: '武汉东湖湖面与绿岸实景，不含人物',
      landmark: '东湖凌波门',
      kind: 'landmark',
      routeEligible: true,
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:%E6%9E%AB%E5%A4%9A%E5%B1%B1%2020240330.jpg',
      credit: 'Uuongkinghe',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/%E6%9E%AB%E5%A4%9A%E5%B1%B1_20240330.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original',
    },
  ],
  天津: [
    {
      ...commonsLandmark({
        src: '/assets/journey-images/wikimedia/tianjin-goubuli.jpg',
        alt: '天津包子食物本体与蒸笼实拍',
        landmark: '天津包子',
        title: 'Tianjin lunch of Goubuli.jpg',
        downloadPath: '2/25/Tianjin_lunch_of_Goubuli.jpg',
        credit: '~MVI~',
        license: 'CC BY 2.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
      }),
      kind: 'food',
    },
    curatedCommonsRoute({
      src: '/assets/cities/tianjin-route-01.jpg',
      alt: '天津之眼与海河夜景实景，不含人物',
      landmark: '天津之眼',
      title: '炫彩津门11Tianjin Eye and Haihe River.jpg',
    }),
  ],
  济南: [
    curatedCommonsRoute({
      src: '/assets/cities/jinan-route-01.jpg',
      alt: '济南趵突泉泉池与园林实景，不含人物',
      landmark: '趵突泉',
      title: 'China Jinan Baotu Spring 5196935.jpg',
    }),
  ],
  长沙: [
    {
      ...commonsLandmark({
      src: '/assets/journey-images/wikimedia/changsha-pearl-milk-tea.jpg',
      alt: '长沙茶颜悦色饮品本体实拍，不含人物',
      landmark: '茶颜悦色',
      title: 'Pearl Milk Tea in Chun Shui Tang.jpg',
      downloadPath: '5/53/Pearl_Milk_Tea_in_Chun_Shui_Tang.jpg',
      credit: 'Battlesnake1',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
      }),
      kind: 'food',
    },
  ],
  合肥: [
    commonsLandmark({
      src: '/assets/journey-images/wikimedia/hefei-baogong.jpg',
      alt: '合肥包公园湖面、园林与古建筑实景',
      landmark: '包公园',
      title: 'HeFei Baogong Park.jpg',
      downloadPath: '7/79/HeFei_Baogong_Park.jpg',
      credit: '钉钉',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    }),
    {
      src: '/assets/journey-images/wikimedia/hefei-baogong-fuzhuang-clean.jpg',
      alt: '合肥包公园浮庄水岸与园林实景，不含人物',
      landmark: '包公园',
      kind: 'landmark',
      routeEligible: true,
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:%E5%8C%85%E6%B2%B3%E5%85%AC%E5%9B%AD%20%E6%B5%AE%E5%BA%84%20Fu%20Zhuang%2C%20Bao%20He%20Gong%20Yuan%20-%20panoramio.jpg',
      credit: 'wanghongliu',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/%E5%8C%85%E6%B2%B3%E5%85%AC%E5%9B%AD_%E6%B5%AE%E5%BA%84_Fu_Zhuang%2C_Bao_He_Gong_Yuan_-_panoramio.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original',
    },
    foodCandidate({
      src: '/assets/journey-images/baidu/baidu-2a0d9c2d-8.webp',
      city: '合肥',
      landmark: '三河米饺',
      alt: '合肥三河米饺食物本体实拍，不含人物',
    }),
    foodCandidate({
      src: '/assets/journey-images/baidu/baidu-e2549bfc-11.jpg',
      city: '合肥',
      landmark: '三河米饺',
      alt: '合肥三河米饺食物本体实拍，不含人物',
    }),
  ],
  郑州: [
    commonsLandmark({
      src: '/assets/journey-images/wikimedia/zhengzhou-zhongyuan-tower.jpg',
      alt: '郑州中原福塔蓝天实景',
      landmark: '中原福塔观景',
      title: '20210708 Zhongyuan Tower.jpg',
      downloadPath: '7/7e/20210708_Zhongyuan_Tower.jpg',
      credit: 'Windmemories',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    }),
  ],
  广州: [
    {
      src: '/assets/journey-images/wikimedia/guangzhou-shamian-clean.jpg',
      alt: '广州沙面岛黄色综合欧陆建筑与林荫街道实景，不含人物',
      landmark: '沙面岛',
      kind: 'landmark',
      routeEligible: true,
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shamian_Island%2C_Guangzhou_%285928583279%29.jpg',
      credit: 'Eduardo M. C.',
      license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Shamian_Island%2C_Guangzhou_%285928583279%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original',
    },
    {
      src: '/assets/journey-images/wikimedia/guangzhou-shamian-clean-02.jpg',
      alt: '广州沙面岛林荫花园与欧陆建筑实景，不含人物',
      landmark: '沙面岛',
      kind: 'landmark',
      routeEligible: true,
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shamian_Island%2C_Guangzhou_%285928584895%29.jpg',
      credit: 'Eduardo M. C.',
      license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Shamian_Island%2C_Guangzhou_%285928584895%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original',
    },
  ],
  珠海: [
    commonsLandmark({
      src: '/assets/journey-images/wikimedia/zhuhai-xianglu-bay.jpg',
      alt: '珠海情侣路沿线香炉湾与海岸线实景',
      landmark: '情侣路',
      title: 'Xianglu Bay in Zhuhai.jpg',
      downloadPath: 'f/f9/Xianglu_Bay_in_Zhuhai.jpg',
      credit: 'Shasha Zhuhai',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    }),
    commonsLandmark({
      src: '/assets/journey-images/wikimedia/zhuhai-grand-theatre.jpg',
      alt: '珠海情侣路沿线日月贝与海湾实景',
      landmark: '情侣路',
      title: 'Zhuhai Grand Theatre.jpg',
      downloadPath: '2/25/Zhuhai_Grand_Theatre.jpg',
      credit: '钉钉',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    }),
    curatedCommonsRoute({
      src: '/assets/cities/zhuhai-route-01.jpg',
      alt: '珠海情侣路沿线日月贝与海湾实景，不含人物',
      landmark: '情侣路',
      title: 'Zhuhai Grand Theatre.jpg',
    }),
  ],
  洛阳: [
    curatedCommonsRoute({
      src: '/assets/cities/luoyang-route-01.jpg',
      alt: '洛阳龙门石窟山崖造像实景，不含人物',
      landmark: '龙门石窟',
      title: 'Longmen Grottoes, Luoyang, Henan.jpg',
    }),
  ],
  西宁: [
    curatedCommonsRoute({
      src: '/assets/cities/xining-route-01.jpg',
      alt: '西宁东关清真大寺建筑实景，不含人物',
      landmark: '东关清真大寺',
      title: 'Dongguan mosque Xining.jpg',
    }),
  ],
  泉州: [
    curatedCommonsRoute({
      src: '/assets/cities/quanzhou-route-01.jpg',
      alt: '泉州开元寺古建筑院落实景，不含人物',
      landmark: '泉州开元寺',
      title: 'The courtyard of Quanzhou Kaiyuan Temple 20170727.jpg',
    }),
  ],
  银川: [
    curatedCommonsRoute({
      src: '/assets/cities/yinchuan-route-02.jpg',
      alt: '银川鼓楼城市地标实景，不含人物',
      landmark: '银川鼓楼',
      title: 'YichuanDrumTower.jpg',
    }),
    foodCandidate({
      src: '/assets/journey-images/wikimedia/yinchuan-hand-lamb.jpg',
      city: '银川',
      landmark: '手抓羊肉',
      alt: '银川手抓羊肉食物本体实拍，不含人物',
      originalUrl: 'https://gips2.baidu.com/it/u=3230139636,1843728189&fm=3074&app=3074&f=JPEG',
    }),
  ],
  南宁: [
    curatedCommonsRoute({
      src: '/assets/cities/nanning-route-01.jpg',
      alt: '南宁青秀山与城市天际线实景，不含人物',
      landmark: '青秀山风景区',
      title: 'Nanning seen from Qingxiu Mountain.jpg',
    }),
  ],
  宜昌: [
    curatedCommonsRoute({
      src: '/assets/cities/yichang-route-02.jpg',
      alt: '宜昌三峡大坝坝体与山水实景，不含人物',
      landmark: '三峡大坝旅游区',
      title: 'Three Gorges Dam.jpg',
    }),
  ],
  沈阳: [
    {
      src: '/assets/journey-images/wikimedia/shenyang-dazheng-hall.jpg',
      alt: '沈阳故宫大政殿彩绘斗拱细节实景，不含人物',
      landmark: '沈阳故宫',
      kind: 'landmark',
      routeEligible: true,
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:%E6%B2%88%E6%B2%B3%20%E6%B2%88%E9%98%B3%E6%95%85%E5%AE%AB%E4%B9%8B%E5%A4%A7%E6%94%BF%E6%AE%BF%2001.jpg',
      credit: 'Liuxingy',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/%E6%B2%88%E6%B2%B3_%E6%B2%88%E9%98%B3%E6%95%85%E5%AE%AB%E4%B9%8B%E5%A4%A7%E6%94%BF%E6%AE%BF_01.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original',
    },
  ],
  哈尔滨: [
    curatedCommonsRoute({
      src: '/assets/journey-images/wikimedia/harbin-sophia-clean.jpg',
      alt: '哈尔滨圣索菲亚教堂红砖穹顶实景，不含人物',
      landmark: '圣索菲亚教堂',
      title: 'Saint Sophia Cathedral, Harbin 06.01.2026.jpg',
    }),
  ],
  苏州: [
    commonsLandmark({
      src: '/assets/journey-images/wikimedia/suzhou-yipu.jpg',
      alt: '苏州艺圃园林古建筑与庭院实景，不含人物',
      landmark: '艺圃',
      title: 'Yipu Garden 02 20250611.jpg',
      downloadPath: '5/58/Yipu_Garden_02_20250611.jpg',
      credit: '阿道',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    }),
  ],
  长春: [
    {
      src: '/assets/journey-images/wikimedia/changchun-sticky-bean-buns.jpg',
      alt: '东北粘豆包食物本体实拍，不含人物',
      landmark: '樱花小吃｜粘豆包',
      kind: 'food',
      routeEligible: true,
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sticky_bean_buns_(1).jpg',
      credit: 'Fumikas Sagisavas',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
      downloadUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sticky_bean_buns_(1).jpg?width=1600',
    },
  ],
  呼和浩特: [
    commonsLandmark({
      src: '/assets/journey-images/wikimedia/hohhot-dazhao-alt.jpg',
      alt: '呼和浩特大召寺大雄宝殿建筑实景，不含人物',
      landmark: '大召寺',
      title: '大召大雄宝殿.jpg',
      downloadPath: '6/6d/大召大雄宝殿.jpg',
      credit: '三猎',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    }),
    commonsLandmark({
      src: '/assets/journey-images/wikimedia/hohhot-tongshun-street.jpg',
      alt: '呼和浩特塞上老街牌坊与老城建筑实景，不含人物',
      landmark: '通顺大巷慢走',
      title: '呼和浩特塞上老街牌坊（2025蛇年装饰）.jpg',
      downloadPath: '7/7f/呼和浩特塞上老街牌坊（2025蛇年装饰）.jpg',
      credit: 'HCCB3947',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    }),
    commonsLandmark({
      src: '/assets/journey-images/wikimedia/hohhot-xilitu-zhao.jpg',
      alt: '呼和浩特席力图召寺院建筑实景，不含人物',
      landmark: '席力图召',
      title: '席力图召.jpg',
      downloadPath: '0/0c/席力图召.jpg',
      credit: 'Wikimedia Commons 来源页',
      license: '以来源页标注为准',
      licenseUrl: 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia',
    }),
    {
      src: '/assets/journey-images/wikimedia/hohhot-old-town-dazhao.jpg',
      alt: '呼和浩特老城慢走街区建筑实景，不含人物',
      landmark: '呼和浩特老城慢走',
      kind: 'landmark',
      routeEligible: true,
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Dazhao_Temple_20230730.jpg',
      credit: 'Wikimedia Commons 来源页',
      license: '以来源页标注为准',
      licenseUrl: 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia',
      downloadUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Dazhao_Temple_20230730.jpg?width=1280',
    },
  ],
}
