import test from 'node:test'
import assert from 'node:assert/strict'
import { buildConnections, computeInsights, type Card } from './insights'

const sampleCards: Card[] = [
  {
    id: 1,
    title: 'Urban sketching references',
    link: 'https://example.com/sketch',
    media_url: null,
    media_type: null,
    note: 'Ink and loose lines',
    tags: ['art', 'urban sketching'],
    board: 'Creative',
    lane: 'idea',
    mood: 'curious',
    is_public: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    title: 'Creative coding tutorial',
    link: 'https://example.com/code',
    media_url: null,
    media_type: null,
    note: 'Shaders and generative visuals',
    tags: ['creative coding', 'art'],
    board: 'Creative',
    lane: 'explore',
    mood: 'focused',
    is_public: false,
    created_at: new Date().toISOString(),
  },
]

test('computeInsights returns clusters and digest', () => {
  const insights = computeInsights(sampleCards)

  assert.ok(insights.clusters.length >= 1)
  assert.ok(insights.heatmap.length >= 1)
  assert.ok(insights.passionReport.includes('engaged'))
  assert.equal(insights.reflectionDigest.length, 3)
})

test('buildConnections links cards by shared tags', () => {
  const graph = buildConnections(sampleCards)

  assert.equal(graph.nodes.length, 2)
  assert.equal(graph.edges.length, 1)
  assert.equal(graph.edges[0].reason, 'shared tag: art')
})
