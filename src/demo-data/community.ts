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

const seed = [
  ['shanghai-skyline.jpg', 'landscape', '外滩到北外滩，沿着江风走一下午', '旅行', '上海'],
  ['wukang-road.jpg', 'tall', '武康路不赶时间的 City Walk', '周末', '上海'],
  ['coffee.jpg', 'portrait', '安福路咖啡与小店，四小时刚刚好', '约会', '上海'],
  ['museum.jpg', 'square', '雨天把展览留在下午，路线反而更顺', '旅行', '上海'],
  ['food.jpg', 'landscape', '四个人聚餐，预算 300 也能都满意', '聚餐', '上海'],
  ['garden.jpg', 'portrait', '苏州园林慢游：一天只走三个地方', '周末', '苏州'],
  ['bund.jpg', 'tall', '第一次来上海，三天两晚不绕路', '旅行', '上海'],
  ['date.jpg', 'square', '两个人的黄昏路线：散步、书店、晚餐', '约会', '南京'],
  ['weekend.jpg', 'landscape', '周末逃离城市，去看一场日落', '周末', '杭州'],
  ['gallery.jpg', 'portrait', '天目里展览与咖啡，雨天也能慢慢逛', '旅行', '杭州'],
  ['garden.jpg', 'tall', '良渚古城半日，风从草地上经过', '周末', '杭州'],
  ['coffee.jpg', 'square', '西湖边的约会路线，散步后刚好吃饭', '约会', '杭州'],
  ['gallery.jpg', 'portrait', '上海独立空间一天，下午不怕下雨', '旅行', '上海'],
  ['hotel.jpg', 'tall', '把酒店锁定后，路线怎么排更自然', '旅行', '上海'],
  ['train.jpg', 'square', '沿海电车的一天，风景都在路上', '周末', '厦门'],
] as const

const authors = ['阿柚', '野生小海', '晚风不晚', '小鹿乱撞']
const avatars = ['/assets/date.jpg', '/assets/coffee.jpg', '/assets/weekend.jpg', '/assets/gallery.jpg']

export const communityPosts: CommunityPost[] = seed.map((item, index) => ({
  id: `post-${index + 1}`,
  image: `/assets/${item[0]}`,
  images: [`/assets/${item[0]}`, '/assets/food.jpg', '/assets/coffee.jpg'],
  ratio: item[1],
  title: item[2],
  category: item[3],
  city: item[4],
  author: authors[index % authors.length],
  avatar: avatars[index % avatars.length],
  likes: 118 + index * 47,
  completed: index % 4 !== 3,
  summary: '这条路线来自一次真实完成的行程。我们把移动距离、天气和停留时间重新整理，保留了最舒服的节奏。',
}))
