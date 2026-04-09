import { describe, expect, it } from 'vitest'
import { parseMarkdownDocument } from '../../markdown/lib/parse-markdown.ts'
import { searchKnowledgeNodes } from './search-knowledge.ts'
import type { RawMarkdownDocument } from '../../../shared/types/knowledge.ts'

function createDocument(name: string, markdown: string): RawMarkdownDocument {
  return {
    id: `${name}-search-test`,
    name,
    markdown,
    importedAt: '2026-04-07T00:00:00+08:00',
    source: 'sample',
  }
}

describe('searchKnowledgeNodes', () => {
  const constellation = parseMarkdownDocument(
    createDocument(
      'commands.md',
      [
        '# 文件读取',
        '',
        '## 读取命令',
        '',
        '使用 `more` 和 `less` 查看文件内容。',
        '',
        '```bash',
        'less /etc/passwd',
        '```',
        '',
        '## 写入命令',
        '',
        '使用 `tee` 将结果写入文件。',
      ].join('\n'),
    ),
  )

  it('matches titles and body content together', () => {
    const results = searchKnowledgeNodes([constellation], '读取 more', 5)

    expect(results[0]?.node.title).toBe('读取命令')
    expect(results[0]?.snippet).toContain('more')
  })

  it('prefers title matches over content-only matches when the keyword appears in both places', () => {
    const contentHeavy = parseMarkdownDocument(
      createDocument(
        'mix.md',
        [
          '# 观察记录',
          '',
          '## 文件分析',
          '',
          '这里多次提到 shell shell shell，用于正文命中。',
          '',
          '## Shell 节点',
          '',
          '用于标题命中。',
        ].join('\n'),
      ),
    )

    const results = searchKnowledgeNodes([contentHeavy], 'shell', 5)

    expect(results[0]?.node.title).toBe('Shell 节点')
  })

  it('returns an empty list for blank queries', () => {
    expect(searchKnowledgeNodes([constellation], '   ', 5)).toEqual([])
  })
})
