import type {
  KnowledgeNode,
  MarkdownConstellation,
  PositionedNode,
} from '../../../shared/types/knowledge.ts'
import { createBoundsFromNodes } from './graph-geometry.ts'

export interface ProgressiveVisibilityResult {
  constellations: MarkdownConstellation[]
  focusNodeIds: Set<string>
  visibleNodeIds: Set<string>
}

function getRootNode(constellation: MarkdownConstellation) {
  return constellation.nodes.find((node) => node.isRoot) ?? constellation.nodes[0] ?? null
}

function createNodeMap(constellations: MarkdownConstellation[]) {
  return new Map(
    constellations.flatMap((constellation) =>
      constellation.nodes.map((node) => [node.id, node] as const),
    ),
  )
}

function addIds(
  collection: Set<string>,
  nodeById: Map<string, KnowledgeNode>,
  ids: Iterable<string>,
) {
  for (const id of ids) {
    if (nodeById.has(id)) {
      collection.add(id)
    }
  }
}

function addRootAndFirstLevel(
  collection: Set<string>,
  nodeById: Map<string, KnowledgeNode>,
  constellation: MarkdownConstellation,
) {
  const rootNode = getRootNode(constellation)
  if (!rootNode) {
    return
  }

  collection.add(rootNode.id)
  addIds(collection, nodeById, rootNode.childIds)
}

function addAncestors(
  collection: Set<string>,
  nodeById: Map<string, KnowledgeNode>,
  node: KnowledgeNode,
) {
  let current: KnowledgeNode | undefined = node

  while (current) {
    collection.add(current.id)
    current = current.parentId ? nodeById.get(current.parentId) : undefined
  }
}

function addSiblings(
  collection: Set<string>,
  nodeById: Map<string, KnowledgeNode>,
  node: KnowledgeNode,
) {
  if (!node.parentId) {
    collection.add(node.id)
    return
  }

  const parentNode = nodeById.get(node.parentId)
  if (!parentNode) {
    collection.add(node.id)
    return
  }

  addIds(collection, nodeById, parentNode.childIds)
}

function filterConstellation(
  constellation: MarkdownConstellation,
  visibleNodeIds: Set<string>,
): MarkdownConstellation {
  const nodes = constellation.nodes.filter((node) => visibleNodeIds.has(node.id))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = constellation.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  )

  return {
    ...constellation,
    nodes,
    edges,
  }
}

export function buildProgressiveVisibility(
  constellations: MarkdownConstellation[],
  selectedNodeId: string | null,
  showAllNodes: boolean,
): ProgressiveVisibilityResult {
  const nodeById = createNodeMap(constellations)

  if (showAllNodes) {
    return {
      constellations,
      visibleNodeIds: new Set(nodeById.keys()),
      focusNodeIds: new Set(),
    }
  }

  const visibleNodeIds = new Set<string>()
  for (const constellation of constellations) {
    addRootAndFirstLevel(visibleNodeIds, nodeById, constellation)
  }

  const focusNodeIds = new Set<string>()
  if (selectedNodeId) {
    const selectedNode = nodeById.get(selectedNodeId)
    if (selectedNode) {
      addAncestors(visibleNodeIds, nodeById, selectedNode)
      addSiblings(visibleNodeIds, nodeById, selectedNode)
      addIds(visibleNodeIds, nodeById, selectedNode.childIds)

      const selectedConstellation = constellations.find(
        (constellation) => constellation.id === selectedNode.constellationId,
      )
      if (selectedConstellation) {
        addRootAndFirstLevel(focusNodeIds, nodeById, selectedConstellation)
      }
      addAncestors(focusNodeIds, nodeById, selectedNode)
      addSiblings(focusNodeIds, nodeById, selectedNode)
      addIds(focusNodeIds, nodeById, selectedNode.childIds)
    }
  }

  return {
    constellations: constellations.map((constellation) =>
      filterConstellation(constellation, visibleNodeIds),
    ),
    visibleNodeIds,
    focusNodeIds,
  }
}

export function createSelectionFocusBounds(
  nodes: PositionedNode[],
  focusNodeIds: Set<string>,
  selectedNodeId: string,
) {
  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  if (!selectedNode) {
    return null
  }

  const focusNodes = nodes.filter((node) => focusNodeIds.has(node.id))
  const points = focusNodes.length > 0 ? focusNodes : [selectedNode]

  return createBoundsFromNodes(points, selectedNode.isRoot ? 170 : 130)
}
