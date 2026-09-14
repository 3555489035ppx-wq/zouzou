import type { CityImage } from './city-images'

const searchPage = (city: string, landmark: string) =>
  `https://image.baidu.com/search/index?word=${encodeURIComponent(`${city} ${landmark} 菜品实物 无人物`)}`

/**
 * Food-only cover candidates for the added city guides.  These are kept out
 * of the landmark gallery so a museum or street photo can never be selected
 * for a food route.  Source and permission notes stay in the data layer; the
 * Explore cards render only the clean image.
 */
const food = (file: string, city: string, landmark: string, note = landmark): CityImage => ({
  src: `/assets/cities/${file}`,
  alt: `${city}${note}食物本体实拍`,
  landmark,
  kind: 'food',
  sourceUrl: searchPage(city, landmark),
  credit: '图片检索候选 · 后台授权记录',
  license: '使用前按后台授权记录核对',
  licenseUrl: null,
  downloadUrl: searchPage(city, landmark),
})

export const moreCityFoodImages: Record<string, CityImage[]> = {
  杭州: [
    food('hangzhou-food-jiaohuaji.jpg', '杭州', '芳明小吃｜叫化鸡', '叫花鸡（食物本体）'),
  ],
  天津: [
    food('tianjin-food-goubuli.jpg', '天津', '狗不理包子'),
    food('tianjin-food-stew.jpg', '天津', '贴饽饽熬小鱼'),
  ],
  济南: [
    food('jinan-food-youxuan.jpg', '济南', '油旋'),
    food('jinan-food-guotie.jpg', '济南', '济南锅贴'),
  ],
  福州: [
    food('fuzhou-food-fotiaoqiang.jpg', '福州', '佛跳墙'),
    food('fuzhou-food-rouyan.jpg', '福州', '肉燕'),
  ],
  宁波: [
    food('ningbo-food-niangao.jpg', '宁波', '宁波年糕'),
    food('ningbo-food-kaoya.jpg', '宁波', '宁波烤鸭'),
  ],
  无锡: [
    food('wuxi-food-xiaolong.jpg', '无锡', '无锡小笼'),
  ],
  兰州: [
    food('lanzhou-food-niangpi.jpg', '兰州', '酿皮'),
    food('lanzhou-food-hand-lamb.jpg', '兰州', '手抓羊肉'),
  ],
  合肥: [
    food('hefei-food-lihongzhang.jpg', '合肥', '李鸿章大杂烩'),
    food('hefei-food-noodles.jpg', '合肥', '牛肉面'),
  ],
  南昌: [
    food('nanchang-food-fen.jpg', '南昌', '南昌拌粉'),
    food('nanchang-food-luhao.jpg', '南昌', '藜蒿炒腊肉'),
  ],
  郑州: [
    food('zhengzhou-food-hulatang.jpg', '郑州', '胡辣汤'),
    food('zhengzhou-food-huimian.jpg', '郑州', '羊肉烩面'),
  ],
  洛阳: [
    food('luoyang-food-yangtang.jpg', '洛阳', '羊肉汤'),
    food('luoyang-food-waterbanquet.jpg', '洛阳', '洛阳水席'),
  ],
  海口: [
    food('haikou-food-hainanfen.jpg', '海口', '海南粉'),
    food('haikou-food-zaopocu.jpg', '海口', '糟粕醋'),
  ],
  珠海: [
    food('zhuhai-food-putao.jpg', '珠海', '澳门葡挞'),
    food('zhuhai-food-oyster.jpg', '珠海', '横琴蚝'),
  ],
  泉州: [
    food('quanzhou-food-mianxian.jpg', '泉州', '面线糊'),
  ],
  呼和浩特: [
    food('hohhot-food-shaomai.jpg', '呼和浩特', '烧麦'),
  ],
}
