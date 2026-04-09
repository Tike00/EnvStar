import { unified } from 'unified'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { visit } from 'unist-util-visit'
import { buildDocumentId, compactText, slugify } from '../../../shared/lib/text.ts'
import type {
  CodeSnippet,
  KnowledgeEdge,
  KnowledgeNode,
  MarkdownConstellation,
  RawMarkdownDocument,
} from '../../../shared/types/knowledge.ts'

interface MarkdownNode {
  type: string
  depth?: number
  value?: string
  lang?: string | null
  alt?: string | null
  children?: MarkdownNode[]
}

interface HeadingSlice {
  title: string
  depth: number
  sequence: number
  contentMarkdown: string
  contentNodes: MarkdownNode[]
}

const markdownParser = unified().use(remarkParse).use(remarkGfm)
const markdownStringifier = unified().use(remarkStringify, {
  fences: true,
  bullet: '-',
  listItemIndent: 'one',
})

function extractText(node: MarkdownNode | null | undefined): string {
  if (!node) {
    return ''
  }

  if (typeof node.value === 'string') {
    return node.value
  }

  if (typeof node.alt === 'string') {
    return node.alt
  }

  if (node.children && node.children.length > 0) {
    return node.children.map((child) => extractText(child)).join('')
  }

  return ''
}

function stringifyMarkdown(children: MarkdownNode[]): string {
  const result = markdownStringifier.stringify({
    type: 'root',
    children,
  } as never)

  return result.trim()
}

function collectCodeSnippets(contentNodes: MarkdownNode[]): CodeSnippet[] {
  const snippets: CodeSnippet[] = []
  const root = { type: 'root', children: contentNodes } as MarkdownNode

  visit(root as never, 'code', (node) => {
    const codeNode = node as MarkdownNode
    const language = codeNode.lang?.trim().toLowerCase() ?? 'plain'
    const value = codeNode.value?.trim() ?? ''

    if (!value) {
      return
    }

    const isCommand =
      ['bash', 'shell', 'sh', 'zsh', 'cmd', 'powershell', 'plain'].includes(
        language,
      ) || /\b(?:curl|npm|pnpm|php|python|bash|gcc|ls|cat|whoami|mail)\b/i.test(value)

    snippets.push({
      language,
      value,
      isCommand,
    })
  })

  return snippets
}

function collectFirstParagraph(contentNodes: MarkdownNode[]): string {
  const firstParagraph = contentNodes.find((node) => node.type === 'paragraph')
  if (!firstParagraph) {
    return ''
  }

  return compactText(extractText(firstParagraph)).slice(0, 180)
}

function buildHeadingSlices(root: MarkdownNode): HeadingSlice[] {
  const children = root.children ?? []
  const headingIndexes = children
    .map((node, index) => ({ node, index }))
    .filter(
      (entry): entry is { node: MarkdownNode & { depth: number }; index: number } =>
        entry.node.type === 'heading' && typeof entry.node.depth === 'number',
    )

  return headingIndexes.map(({ node, index }, sequence) => {
    const nextBoundary =
      headingIndexes.find(
        (candidate) =>
          candidate.index > index &&
          typeof candidate.node.depth === 'number' &&
          candidate.node.depth <= node.depth,
      )?.index ?? children.length

    const contentNodes = children.slice(index + 1, nextBoundary)

    return {
      title: compactText(extractText(node)),
      depth: node.depth,
      sequence,
      contentMarkdown: stringifyMarkdown(contentNodes),
      contentNodes,
    }
  })
}

function createRootDetailMarkdown(
  document: RawMarkdownDocument,
  headingSlices: HeadingSlice[],
  codeBlockCount: number,
  maxDepth: number,
) {
  if (headingSlices.length === 0) {
    return document.markdown.trim()
  }

  const topLevelHeadings = headingSlices
    .filter((slice) => slice.depth === Math.min(...headingSlices.map((item) => item.depth)))
    .map((slice) => `- ${slice.title}`)

  return [
    `# ${document.name}`,
    '',
    '## 文件概览',
    `- 标题节点：${headingSlices.length}`,
    `- 代码块：${codeBlockCount}`,
    `- 最大层级：${maxDepth}`,
    '',
    '## 顶层星区',
    ...topLevelHeadings,
  ]
    .filter(Boolean)
    .join('\n')
}

