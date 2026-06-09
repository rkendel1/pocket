import test from 'node:test'
import assert from 'node:assert/strict'
import { autoCategorizeCard } from './categorize'

test('autoCategorizeCard preserves manual categories and tags', () => {
  const categorized = autoCategorizeCard({
    title: 'Gardening ideas',
    board: 'Personal',
    lane: 'act',
    mood: 'calm',
    tags: ['plants', 'home'],
  })

  assert.equal(categorized.board, 'Personal')
  assert.equal(categorized.lane, 'act')
  assert.equal(categorized.mood, 'calm')
  assert.deepEqual(categorized.tags, ['plants', 'home'])
})

test('autoCategorizeCard infers board lane mood and tags from content', () => {
  const categorized = autoCategorizeCard({
    title: 'React API tutorial',
    note: 'Research TypeScript and Node in a deep focus session',
    link: 'https://developer.mozilla.org/en-US/docs/Web/API',
    media_type: 'article',
    board: 'Inbox',
    lane: 'idea',
    mood: 'curious',
    tags: [],
  })

  assert.equal(categorized.board, 'Build')
  assert.equal(categorized.lane, 'explore')
  assert.equal(categorized.mood, 'focused')
  assert.ok(categorized.tags.includes('coding'))
  assert.ok(categorized.tags.includes('learning'))
})

test('autoCategorizeCard creates fallback tags when no keywords are found', () => {
  const categorized = autoCategorizeCard({
    title: 'Fermentation experiments',
    board: 'Inbox',
    lane: 'idea',
    mood: 'curious',
    tags: [],
  })

  assert.ok(categorized.tags.length > 0)
  assert.ok(categorized.tags.includes('fermentation'))
})
