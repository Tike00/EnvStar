import { createBoundsFromNodes } from './graph-geometry.ts'
import type {
  GraphLayout,
  MarkdownConstellation,
  OrbitBand,
  PositionedEdge,
  PositionedNode,
} from '../../../shared/types/knowledge.ts'

interface LocalPlacement {
  x: number
  y: number
  orbitCenterId?: string
  orbitRadius?: number
}

const CLUSTER_ACCENTS = [
  '#7cf3ff',
  '#74a9ff',
  '#8ee7c8',
  '#f1e37c',
  '#ffb48c',
]

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const GLOBAL_CLUSTER_GAP = 168

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getNodeRadius(node: MarkdownConstellation['nodes'][number]) {
  if (node.isRoot) {
    return 42
  }

  const base = 26 - node.depth * 3.1 + Math.min(6.5, node.importance * 0.42)
  return clamp(base, 9.5, node.depth === 1 ? 24 : node.depth === 2 ? 18.5 : 15.5)
}

function createNodeMaps(constellation: MarkdownConstellation) {
  const nodeById = new Map(constellation.nodes.map((node) => [node.id, node] as const))
  const childIdsByParent = new Map<string, string[]>()

  for (const node of constellation.nodes) {
    if (!node.parentId) {
      continue
    }

    childIdsByParent.set(node.parentId, [
      ...(childIdsByParent.get(node.parentId) ?? []),
      node.id,
    ])
  }

  for (const [parentId, childIds] of childIdsByParent.entries()) {
    childIdsByParent.set(
      parentId,
      childIds.sort((leftId, rightId) => {
        const left = nodeById.get(leftId)
        const right = nodeById.get(rightId)
        return (left?.sequence ?? 0) - (right?.sequence ?? 0)
      }),
    )
  }

  return {
    nodeById,
    childIdsByParent,
  }
}

function hashString(value: string) {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return hash
}

function getOrbitAngles(
  count: number,
  rotation: number,
) {
  if (count <= 0) {
    return []
  }

  if (count === 1) {
    return [rotation]
  }

  if (count === 2) {
    return [rotation - Math.PI / 3, rotation + Math.PI / 3]
  }

  const step = (Math.PI * 2) / count
  return Array.from({ length: count }, (_, index) => rotation + step * index)
}

function offsetBounds(bounds: GraphLayout['worldBounds'], x: number, y: number) {
  return {
    minX: bounds.minX + x,
    minY: bounds.minY + y,
    maxX: bounds.maxX + x,
    maxY: bounds.maxY + y,
    width: bounds.width,
    height: bounds.height,
  }
}

function boundsOverlap(
  left: GraphLayout['worldBounds'],
  right: GraphLayout['worldBounds'],
  padding = 0,
) {
  return !(
    left.maxX + padding < right.minX ||
    left.minX > right.maxX + padding ||
    left.maxY + padding < right.minY ||
    left.minY > right.maxY + padding
  )
}

function getGlobalClusterAnchor(
  constellation: MarkdownConstellation,
  localBounds: GraphLayout['worldBounds'],
  clusterIndex: number,
  placedBounds: GraphLayout['worldBounds'][],
) {
  if (clusterIndex === 0 && placedBounds.length === 0) {
    return { x: 0, y: 0 }
  }

  const baseSeed = hashString(`${constellation.id}:${constellation.fileName}`)
  const angleJitter = (((baseSeed % 1000) / 1000) - 0.5) * 0.22
  const radiusJitter = ((((baseSeed >>> 10) % 1000) / 1000) - 0.5) * 90
  const clusterDiameter = Math.max(localBounds.width, localBounds.height)

  for (let attempt = 0; attempt < 72; attempt += 1) {
    const spiralIndex = clusterIndex + attempt * 5
    const angle = -Math.PI / 2 + spiralIndex * GOLDEN_ANGLE + angleJitter
    const radius =
      380 +
      Math.sqrt(spiralIndex + 1) * 238 +
      clusterDiameter * 0.18 +
      attempt * 42 +
      radiusJitter
    const anchor = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    }
    const shiftedBounds = offsetBounds(localBounds, anchor.x, anchor.y)
    const overlapsExisting = placedBounds.some((bounds) =>
      boundsOverlap(shiftedBounds, bounds, GLOBAL_CLUSTER_GAP),
    )

    if (!overlapsExisting) {
      return anchor
    }
  }

  const fallbackIndex = clusterIndex + placedBounds.length * 3 + 1
  const fallbackAngle = -Math.PI / 2 + fallbackIndex * GOLDEN_ANGLE + angleJitter
  const fallbackRadius =
    520 + fallbackIndex * 190 + clusterDiameter * 0.16 + Math.abs(radiusJitter)

  return {
    x: Math.cos(fallbackAngle) * fallbackRadius,
    y: Math.sin(fallbackAngle) * fallbackRadius,
  }
}

