import type {
  KnowledgeNode,
  MarkdownConstellation,
} from '../../../shared/types/knowledge.ts'

export type SearchMatchedField =
  | 'title'
  | 'path'
  | 'file'
  | 'tag'
  | 'command'
  | 'summary'
  | 'content'

export interface KnowledgeSearchResult {
  node: KnowledgeNode
  score: number
  snippet: string
  matchedField: SearchMatchedField
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function stripMarkdown(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) =>
      block
        .replace(/```/g, ' ')
        .replace(/\r?\n/g, ' ')
        .trim(),
    )
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[>*+-]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) {
    return 0
  }

  let count = 0
  let index = haystack.indexOf(needle)
  while (index >= 0) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

function scoreField(
  normalizedValue: string,
  terms: string[],
  baseScore: number,
) {
  let score = 0
  let matchedTerms = 0

  for (const term of terms) {
    if (!normalizedValue.includes(term)) {
      continue
    }

    matchedTerms += 1
    score += baseScore

    if (normalizedValue.startsWith(term)) {
      score += 14
    }

    if (normalizedValue === term) {
      score += 28
    }

    score += Math.min(12, countOccurrences(normalizedValue, term) * 3)
  }

  return {
    matchedTerms,
    score,
  }
}

function buildSnippet(text: string, normalizedQuery: string) {
  const cleanText = stripMarkdown(text)
  if (!cleanText) {
    return ''
  }

  const normalizedText = cleanText.toLowerCase()
  const matchIndex = normalizedText.indexOf(normalizedQuery)
  if (matchIndex < 0) {
    return cleanText.length > 120 ? `${cleanText.slice(0, 120)}...` : cleanText
  }

  const start = Math.max(0, matchIndex - 42)
  const end = Math.min(cleanText.length, matchIndex + normalizedQuery.length + 78)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < cleanText.length ? '...' : ''

  return `${prefix}${cleanText.slice(start, end).trim()}${suffix}`
}

function createSearchCorpus(node: KnowledgeNode) {
  const plainContent = stripMarkdown(node.detailMarkdown)
  return {
    title: node.title,
    path: node.pathTitles.join(' / '),
    file: node.fileName,
    tag: node.tags.join(' '),
    command: node.commandExamples.join(' '),
    summary: node.summary,
    content: plainContent,
    combined: normalizeText(
      [
        node.title,
        node.fileName,
        node.pathTitles.join(' '),
        node.tags.join(' '),
        node.commandExamples.join(' '),
        node.summary,
        plainContent,
      ].join(' '),
    ),
  }
}

export function searchKnowledgeNodes(
  constellations: MarkdownConstellation[],
  query: string,
  limit = 10,
): KnowledgeSearchResult[] {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) {
    return []
  }

  const terms = normalizedQuery.split(' ').filter(Boolean)
  if (terms.length === 0) {
    return []
  }

  const results: KnowledgeSearchResult[] = []

  for (const constellation of constellations) {
    for (const node of constellation.nodes) {
      const corpus = createSearchCorpus(node)
      if (!terms.every((term) => corpus.combined.includes(term))) {
        continue
      }

      const fieldScores: Array<{
        field: SearchMatchedField
        matchedTerms: number
        score: number
      }> = [
        { field: 'title', ...scoreField(normalizeText(corpus.title), terms, 130) },
        { field: 'path', ...scoreField(normalizeText(corpus.path), terms, 96) },
        { field: 'file', ...scoreField(normalizeText(corpus.file), terms, 88) },
        { field: 'tag', ...scoreField(normalizeText(corpus.tag), terms, 74) },
        { field: 'command', ...scoreField(normalizeText(corpus.command), terms, 60) },
        { field: 'summary', ...scoreField(normalizeText(corpus.summary), terms, 52) },
        { field: 'content', ...scoreField(normalizeText(corpus.content), terms, 38) },
      ]

      const bestField =
        fieldScores
          .filter((entry) => entry.matchedTerms > 0)
          .sort((left, right) => right.score - left.score)[0] ?? null

      if (!bestField) {
        continue
      }

      const snippetSource =
        bestField.field === 'title'
          ? `${node.title} ${node.summary || corpus.content}`
          : bestField.field === 'path'
            ? `${node.pathTitles.join(' / ')} ${node.summary || corpus.content}`
            : bestField.field === 'file'
              ? `${node.fileName} ${node.summary || corpus.content}`
              : bestField.field === 'tag'
                ? `${node.tags.join(' ')} ${node.summary || corpus.content}`
                : bestField.field === 'command'
                  ? `${node.commandExamples.join(' ')} ${node.summary || corpus.content}`
                  : bestField.field === 'summary'
                    ? node.summary || corpus.content
                    : node.detailMarkdown

      results.push({
        node,
        score:
          bestField.score +
          Math.max(0, 16 - node.depth * 2) +
          Math.min(24, node.importance * 1.6),
        snippet: buildSnippet(snippetSource, normalizedQuery),
        matchedField: bestField.field,
      })
    }
  }

  return results
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (left.node.depth !== right.node.depth) {
        return left.node.depth - right.node.depth
      }

      return left.node.title.localeCompare(right.node.title)
    })
    .slice(0, limit)
}
