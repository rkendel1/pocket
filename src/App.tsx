import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'

type Card = {
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

type InsightPayload = {
  clusters: { topic: string; size: number; sampleTitles: string[] }[]
  heatmap: { topic: string; score: number }[]
  recommendations: { cardId: number; title: string; because: string }[]
  passionReport: string
  reflectionDigest: string[]
}

type GraphPayload = {
  nodes: { id: number; label: string; board: string }[]
  edges: { source: number; target: number; reason: string }[]
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
const lanes = ['idea', 'explore', 'act', 'archive']
const views = ['capture', 'kanban', 'moodboard', 'timeline', 'graph', 'insights', 'explore'] as const

type View = (typeof views)[number]
type SharePrefill = Pick<Card, 'title' | 'link' | 'note'> & { tags: string }

const parseTags = (text: string) =>
  text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

const parseSharePrefill = (search: string): SharePrefill | null => {
  const params = new URLSearchParams(search)
  const title = (params.get('title') ?? '').trim()
  const link = (params.get('url') ?? params.get('link') ?? '').trim()
  const note = (params.get('text') ?? params.get('note') ?? '').trim()
  const tags = (params.get('tags') ?? '').trim()

  if (!title && !link && !note && !tags) {
    return null
  }

  return {
    title: title || link || 'Shared item',
    link: link || null,
    note,
    tags,
  }
}

function App() {
  const sharePrefill = parseSharePrefill(window.location.search)
  const [cards, setCards] = useState<Card[]>([])
  const [publicCards, setPublicCards] = useState<Card[]>([])
  const [insights, setInsights] = useState<InsightPayload | null>(null)
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], edges: [] })
  const [activity, setActivity] = useState<{ id: number; message: string; createdAt: string }[]>([])
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('capture')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [shareNotice] = useState(sharePrefill ? 'Shared content added. Review it and tap “Save this for me”.' : '')

  const [form, setForm] = useState({
    title: sharePrefill?.title ?? '',
    link: sharePrefill?.link ?? '',
    media_url: '',
    media_type: 'article',
    note: sharePrefill?.note ?? '',
    tags: sharePrefill?.tags ?? '',
    board: 'Inbox',
    lane: 'idea',
    mood: 'curious',
    is_public: false,
  })

  const loadAll = useCallback(async (search = '') => {
    const cardUrl = search ? `${API_BASE}/api/cards?query=${encodeURIComponent(search)}` : `${API_BASE}/api/cards`
    const [cardRes, insightRes, graphRes, activityRes, publicRes] = await Promise.all([
      fetch(cardUrl),
      fetch(`${API_BASE}/api/insights`),
      fetch(`${API_BASE}/api/connections`),
      fetch(`${API_BASE}/api/activity`),
      fetch(`${API_BASE}/api/cards/public`),
    ])

    if (!cardRes.ok || !insightRes.ok || !graphRes.ok || !activityRes.ok || !publicRes.ok) {
      throw new Error('Failed to load one or more resources')
    }

    const cardJson = (await cardRes.json()) as { cards: Card[] }
    const insightJson = (await insightRes.json()) as InsightPayload
    const graphJson = (await graphRes.json()) as GraphPayload
    const activityJson = (await activityRes.json()) as { activity: { id: number; message: string; createdAt: string }[] }
    const publicJson = (await publicRes.json()) as { cards: Card[] }

    return {
      cards: cardJson.cards,
      insights: insightJson,
      graph: graphJson,
      activity: activityJson.activity,
      publicCards: publicJson.cards,
    }
  }, [])

  const applyData = useCallback(
    (data: { cards: Card[]; insights: InsightPayload; graph: GraphPayload; activity: { id: number; message: string; createdAt: string }[]; publicCards: Card[] }) => {
      setCards(data.cards)
      setInsights(data.insights)
      setGraph(data.graph)
      setActivity(data.activity)
      setPublicCards(data.publicCards)
    },
    [],
  )

  const refreshData = useCallback(
    async (search = '') => {
      const data = await loadAll(search)
      applyData(data)
    },
    [applyData, loadAll],
  )

  useEffect(() => {
    let isCancelled = false
    loadAll()
      .then((data) => {
        if (!isCancelled) {
          applyData(data)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setError('Unable to connect to the API. Start `npm run dev` to launch both apps.')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [applyData, loadAll])

  useEffect(() => {
    const timer = setInterval(() => {
      refreshData(query).catch(() => undefined)
    }, 15000)

    return () => clearInterval(timer)
  }, [query, refreshData])

  useEffect(() => {
    if (!sharePrefill) {
      return
    }

    window.history.replaceState({}, '', window.location.pathname)
  }, [sharePrefill])

  const submitCard = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/api/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: parseTags(form.tags),
          link: form.link || null,
          media_url: form.media_url || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Could not save card')
      }

      setForm({
        title: '',
        link: '',
        media_url: '',
        media_type: 'article',
        note: '',
        tags: '',
        board: 'Inbox',
        lane: 'idea',
        mood: 'curious',
        is_public: false,
      })

      await refreshData(query)
      setView('kanban')
    } catch {
      setError('Saving failed. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  const moveCard = async (id: number, lane: string) => {
    await fetch(`${API_BASE}/api/cards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lane }),
    })
    await refreshData(query)
  }

  const cardsByLane = useMemo(
    () =>
      lanes.reduce<Record<string, Card[]>>((acc, lane) => {
        acc[lane] = cards.filter((card) => card.lane === lane)
        return acc
      }, {}),
    [cards],
  )

  return (
    <main className="app-shell">
      <header>
        <h1>Passion Curator</h1>
        <p className="subtitle">Half-sheet inspiration capture + private insight engine.</p>
      </header>

      <section className="controls">
        <input
          value={query}
          onChange={(event) => {
            const value = event.target.value
            setQuery(value)
            refreshData(value).catch(() => undefined)
          }}
          placeholder="Live search cards, tags, notes"
          aria-label="Search cards"
        />
        <nav>
          {views.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={view === candidate ? 'active' : ''}
              onClick={() => setView(candidate)}
            >
              {candidate}
            </button>
          ))}
        </nav>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {shareNotice ? <p className="notice">{shareNotice}</p> : null}

      {view === 'capture' ? (
        <section className="panel split">
          <form onSubmit={submitCard} className="capture-form">
            <h2>Capture a half-sheet</h2>
            <label>
              Title
              <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label>
              Link
              <input value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} />
            </label>
            <label>
              Media URL
              <input value={form.media_url} onChange={(event) => setForm({ ...form, media_url: event.target.value })} />
            </label>
            <label>
              Media type
              <select value={form.media_type} onChange={(event) => setForm({ ...form, media_type: event.target.value })}>
                <option value="article">article</option>
                <option value="image">image</option>
                <option value="video">video</option>
                <option value="pdf">pdf</option>
                <option value="voice">voice</option>
                <option value="scribble">scribble</option>
              </select>
            </label>
            <label>
              Note
              <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} rows={4} />
            </label>
            <label>
              Tags (comma separated)
              <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
            </label>
            <div className="grid-3">
              <label>
                Board
                <input value={form.board} onChange={(event) => setForm({ ...form, board: event.target.value })} />
              </label>
              <label>
                Lane
                <select value={form.lane} onChange={(event) => setForm({ ...form, lane: event.target.value })}>
                  {lanes.map((lane) => (
                    <option key={lane}>{lane}</option>
                  ))}
                </select>
              </label>
              <label>
                Mood
                <input value={form.mood} onChange={(event) => setForm({ ...form, mood: event.target.value })} />
              </label>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(event) => setForm({ ...form, is_public: event.target.checked })}
              />
              Opt-in to public curation discovery
            </label>
            <button disabled={saving} type="submit">
              {saving ? 'Saving…' : 'Save this for me'}
            </button>
          </form>

          <div>
            <h2>Activity feed</h2>
            <ul className="activity">
              {activity.map((item) => (
                <li key={item.id}>
                  <span>{item.message}</span>
                  <time>{new Date(item.createdAt).toLocaleString()}</time>
                </li>
              ))}
              {!activity.length ? <li>No activity yet.</li> : null}
            </ul>
          </div>
        </section>
      ) : null}

      {view === 'kanban' ? (
        <section className="panel lane-grid">
          {lanes.map((lane) => (
            <article key={lane}>
              <h2>{lane}</h2>
              {cardsByLane[lane]?.map((card) => (
                <div key={card.id} className="card">
                  <strong>{card.title}</strong>
                  <p>{card.note || 'No note'}</p>
                  <small>{card.tags.join(', ') || 'untagged'}</small>
                  <div className="actions">
                    {lanes
                      .filter((nextLane) => nextLane !== lane)
                      .map((nextLane) => (
                        <button key={nextLane} type="button" onClick={() => moveCard(card.id, nextLane)}>
                          → {nextLane}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </article>
          ))}
        </section>
      ) : null}

      {view === 'moodboard' ? (
        <section className="panel card-grid">
          {cards.map((card) => (
            <article key={card.id} className="card mood">
              {card.media_url ? <img src={card.media_url} alt={card.title} loading="lazy" /> : null}
              <h3>{card.title}</h3>
              <p>{card.mood}</p>
            </article>
          ))}
          {!cards.length ? <p>No cards yet.</p> : null}
        </section>
      ) : null}

      {view === 'timeline' ? (
        <section className="panel timeline">
          {cards.map((card) => (
            <article key={card.id}>
              <time>{new Date(card.created_at).toLocaleString()}</time>
              <strong>{card.title}</strong>
              <p>{card.note}</p>
            </article>
          ))}
        </section>
      ) : null}

      {view === 'graph' ? (
        <section className="panel split">
          <div>
            <h2>Connection graph</h2>
            <ul>
              {graph.edges.map((edge, index) => (
                <li key={`${edge.source}-${edge.target}-${index}`}>
                  #{edge.source} ↔ #{edge.target} ({edge.reason})
                </li>
              ))}
              {!graph.edges.length ? <li>No connections yet — add shared tags.</li> : null}
            </ul>
          </div>
          <div>
            <h2>Nodes</h2>
            <ul>
              {graph.nodes.map((node) => (
                <li key={node.id}>
                  #{node.id} {node.label} · {node.board}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {view === 'insights' && insights ? (
        <section className="panel split">
          <div>
            <h2>Topic clusters</h2>
            <ul>
              {insights.clusters.map((cluster) => (
                <li key={cluster.topic}>
                  <strong>{cluster.topic}</strong> ({cluster.size})
                  <div>{cluster.sampleTitles.join(' · ')}</div>
                </li>
              ))}
            </ul>
            <h3>Passion report</h3>
            <p>{insights.passionReport}</p>
          </div>
          <div>
            <h2>Interest heatmap</h2>
            <ul className="heatmap">
              {insights.heatmap.map((topic) => (
                <li key={topic.topic}>
                  <span>{topic.topic}</span>
                  <meter min={0} max={Math.max(...insights.heatmap.map((item) => item.score), 1)} value={topic.score} />
                </li>
              ))}
            </ul>
            <h3>Weekly reflection digest</h3>
            <ol>
              {insights.reflectionDigest.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {view === 'explore' && insights ? (
        <section className="panel split">
          <div>
            <h2>Recommendations from your library</h2>
            <ul>
              {insights.recommendations.map((recommendation) => (
                <li key={recommendation.cardId}>
                  <strong>{recommendation.title}</strong>
                  <p>{recommendation.because}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Similar public curations</h2>
            <ul>
              {publicCards.map((card) => (
                <li key={card.id}>
                  <strong>{card.title}</strong>
                  <p>{card.tags.join(', ')}</p>
                </li>
              ))}
              {!publicCards.length ? <li>No public curations yet. Enable public sharing on a card.</li> : null}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default App
