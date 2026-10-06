/** User-facing Chinese copy. Keep facts in the knowledge layer, tone in this layer. */
export const agentCopy = {
  askCity: '想去哪个城市呀？',
  askDuration: '准备玩几天呢？前面说的偏好我会一起考虑。',
  askMode: '想先看看哪里好玩，还是直接安排几天的行程？',
  askWalking: '你是想白天尽量少走路，晚上再找个地方吹吹风、散散步吗？',
  askAccessibility: '你是希望尽量少走路，还是需要全程无障碍、不能步行？这两种情况我会分开安排。',
  missingCity: (city: string) => '我这里关于' + city + '的资料还不够，暂时不想给你随便安排。可以先换个城市看看。',
  noMatches: '还没找到符合这些要求的攻略。你更想看哪类活动？我再换个方向找找，保留已经说好的限制。',
  comparePrompt: '想比较哪两个地方？把名字告诉我就行。',
  compareReady: '把这几个地方放在一起看看，方便你选。',
  comparePartial: '有些地方的资料还不够，我先把能确认出处的内容列出来，没找到的部分会标明。',
  recommend: (city: string, count: number) => city + '可以先看看这' + count + '个方向。有没有哪一个更合你心意？',
  plan: (city: string, days: number, nights: number, adjusted: boolean) =>
    (adjusted ? '按你刚说的想法，重新安排了一版' : '先给你安排了一版') +
    city + days + '天' + (nights > 0 ? nights + '晚' : '') + '的行程，放在下面了。看看节奏合不合适。',
  incomplete: '这次还没排出符合全部要求的行程，卡住的地方列在下面。你可以告诉我哪些能调整，我再接着安排。',
  lockedDays: '目前重新安排时，其他天也可能变化，还不能只锁定某一天修改。要先看看重排后的方案吗？',
  budget: '这份行程先给你安排好啦～如果你有大概的预算，也可以告诉我，我再帮你调整得更合适；还没想好也没关系。',
  factualNotice: '出发前记得再确认开放时间、预约和交通；这里还没有接入实时信息。',
}

/** Keep a clarification short without rewriting any user preference or factual content. */
export function friendlyQuestion(raw: string, fallback = agentCopy.askCity): string {
  const value = raw.trim()
    .replace(/^(?:作为(?:一个)?AI(?:助手)?[，,：:]?|根据你的需求[，,：:]?|为了更好地为你服务[，,：:]?)\s*/, '')
    .replace(/\n+/g, ' ')
    .trim()
  if (!value || value.length > 160) return fallback
  const firstQuestion = value.indexOf('？')
  return firstQuestion >= 0 ? value.slice(0, firstQuestion + 1) : value
}