function getOrbitRotation(
  nodeId: string,
  depth: number,
  childCount: number,
  clusterIndex: number,
) {
  if (childCount === 1) {
    if (depth === 0) {
      return 0
    }

    const seed = hashString(nodeId) % 36
    return -Math.PI / 6 + ((seed - 18) * Math.PI) / 180
  }

  const seed = hashString(nodeId) + clusterIndex * 41
  return ((seed % 360) * Math.PI) / 180 - Math.PI / 2
}

function getOrbitRadius(
  parentRadius: number,
  childCount: number,
  maxChildSubtreeRadius: number,
  depth: number,
) {
  const clearance = depth === 0 ? 94 : 72 + Math.max(0, depth - 1) * 8
  const minRadius = parentRadius + maxChildSubtreeRadius + clearance
  const circumferenceFit =
    childCount <= 1
      ? 0
      : ((maxChildSubtreeRadius * 2 + 32) * childCount) / (2 * Math.PI)

  return Math.max(minRadius, circumferenceFit)
}

function layoutConstellationLocal(
  constellation: MarkdownConstellation,
  accent: string,
  clusterIndex: number,
) {
  const rootNode = constellation.nodes.find((node) => node.isRoot) ?? constellation.nodes[0]
  if (!rootNode) {
    return {
      nodes: [] as PositionedNode[],
      edges: [] as PositionedEdge[],
      orbits: [] as OrbitBand[],
      bounds: {
        minX: -10,
        minY: -10,
        maxX: 10,
        maxY: 10,
        width: 20,
        height: 20,
      },
      anchor: { x: 0, y: 0 },
    }
  }

  const { childIdsByParent, nodeById } = createNodeMaps(constellation)
  const radiusById = new Map(
    constellation.nodes.map((node) => [node.id, getNodeRadius(node)] as const),
  )
  const subtreeRadiusMemo = new Map<string, number>()
  const placements = new Map<string, LocalPlacement>()
  const orbitBands: OrbitBand[] = []

  const calculateSubtreeRadius = (nodeId: string): number => {
    const cached = subtreeRadiusMemo.get(nodeId)
    if (typeof cached === 'number') {
      return cached
    }

    const children = childIdsByParent.get(nodeId) ?? []
    const nodeRadius = radiusById.get(nodeId) ?? 12
    if (children.length === 0) {
      const value = nodeRadius + 28
      subtreeRadiusMemo.set(nodeId, value)
      return value
    }

    const childSubtreeRadii = children.map((childId) => calculateSubtreeRadius(childId))
    const maxChildSubtreeRadius = Math.max(...childSubtreeRadii)
    const nodeDepth = nodeById.get(nodeId)?.depth ?? 0
    const orbitRadius = getOrbitRadius(
      nodeRadius,
      children.length,
      maxChildSubtreeRadius,
      nodeDepth,
    )
    const value = Math.max(nodeRadius + 34, orbitRadius + maxChildSubtreeRadius)
    subtreeRadiusMemo.set(nodeId, value)
    return value
  }

  const placeNode = (nodeId: string, x: number, y: number) => {
    const current = placements.get(nodeId) ?? {}
    placements.set(nodeId, {
      ...current,
      x,
      y,
    })

    const children = childIdsByParent.get(nodeId) ?? []
    if (children.length === 0) {
      return
    }

    const parentNode = nodeById.get(nodeId)
    const parentRadius = radiusById.get(nodeId) ?? 12
    const childSubtreeRadii = children.map((childId) => calculateSubtreeRadius(childId))
    const maxChildSubtreeRadius = Math.max(...childSubtreeRadii)
    const orbitRadius = getOrbitRadius(
      parentRadius,
      children.length,
      maxChildSubtreeRadius,
      parentNode?.depth ?? 0,
    )
    const rotation = getOrbitRotation(
      nodeId,
      parentNode?.depth ?? 0,
      children.length,
      clusterIndex,
    )
    const angles = getOrbitAngles(children.length, rotation)

    orbitBands.push({
      id: `${nodeId}::orbit`,
      constellationId: constellation.id,
      centerId: nodeId,
      centerX: x,
      centerY: y,
      radius: orbitRadius,
      depth: (parentNode?.depth ?? 0) + 1,
      nodeIds: children,
    })

    children.forEach((childId, index) => {
      const angle = angles[index] ?? 0
      const childX = x + Math.cos(angle) * orbitRadius
      const childY = y + Math.sin(angle) * orbitRadius

      placements.set(childId, {
        x: childX,
        y: childY,
        orbitCenterId: nodeId,
        orbitRadius,
      })
      placeNode(childId, childX, childY)
    })
  }

  calculateSubtreeRadius(rootNode.id)
  placeNode(rootNode.id, 0, 0)

  const nodes: PositionedNode[] = constellation.nodes.map((node) => {
    const placement = placements.get(node.id) ?? { x: 0, y: 0 }
    const radius = radiusById.get(node.id) ?? 12

    return {
      ...node,
      x: placement.x,
      y: placement.y,
      radius,
      glow: radius * 3.35,
      accent,
      clusterIndex,
      orbitCenterId: placement.orbitCenterId,
      orbitRadius: placement.orbitRadius,
    }
  })

  const nodePositionMap = new Map(nodes.map((node) => [node.id, node] as const))
  const edges: PositionedEdge[] = constellation.edges
    .filter((edge) => edge.kind === 'hierarchy')
    .map((edge) => {
      const sourceNode = nodePositionMap.get(edge.source)
      const targetNode = nodePositionMap.get(edge.target)

      if (!sourceNode || !targetNode) {
        return null
      }

      return {
        ...edge,
        sourceX: sourceNode.x,
        sourceY: sourceNode.y,
        targetX: targetNode.x,
        targetY: targetNode.y,
      }
    })
    .filter((edge): edge is PositionedEdge => Boolean(edge))

  return {
    nodes,
    edges,
    orbits: orbitBands,
    bounds: createBoundsFromNodes(nodes, 118),
    anchor: { x: 0, y: 0 },
  }
}

