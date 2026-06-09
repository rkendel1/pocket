type CardCategorizationInput = {
  title: string
  note?: string | null
  link?: string | null
  media_type?: string | null
  tags?: string[]
  board?: string | null
  lane?: string | null
  mood?: string | null
}

const normalize = (text: string) => text.trim().toLowerCase()

const unique = (items: string[]) => [...new Set(items.map((item) => normalize(item)).filter(Boolean))]

const isPlaceholder = (value: string | null | undefined, placeholder: string) =>
  !value || normalize(value) === normalize(placeholder)

const parseLinkTokens = (rawLink: string | null | undefined) => {
  if (!rawLink) {
    return []
  }

  try {
    const url = new URL(rawLink)
    const hostTokens = url.hostname.split('.').map(normalize).filter(Boolean)
    const pathTokens = url.pathname.split('/').map(normalize).filter(Boolean)
    return [...hostTokens, ...pathTokens]
  } catch {
    return []
  }
}

const inferTags = (text: string, mediaType: string | null | undefined, link: string | null | undefined) => {
  const inferred: string[] = []

  const tagRules: Array<[string, RegExp]> = [
    ['ai', /\b(ai|llm|machine learning)\b/],
    ['coding', /\b(code|coding|programming|typescript|javascript|react|node|api|backend|frontend)\b/],
    ['design', /\b(design|ux|ui|illustration|drawing|art)\b/],
    ['writing', /\b(write|writing|essay|journal|note)\b/],
    ['learning', /\b(learn|study|tutorial|course|research|guide)\b/],
    ['business', /\b(business|startup|market|sales|finance|invest)\b/],
    ['wellness', /\b(health|fitness|sleep|meditat|wellness|workout)\b/],
  ]

  for (const [tag, rule] of tagRules) {
    if (rule.test(text)) {
      inferred.push(tag)
    }
  }

  if (mediaType?.trim()) {
    inferred.push(normalize(mediaType))
  }

  const linkTokens = parseLinkTokens(link)
  const domainCandidate = linkTokens.find((token) => !['www', 'com', 'org', 'net', 'io', 'dev'].includes(token))
  if (domainCandidate && domainCandidate.length > 2) {
    inferred.push(domainCandidate)
  }

  if (!inferred.length) {
    inferred.push(
      ...text
        .split(/[^a-z0-9]+/)
        .map(normalize)
        .filter((token) => token.length > 4)
        .slice(0, 2),
    )
  }

  return unique(inferred).slice(0, 6)
}

const inferBoard = (text: string) => {
  if (/\b(code|coding|programming|typescript|javascript|react|node|api|backend|frontend)\b/.test(text)) return 'Build'
  if (/\b(design|ux|ui|illustration|drawing|art|music|photo|video|creative|writing)\b/.test(text)) return 'Creative'
  if (/\b(health|fitness|sleep|meditat|wellness|workout|nutrition)\b/.test(text)) return 'Wellness'
  if (/\b(business|startup|market|sales|finance|invest|product)\b/.test(text)) return 'Growth'
  return 'Inbox'
}

const inferLane = (text: string) => {
  if (/\b(done|complete|completed|archive|retrospective|summary)\b/.test(text)) return 'archive'
  if (/\b(todo|build|ship|implement|fix|practice|schedule|launch|try)\b/.test(text)) return 'act'
  if (/\b(learn|study|research|read|watch|explore|investigate|compare)\b/.test(text)) return 'explore'
  return 'idea'
}

const inferMood = (text: string) => {
  if (/\b(excited|inspired|energized|hype|enthusiastic)\b/.test(text)) return 'energized'
  if (/\b(focus|focused|deep work|analysis|concentrat)\b/.test(text)) return 'focused'
  if (/\b(calm|quiet|mindful|reflect|steady)\b/.test(text)) return 'calm'
  if (/\b(urgent|asap|deadline|stress|panic)\b/.test(text)) return 'intense'
  return 'curious'
}

export const autoCategorizeCard = (input: CardCategorizationInput) => {
  const title = input.title.trim()
  const note = input.note?.trim() ?? ''
  const mediaType = input.media_type?.trim() ?? null
  const link = input.link?.trim() ?? null
  const text = normalize([title, note, mediaType ?? '', ...parseLinkTokens(link)].join(' '))

  const manualTags = unique((input.tags ?? []).map((tag) => String(tag)))
  const tags = manualTags.length ? manualTags : inferTags(text, mediaType, link)

  const board = isPlaceholder(input.board, 'Inbox') ? inferBoard(text) : input.board!.trim()
  const lane = isPlaceholder(input.lane, 'idea') ? inferLane(text) : input.lane!.trim()
  const mood = isPlaceholder(input.mood, 'curious') ? inferMood(text) : input.mood!.trim()

  return { board, lane, mood, tags }
}
