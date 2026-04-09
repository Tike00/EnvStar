import { describe, expect, it } from 'vitest'
import { layoutConstellations } from './layout-constellations.ts'
import { parseMarkdownDocument } from '../../markdown/lib/parse-markdown.ts'
import type { RawMarkdownDocument } from '../../../shared/types/knowledge.ts'

function createDocument(name: string, markdown: string): RawMarkdownDocument {
  return {
    id: `${name}-test`,
    name,
    markdown,
    importedAt: '2026-04-05T00:00:00+08:00',
    source: 'sample',
  }
}

function distanceBetween(
  left: { x: number; y: number },
  right: { x: number; y: number },
) {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

describe('layoutConstellations', () => {
  it('keeps the file root node as the largest star and places first-level headings on the same orbit', () => {
    const constellation = parseMarkdownDocument(
      createDocument(
        'solar-system.md',
        ['# Mercury', '', '# Venus', '', '# Earth'].join('\n'),
      ),
    )

    const layout = layoutConstellations([constellation])
    const rootNode = layout.nodes.find((node) => node.isRoot)
    const planets = layout.nodes.filter((node) => node.parentId === rootNode?.id)

    expect(rootNode).toBeDefined()
    expect(planets).toHaveLength(3)
    expect(rootNode?.radius).toBeGreaterThan(
      Math.max(...planets.map((node) => node.radius)),
    )

    const orbitDistances = planets.map((planet) => distanceBetween(rootNode!, planet))
    const firstDistance = orbitDistances[0] ?? 0

    expect(planets.every((planet) => planet.orbitCenterId === rootNode?.id)).toBe(true)
    expect(orbitDistances.every((distance) => Math.abs(distance - firstDistance) < 0.001)).toBe(
      true,
    )
  })

  it('places nested headings on a satellite orbit around their selected parent node', () => {
    const constellation = parseMarkdownDocument(
      createDocument(
        'nested-system.md',
        ['# Planet Alpha', '', '## Moon One', '', '## Moon Two'].join('\n'),
      ),
    )

    const layout = layoutConstellations([constellation])
    const planet = layout.nodes.find((node) => node.title === 'Planet Alpha')
    const moons = layout.nodes.filter((node) => node.parentId === planet?.id)

    expect(planet).toBeDefined()
    expect(moons).toHaveLength(2)
    expect(moons.every((moon) => moon.orbitCenterId === planet?.id)).toBe(true)

    const moonDistances = moons.map((moon) => distanceBetween(planet!, moon))
    expect(Math.abs((moonDistances[0] ?? 0) - (moonDistances[1] ?? 0))).toBeLessThan(0.001)
  })

  it('separates multiple markdown constellations into different star systems on the global map', () => {
    const first = parseMarkdownDocument(
      createDocument('first.md', '# First Planet\n\n## Moon A'),
    )
    const second = parseMarkdownDocument(
      createDocument('second.md', '# Second Planet\n\n## Moon B'),
    )
    const third = parseMarkdownDocument(
      createDocument('third.md', '# Third Planet\n\n## Moon C'),
    )
    const fourth = parseMarkdownDocument(
      createDocument('fourth.md', '# Fourth Planet\n\n## Moon D'),
    )

    const layout = layoutConstellations([first, second, third, fourth])
    const anchors = layout.constellations.map((constellation) => constellation.anchor)
    const bounds = layout.constellations.map((constellation) => constellation.bounds)

    expect(anchors.some((anchor) => anchor.x < -120)).toBe(true)
    expect(anchors.some((anchor) => anchor.x > 120)).toBe(true)
    expect(anchors.some((anchor) => anchor.y < -120)).toBe(true)
    expect(anchors.some((anchor) => anchor.y > 120)).toBe(true)

    const hasOverlap = bounds.some((leftBounds, leftIndex) =>
      bounds.some((rightBounds, rightIndex) => {
        if (leftIndex >= rightIndex) {
          return false
        }

        return !(
          leftBounds.maxX + 80 < rightBounds.minX ||
          leftBounds.minX > rightBounds.maxX + 80 ||
          leftBounds.maxY + 80 < rightBounds.minY ||
          leftBounds.minY > rightBounds.maxY + 80
        )
      }),
    )

    expect(hasOverlap).toBe(false)
  })
})