export function layoutConstellations(
  constellations: MarkdownConstellation[],
): GraphLayout {
  if (constellations.length === 0) {
    return {
      nodes: [],
      edges: [],
      orbits: [],
      constellations: [],
      worldBounds: {
        minX: -10,
        minY: -10,
        maxX: 10,
        maxY: 10,
        width: 20,
        height: 20,
      },
    }
  }

  const positionedNodes: PositionedNode[] = []
  const positionedEdges: PositionedEdge[] = []
  const orbitBands: OrbitBand[] = []
  const constellationLayouts: GraphLayout['constellations'] = []
  const placedBounds: GraphLayout['worldBounds'][] = []

  for (const [clusterIndex, constellation] of constellations.entries()) {
    const accent = CLUSTER_ACCENTS[clusterIndex % CLUSTER_ACCENTS.length]
    const localLayout = layoutConstellationLocal(constellation, accent, clusterIndex)
    const anchor = getGlobalClusterAnchor(
      constellation,
      localLayout.bounds,
      clusterIndex,
      placedBounds,
    )
    const offsetX = anchor.x
    const offsetY = anchor.y

    const clusterNodes = localLayout.nodes.map((node) => ({
      ...node,
      x: node.x + offsetX,
      y: node.y + offsetY,
    }))
    const clusterNodeMap = new Map(clusterNodes.map((node) => [node.id, node] as const))

    const clusterEdges = localLayout.edges.map((edge) => ({
      ...edge,
      sourceX: (clusterNodeMap.get(edge.source)?.x ?? edge.sourceX),
      sourceY: (clusterNodeMap.get(edge.source)?.y ?? edge.sourceY),
      targetX: (clusterNodeMap.get(edge.target)?.x ?? edge.targetX),
      targetY: (clusterNodeMap.get(edge.target)?.y ?? edge.targetY),
    }))

    const clusterOrbits = localLayout.orbits.map((orbit) => ({
      ...orbit,
      centerX: orbit.centerX + offsetX,
      centerY: orbit.centerY + offsetY,
    }))

    const clusterBounds = offsetBounds(localLayout.bounds, offsetX, offsetY)
    const rootNode = clusterNodes.find((node) => node.isRoot) ?? clusterNodes[0]

    constellationLayouts.push({
      id: constellation.id,
      title: constellation.title,
      accent,
      bounds: clusterBounds,
      anchor: {
        x: rootNode?.x ?? offsetX,
        y: rootNode?.y ?? offsetY,
      },
      nodeIds: clusterNodes.map((node) => node.id),
    })

    positionedNodes.push(...clusterNodes)
    positionedEdges.push(...clusterEdges)
    orbitBands.push(...clusterOrbits)
    placedBounds.push(clusterBounds)
  }

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    orbits: orbitBands,
    constellations: constellationLayouts,
    worldBounds: createBoundsFromNodes(positionedNodes, 132),
  }
}
