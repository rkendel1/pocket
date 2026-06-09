export type Card = {
  id: number
  title: string
  link: string | null
  media_url: string | null
  media_type: string | null
  note: string
  tags: string[]
  board: string
  lane: string
  mood: string
  is_public: boolean
  created_at: string
}

export type Cluster = {
  topic: string
  size: number
  sampleTitles: string[]
}

export type InsightResult = {
  clusters: Cluster[]
  heatmap: { topic: string; score: number }[]
  recommendations: { cardId: number; title: string; because: string }[]
  passionReport: string
  reflectionDigest: string[]
}

const normalizeTag = (tag: string) => tag.trim().toLowerCase()

const topEntries = (map: Map<string, number>, limit = 6) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)

export const extractTopics = (cards: Card[]) => {
  const counts = new Map<string, number>()

  for (const card of cards) {
    const seeds = new Set<string>()
    for (const tag of card.tags) {
      const normalized = normalizeTag(tag)
      if (normalized) {
        seeds.add(normalized)
      }
    }

    if (!seeds.size) {
      card.title
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 4)
        .slice(0, 2)
        .forEach((token) => seeds.add(token))
    }

    seeds.forEach((seed) => counts.set(seed, (counts.get(seed) ?? 0) + 1))
  }

  return counts
}

export const computeInsights = (cards: Card[]): InsightResult => {
  if (!cards.length) {
    return {
      clusters: [],
      heatmap: [],
      recommendations: [],
      passionReport: 'Start capturing inspirations to unlock your first passion report.',
      reflectionDigest: ['No cards yet — save your first half-sheet and insights will appear here.'],
    }
  }

  const topicCounts = extractTopics(cards)
  const topTopics = topEntries(topicCounts)

  const clusters = topTopics.map(([topic]) => {
    const matching = cards
      .filter((card) =>
        card.tags.some((tag) => normalizeTag(tag) === topic) ||
        card.title.toLowerCase().includes(topic),
      )
      .slice(0, 3)

    return {
      topic,
      size: topicCounts.get(topic) ?? matching.length,
      sampleTitles: matching.map((card) => card.title),
    }
  })

  const heatmap = topTopics.map(([topic, score]) => ({ topic, score }))

  const recommendations = cards
    .slice()
    .sort((a, b) => b.tags.length - a.tags.length)
    .slice(0, 3)
    .map((card) => {
      const strongestTag = card.tags[0] ? normalizeTag(card.tags[0]) : 'inspiration'
      return {
        cardId: card.id,
        title: card.title,
        because: `You repeatedly explore ${strongestTag}; this card can unlock your next action.`,
      }
    })

  const topA = topTopics[0]?.[0] ?? 'creativity'
  const topB = topTopics[1]?.[0] ?? 'learning'
  const passionReport = `You are most engaged with ${topA} and ${topB}. Continue curating these together to turn scattered inspiration into deliberate projects.`

  const reflectionDigest = [
    `This period you captured ${cards.length} cards with strongest momentum around ${topA}.`,
    `Your secondary theme is ${topB}; combine it with ${topA} for a focused experiment this week.`,
    'Pick one saved card and convert it into a 30-minute action to keep momentum tangible.',
  ]

  return { clusters, heatmap, recommendations, passionReport, reflectionDigest }
}

export const buildConnections = (cards: Card[]) => {
  const nodes = cards.map((card) => ({ id: card.id, label: card.title, board: card.board }))
  const edges: { source: number; target: number; reason: string }[] = []

  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const aTags = new Set(cards[i].tags.map(normalizeTag))
      const shared = cards[j].tags.map(normalizeTag).find((tag) => aTags.has(tag) && tag)
      if (shared) {
        edges.push({ source: cards[i].id, target: cards[j].id, reason: `shared tag: ${shared}` })
      }
    }
  }

  return { nodes, edges: edges.slice(0, 80) }
}
