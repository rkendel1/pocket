import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import Database from 'better-sqlite3'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { autoCategorizeCard } from './categorize'
import { buildConnections, computeInsights, type Card } from './insights'

const app = express()
const port = Number(process.env.PORT ?? 8787)
const dataDir = path.join(process.cwd(), 'data')
const dbFile = path.join(dataDir, 'pocket.sqlite')

fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(dbFile)

db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    link TEXT,
    media_url TEXT,
    media_type TEXT,
    note TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    board TEXT NOT NULL DEFAULT 'Inbox',
    lane TEXT NOT NULL DEFAULT 'idea',
    mood TEXT NOT NULL DEFAULT 'curious',
    is_public INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`)

const toCard = (row: Record<string, unknown>): Card => ({
  id: Number(row.id),
  title: String(row.title),
  link: row.link ? String(row.link) : null,
  media_url: row.media_url ? String(row.media_url) : null,
  media_type: row.media_type ? String(row.media_type) : null,
  note: String(row.note ?? ''),
  tags: JSON.parse(String(row.tags ?? '[]')),
  board: String(row.board ?? 'Inbox'),
  lane: String(row.lane ?? 'idea'),
  mood: String(row.mood ?? 'curious'),
  is_public: Boolean(row.is_public),
  created_at: String(row.created_at),
})

const listCards = () => {
  const rows = db.prepare('SELECT * FROM cards ORDER BY datetime(created_at) DESC').all() as Record<string, unknown>[]
  return rows.map(toCard)
}

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/cards', (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query.trim().toLowerCase() : ''
  const board = typeof req.query.board === 'string' ? req.query.board.trim() : ''

  let cards = listCards()

  if (board) {
    cards = cards.filter((card) => card.board.toLowerCase() === board.toLowerCase())
  }

  if (query) {
    cards = cards.filter((card) => {
      const haystack = [card.title, card.note, card.link ?? '', ...card.tags].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }

  res.json({ cards })
})

app.get('/api/cards/public', (_req, res) => {
  const cards = listCards().filter((card) => card.is_public)
  res.json({ cards })
})

app.post('/api/cards', writeLimiter, (req, res) => {
  const payload = req.body as Partial<Card>

  if (!payload.title || typeof payload.title !== 'string') {
    res.status(400).json({ error: 'title is required' })
    return
  }

  const normalizedTags = Array.isArray(payload.tags)
    ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : []
  const categorization = autoCategorizeCard({
    title: payload.title,
    note: payload.note,
    link: payload.link,
    media_type: payload.media_type,
    tags: normalizedTags,
    board: payload.board,
    lane: payload.lane,
    mood: payload.mood,
  })

  const createdAt = new Date().toISOString()
  const result = db
    .prepare(
      `INSERT INTO cards (title, link, media_url, media_type, note, tags, board, lane, mood, is_public, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.title.trim(),
      payload.link?.trim() ?? null,
      payload.media_url?.trim() ?? null,
      payload.media_type?.trim() ?? null,
      payload.note?.trim() ?? '',
      JSON.stringify(categorization.tags),
      categorization.board,
      categorization.lane,
      categorization.mood,
      payload.is_public ? 1 : 0,
      createdAt,
    )

  const inserted = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>
  res.status(201).json({ card: toCard(inserted) })
})

app.patch('/api/cards/:id', writeLimiter, (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'invalid id' })
    return
  }

  const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(id)
  if (!existing) {
    res.status(404).json({ error: 'card not found' })
    return
  }

  const payload = req.body as Partial<Card>
  const fields: string[] = []
  const values: unknown[] = []

  const assign = (key: string, value: unknown) => {
    fields.push(`${key} = ?`)
    values.push(value)
  }

  if (typeof payload.board === 'string') assign('board', payload.board.trim() || 'Inbox')
  if (typeof payload.lane === 'string') assign('lane', payload.lane.trim() || 'idea')
  if (typeof payload.mood === 'string') assign('mood', payload.mood.trim() || 'curious')
  if (typeof payload.note === 'string') assign('note', payload.note.trim())
  if (Array.isArray(payload.tags)) {
    assign('tags', JSON.stringify(payload.tags.map((tag) => String(tag).trim()).filter(Boolean)))
  }

  if (typeof payload.is_public === 'boolean') assign('is_public', payload.is_public ? 1 : 0)

  if (!fields.length) {
    res.status(400).json({ error: 'no valid fields to update' })
    return
  }

  values.push(id)
  db.prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Record<string, unknown>
  res.json({ card: toCard(updated) })
})

app.get('/api/insights', (_req, res) => {
  const cards = listCards()
  res.json(computeInsights(cards))
})

app.get('/api/connections', (_req, res) => {
  const cards = listCards()
  res.json(buildConnections(cards))
})

app.get('/api/activity', (_req, res) => {
  const cards = listCards()
    .slice(0, 30)
    .map((card) => ({
      id: card.id,
      message: `Saved in ${card.board}: ${card.title}`,
      createdAt: card.created_at,
    }))

  res.json({ activity: cards })
})

app.listen(port, () => {
  console.log(`Passion Curator API listening on http://localhost:${port}`)
})
