export type DietaryProfile = {
  avoidSpicy: boolean
  avoidSeafood: boolean
  vegetarian: boolean
  halal: boolean
  allergies: string[]
  dislikes: string[]
}

export const emptyDietaryProfile = (): DietaryProfile => ({
  avoidSpicy: false,
  avoidSeafood: false,
  vegetarian: false,
  halal: false,
  allergies: [],
  dislikes: [],
})

const knownFoodTerms = ['辣', '海鲜', '虾', '蟹', '贝类', '鱼', '花生', '坚果', '牛奶', '乳制品', '猪肉', '牛肉', '羊肉', '鸡肉', '鸭肉', '香菜', '葱', '蒜', '酒']

const foodRiskPatterns: Array<[string, RegExp]> = [
  ['spicy', /辣|麻辣|香辣|酸辣|椒麻|辣椒|火锅|串串|冒菜|辣卤|湘菜/],
  ['seafood', /海鲜|虾|蟹|螃蟹|龙虾|小龙虾|生蚝|牡蛎|蛤|贝|鱼|鳗|鱿鱼|海蛎|虾仁|鱼丸/],
  ['meat', /猪|牛|羊|鸡|鸭|鹅|肉|腊肉|火腿|香肠|烤鸭|肉夹馍|牛肉|羊肉|鸡肉|鸭血|兔头|牛杂|叉烧/],
  ['pork', /猪|叉烧|腊肉|香肠|火腿|培根|猪脚|腊味/],
  ['alcohol', /酒|啤酒|白酒|黄酒|米酒/],
  ['peanut', /花生|坚果/],
  ['dairy', /牛奶|奶油|乳制品|芝士|奶酪/],
]

const negativeFoodPattern = /(?:不吃|不能吃|忌口|忌食|忌|不想吃|不喜欢(?:吃)?|过敏(?:于)?|对)\s*([^，。；,;！？!\n]+)/g

function normalizeTerm(value: string) {
  return value
    .replace(/^(?:太|很|特别|一点也不|完全不)/, '')
    .replace(/(?:食物|东西|类|的|也不行|也不吃)$/, '')
    .trim()
}

function splitTerms(value: string) {
  return value
    .split(/和|与|跟|、|\/|及|以及|还有|，|,|\s+/)
    .map(normalizeTerm)
    .filter((term) => term.length >= 1 && term.length <= 12 && !/^(饭|吃饭|餐|东西都|什么都)$/.test(term))
}

export function extractDietaryProfile(text: string): DietaryProfile {
  const profile = emptyDietaryProfile()
  const negativeTerms = [...text.matchAll(negativeFoodPattern)]
    .flatMap((match) => splitTerms(match[1] ?? ''))
    .filter((term) => !term.endsWith('过敏'))
  const allergyTermsFromText = [...text.matchAll(/(?:对\s*)?([^\s，。；,;！？!]{1,8})过敏/g)].map((match) => normalizeTerm(match[1] ?? ''))
  const constrainedFoodText = [...negativeTerms, ...allergyTermsFromText].join('、')
  const hasNegative = (pattern: RegExp) => pattern.test(constrainedFoodText)

  profile.avoidSpicy = hasNegative(/辣|麻辣|重口|辛辣/)
  profile.avoidSeafood = hasNegative(/海鲜|虾|蟹|贝类|生蚝|鱼类/)
  profile.vegetarian = /素食|纯素|全素|不吃荤|不吃肉/.test(text)
  profile.halal = /清真|穆斯林饮食|清真餐/.test(text)

  const allergyTerms = unique([...negativeTerms, ...allergyTermsFromText, ...knownFoodTerms].filter((term) => (
    text.includes(`${term}过敏`) || text.includes(`对${term}过敏`) || text.includes(`过敏于${term}`)
  )))
  profile.allergies = allergyTerms
  profile.dislikes = unique(negativeTerms.filter((term) => (
    !/辣|海鲜|虾|蟹|贝类|鱼类|素食|清真/.test(term)
      && !profile.allergies.includes(term)
  )))
  return profile
}

export function inferFoodTags(text: string) {
  return unique(foodRiskPatterns.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag))
}

export function foodCompatibilityIssues(text: string, profile: DietaryProfile, explicitTags: string[] = []) {
  const searchable = `${text} ${explicitTags.join(' ')}`
  const risks = new Set([...inferFoodTags(text), ...explicitTags])
  const issues: string[] = []
  if (profile.avoidSpicy && risks.has('spicy')) issues.push('含辣或重口味线索')
  if (profile.avoidSeafood && risks.has('seafood')) issues.push('含海鲜或水产线索')
  if (profile.vegetarian && risks.has('meat')) issues.push('含肉类线索')
  if (profile.halal && (risks.has('pork') || risks.has('alcohol'))) issues.push('可能含猪肉或酒精')
  profile.allergies.forEach((allergy) => {
    const allergyPattern = allergy === '海鲜' || allergy === '贝类' ? /海鲜|虾|蟹|贝|鱼|生蚝|牡蛎/ : new RegExp(allergy, 'i')
    if (allergyPattern.test(searchable)) issues.push(`命中过敏原：${allergy}`)
  })
  profile.dislikes.forEach((dislike) => {
    if (dislike && searchable.includes(dislike)) issues.push(`命中忌口：${dislike}`)
  })
  return [...new Set(issues)]
}

export function dietarySummary(profile: DietaryProfile) {
  const items: string[] = []
  if (profile.avoidSpicy) items.push('不吃辣')
  if (profile.avoidSeafood) items.push('避开海鲜')
  if (profile.vegetarian) items.push('素食')
  if (profile.halal) items.push('清真饮食')
  if (profile.allergies.length > 0) items.push(`过敏：${profile.allergies.join('、')}`)
  if (profile.dislikes.length > 0) items.push(`忌口：${profile.dislikes.join('、')}`)
  return items
}

function unique(items: string[]) {
  return [...new Set(items)]
}