export function parseMarkdownDocument(
  document: RawMarkdownDocument,
): MarkdownConstellation {
  const root = markdownParser.parse(document.markdown) as MarkdownNode
  const headingSlices = buildHeadingSlices(root)
  const minDepth =
    headingSlices.length > 0
      ? Math.min(...headingSlices.map((slice) => slice.depth))
      : 1

  let codeBlockCount = 0
  visit(root as never, 'code', () => {
    codeBlockCount += 1
  })

  const constellationId = buildDocumentId(document.name, document.markdown)
  const rootId = `${constellationId}::root`

  const nodes: KnowledgeNode[] = []
  const edges: KnowledgeEdge[] = []
  const parentStack = [rootId]
  const childIdsByParent = new Map<string, string[]>()
  const relatedMap = new Map<string, Set<string>>()
  const nodeById = new Map<string, KnowledgeNode>()

  const rootNode: KnowledgeNode = {
    id: rootId,
    constellationId,
    fileName: document.name,
    title: document.name,
    depth: 0,
    rawDepth: 0,
    parentId: undefined,
    sequence: -1,
    pathTitles: [document.name],
    detailMarkdown: createRootDetailMarkdown(
      document,
      headingSlices,
      codeBlockCount,
      headingSlices.length > 0
        ? Math.max(...headingSlices.map((slice) => slice.depth - minDepth + 1))
        : 0,
    ),
    summary:
      headingSlices.length > 0
        ? `${headingSlices.length} 个标题节点 · ${codeBlockCount} 个代码块`
        : '无标题结构，展示全文内容',
    tags: ['文件节点', '根节点', document.name],
    relatedNodeIds: [],
    childIds: [],
    codeSnippets: [],
    commandExamples: [],
    descendantCount: 0,
    importance: 12,
    isRoot: true,
  }

  nodes.push(rootNode)
  nodeById.set(rootId, rootNode)
  relatedMap.set(rootId, new Set<string>())

  for (const slice of headingSlices) {
    const normalizedDepth = slice.depth - minDepth + 1
    while (parentStack.length > normalizedDepth) {
      parentStack.pop()
    }

    const parentId = parentStack[parentStack.length - 1] ?? rootId
    const parentNode = nodeById.get(parentId) ?? rootNode
    const nodeId = `${constellationId}::${slugify(slice.title)}-${slice.sequence.toString(36)}`
    const codeSnippets = collectCodeSnippets(slice.contentNodes)
    const summary =
      collectFirstParagraph(slice.contentNodes) ||
      (codeSnippets[0]?.value.slice(0, 120) ?? '点击查看完整记录')

    const node: KnowledgeNode = {
      id: nodeId,
      constellationId,
      fileName: document.name,
      title: slice.title,
      depth: normalizedDepth,
      rawDepth: slice.depth,
      parentId,
      sequence: slice.sequence,
      pathTitles: [...parentNode.pathTitles, slice.title],
      detailMarkdown: slice.contentMarkdown,
      summary,
      tags: [document.name, `层级 L${normalizedDepth}`, parentNode.title].filter(Boolean),
      relatedNodeIds: [],
      childIds: [],
      codeSnippets,
      commandExamples: codeSnippets
        .filter((snippet) => snippet.isCommand)
        .map((snippet) => snippet.value)
        .slice(0, 3),
      descendantCount: 0,
      importance: Math.max(2, 8 - normalizedDepth),
      isRoot: false,
    }

    nodes.push(node)
    nodeById.set(nodeId, node)
    relatedMap.set(nodeId, new Set<string>())

    childIdsByParent.set(parentId, [
      ...(childIdsByParent.get(parentId) ?? []),
      nodeId,
    ])

    const hierarchyEdge: KnowledgeEdge = {
      id: `${parentId}=>${nodeId}`,
      constellationId,
      source: parentId,
      target: nodeId,
      kind: 'hierarchy',
    }

    edges.push(hierarchyEdge)
    relatedMap.get(parentId)?.add(nodeId)
    relatedMap.get(nodeId)?.add(parentId)

    parentStack[normalizedDepth] = nodeId
    parentStack.length = normalizedDepth + 1
  }

  for (const siblingIds of childIdsByParent.values()) {
    for (let index = 0; index < siblingIds.length - 1; index += 1) {
      const source = siblingIds[index]
      const target = siblingIds[index + 1]
      edges.push({
        id: `${source}<->${target}`,
        constellationId,
        source,
        target,
        kind: 'related',
      })
      relatedMap.get(source)?.add(target)
      relatedMap.get(target)?.add(source)
    }
  }

  const computeDescendants = (nodeId: string): number => {
    const children = childIdsByParent.get(nodeId) ?? []
    let total = children.length
    for (const childId of children) {
      total += computeDescendants(childId)
    }

    const node = nodeById.get(nodeId)
    if (node) {
      node.descendantCount = total
      if (!node.isRoot) {
        node.importance =
          Math.max(2.2, 8.4 - node.depth * 1.05) +
          Math.min(2.6, total * 0.24) +
          Math.min(2.2, node.detailMarkdown.length / 520)
      }
      node.childIds = children
    }

    return total
  }

  computeDescendants(rootId)

  for (const node of nodes) {
    node.relatedNodeIds = Array.from(relatedMap.get(node.id) ?? [])
  }

  rootNode.codeSnippets = nodes.flatMap((node) => node.codeSnippets).slice(0, 6)
  rootNode.commandExamples = rootNode.codeSnippets
    .filter((snippet) => snippet.isCommand)
    .map((snippet) => snippet.value)
    .slice(0, 4)

  return {
    id: constellationId,
    fileName: document.name,
    title: document.name,
    importedAt: document.importedAt,
    source: document.source,
    rawMarkdown: document.markdown,
    nodes,
    edges,
    stats: {
      headingCount: headingSlices.length,
      codeBlockCount,
      maxDepth:
        headingSlices.length > 0
          ? Math.max(...headingSlices.map((slice) => slice.depth - minDepth + 1))
          : 0,
    },
  }
}
