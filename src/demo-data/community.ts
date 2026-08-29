import { getCityImage } from './city-images'

export type CommunityPost = {
  id: string
  image: string
  images: string[]
  ratio: 'portrait' | 'square' | 'landscape' | 'tall'
  title: string
  author: string
  avatar: string
  likes: number
  city: string
  category: '旅行' | '周末' | '约会' | '聚餐'
  completed: boolean
  summary: string
}

type CommunitySeed = {
  city: string
  ratio: CommunityPost['ratio']
  title: string
  category: CommunityPost['category']
}

const seed: CommunitySeed[] = [
  { city: '上海', ratio: 'landscape', title: '外滩到北外滩，沿着江风走一下午', category: '旅行' },
  { city: '上海', ratio: 'tall', title: '武康路不赶时间的 City Walk', category: '周末' },
  { city: '上海', ratio: 'portrait', title: '安福路咖啡与小店，四小时刚刚好', category: '约会' },
  { city: '上海', ratio: 'square', title: '雨天把展览留在下午，路线反而更顺', category: '旅行' },
  { city: '杭州', ratio: 'landscape', title: '西湖边慢慢走一圈，下午留给天目里', category: '周末' },
  { city: '苏州', ratio: 'portrait', title: '苏州园林慢游：一天只走三个地方', category: '周末' },
  { city: '南京', ratio: 'square', title: '城墙、老门东和一段不赶时间的散步', category: '旅行' },
  { city: '成都', ratio: 'tall', title: '人民公园喝茶，再去安顺廊桥看夜色', category: '旅行' },
  { city: '厦门', ratio: 'landscape', title: '鼓浪屿和沙坡尾，海风路线不折返', category: '周末' },
  { city: '北京', ratio: 'portrait', title: '胡同散步和一场展览，留出午后空白', category: '旅行' },
  { city: '广州', ratio: 'tall', title: '沙面到永庆坊，边走边吃的一天', category: '聚餐' },
  { city: '重庆', ratio: 'portrait', title: '解放碑、山城步道和洪崖洞夜景', category: '旅行' },
  { city: '西安', ratio: 'square', title: '城墙日落后去回民街，体力刚刚好', category: '旅行' },
  { city: '深圳', ratio: 'landscape', title: '南头古城到深圳湾，城市和海边都看到', category: '周末' },
  { city: '长沙', ratio: 'tall', title: '岳麓山、橘子洲和湘江夜风', category: '旅行' },
  { city: '青岛', ratio: 'portrait', title: '栈桥到八大关，沿海散步不赶景点', category: '周末' },
  { city: '武汉', ratio: 'landscape', title: '东湖、黄鹤楼与一顿热干面', category: '旅行' },
  { city: '昆明', ratio: 'square', title: '翠湖到滇池，把慢生活排进一天', category: '周末' },
  { city: '三亚', ratio: 'tall', title: '椰梦长廊和亚龙湾，给海边留足时间', category: '旅行' },
  { city: '桂林', ratio: 'landscape', title: '象鼻山、两江四湖和阳朔一段慢游', category: '旅行' },
  { city: '哈尔滨', ratio: 'portrait', title: '中央大街到圣索菲亚，冬天也别排太满', category: '周末' },
  { city: '贵阳', ratio: 'square', title: '甲秀楼、青云市集和一顿酸汤', category: '聚餐' },
  { city: '张家界', ratio: 'landscape', title: '天门山之后，把完整一天留给武陵源', category: '旅行' },
]

const authors = ['阿柚', '野生小海', '晚风不晚', '小鹿乱撞']
const avatars = ['/assets/date.jpg', '/assets/coffee.jpg', '/assets/weekend.jpg', '/assets/gallery.jpg']

export const communityPosts: CommunityPost[] = seed.map((item, index) => ({
  id: `post-${index + 1}`,
  image: getCityImage(item.city).src,
  images: [getCityImage(item.city).src],
  ratio: item.ratio,
  title: item.title,
  category: item.category,
  city: item.city,
  author: authors[index % authors.length],
  avatar: avatars[index % avatars.length],
  likes: 118 + index * 47,
  completed: index % 4 !== 3,
  summary: `这是一条${item.city}城市路线参考。图片为${getCityImage(item.city).landmark}真实照片；时间、价格和开放状态需要结合出行日期再次核对。`,
}))
