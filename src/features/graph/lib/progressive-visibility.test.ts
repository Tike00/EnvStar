import { describe, expect, it } from 'vitest'
import { parseMarkdownDocument } from '../../markdown/lib/parse-markdown.ts'
import { buildProgressiveVisibility } from './progressive-visibility.ts'
import type { RawMarkdownDocument } from '../../../shared/types/knowledge.ts'

function createDocument(name: string, markdown: string): RawMarkdownDocument {
  return {
    id: `${name}-progressive-test`,
    name,
    markdown,
    importedAt: '2026-04-06T00:00:00+08:00',
    source: 'sample',
  }
}

describe('buildProgressiveVisibility', () => {
  const constellation = parseMarkdownDocument(
    createDocument(
      'visibility.md',
      [
        '# Root',
        '',
        '## Alpha',
        '',
        '### Alpha One',
        '',
        '#### Alpha One Deep',
        '',
        '### Alpha Two',
        '',
        '## Beta',
        '',
        '### Beta One',
      ].join('\n'),
    ),
  )

  const root = constellation.nodes.find((node) => node.isRoot)
  const topLevel = constellation.nodes.find(
    (node) => !node.isRoot && node.title === 'Root',
  )
  const alpha = constellation.nodes.find((node) => node.title === 'Alpha')
  const alphaOne = constellation.nodes.find((node) => node.title === 'Alpha One')
  const alphaTwo = constellation.nodes.find((node) => node.title === 'Alpha Two')
  const alphaOneDeep = constellation.nodes.find((node) => node.title === 'Alpha One Deep')
  const betaOne = constellation.nodes.find((node) => node.title === 'Beta One')

  it('shows only the file root and first-level nodes by default', () => {
    const result = buildProgressiveVisibility([constellation], null, false)
    const visibleIds = new Set(result.constellations[0]?.nodes.map((node) => node.id))

    expect(visibleIds).toEqual(
      new Set(
        [root?.id, topLevel?.id].filter((value): value is string => Boolean(value)),
      ),
    )
  })

  it('reveals only the selected branch children instead of every sibling branch', () => {
    const result = buildProgressiveVisibility([constellation], alpha?.id ?? null, false)
    const visibleIds = new Set(result.constellations[0]?.nodes.map((node) => node.id))

    expect(visibleIds.has(alphaOne?.id ?? '')).toBe(true)
    expect(visibleIds.has(alphaTwo?.id ?? '')).toBe(true)
    expect(visibleIds.has(betaOne?.id ?? '')).toBe(false)
  })

  it('reveals the next level of the currently selected node only', () => {
    const result = buildProgressiveVisibility([constellation], alphaOne?.id ?? null, false)
    const visibleIds = new Set(result.constellations[0]?.nodes.map((node) => node.id))

    expect(visibleIds.has(alphaOneDeep?.id ?? '')).toBe(true)
    expect(visibleIds.has(alphaTwo?.id ?? '')).toBe(true)
    expect(visibleIds.has(betaOne?.id ?? '')).toBe(false)
  })

  it('keeps every node visible when full display mode is enabled', () => {
    const result = buildProgressiveVisibility([constellation], alphaOne?.id ?? null, true)

    expect(result.constellations[0]?.nodes).toHaveLength(constellation.nodes.length)
  })
})
