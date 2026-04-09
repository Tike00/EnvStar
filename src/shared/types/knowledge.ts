export interface RawMarkdownDocument {
  id: string
  name: string
  markdown: string
  importedAt: string
  source: 'sample' | 'upload' | 'restored'
}

export interface CodeSnippet {
  language: string
  value: string
  isCommand: boolean
}

export interface KnowledgeNode {
  id: string
  constellationId: string
  fileName: string
  title: string
  depth: number
  rawDepth: number
  parentId?: string
  sequence: number
  pathTitles: string[]
  detailMarkdown: string
  summary: string
  tags: string[]
  relatedNodeIds: string[]
  childIds: string[]
  codeSnippets: CodeSnippet[]
  commandExamples: string[]
  descendantCount: number
  importance: number
  isRoot: boolean
}

export interface KnowledgeEdge {
  id: string
  constellationId: string
  source: string
  target: string
  kind: 'hierarchy' | 'related'
}

export interface MarkdownConstellation {
  id: string
  fileName: string
  title: string
  importedAt: string
  source: RawMarkdownDocument['source']
  rawMarkdown: string
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  stats: {
    headingCount: number
    codeBlockCount: number
    maxDepth: number
  }
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export interface PositionedNode extends KnowledgeNode {
  x: number
  y: number
  radius: number
  glow: number
  accent: string
  clusterIndex: number
  orbitCenterId?: string
  orbitRadius?: number
}

export interface PositionedEdge extends KnowledgeEdge {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

export interface ConstellationLayout {
  id: string
  title: string
  accent: string
  bounds: Bounds
  anchor: {
    x: number
    y: number
  }
  nodeIds: string[]
}

export interface OrbitBand {
  id: string
  constellationId: string
  centerId: string
  centerX: number
  centerY: number
  radius: number
  depth: number
  nodeIds: string[]
}

export interface GraphLayout {
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  orbits: OrbitBand[]
  constellations: ConstellationLayout[]
  worldBounds: Bounds
}

export interface ViewportState {
  x: number
  y: number
  scale: number
}
