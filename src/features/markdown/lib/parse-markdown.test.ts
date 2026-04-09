import { describe, expect, it } from 'vitest'
import { parseMarkdownDocument } from './parse-markdown.ts'
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

describe('parseMarkdownDocument', () => {
  it('ignores hash signs inside fenced code blocks', () => {
    const constellation = parseMarkdownDocument(
      createDocument(
        'code-fence.md',
        [
          '## 外层标题',
          '',
          '```bash',
          '# 这里不是标题',
          'echo demo',
          '```',
          '',
          '### 子标题',
          '',
          '正文内容',
        ].join('\n'),
      ),
    )

    expect(constellation.nodes.map((node) => node.title)).toEqual([
      'code-fence.md',
      '外层标题',
      '子标题',
    ])
  })

  it('generates stable unique ids for duplicate headings', () => {
    const constellation = parseMarkdownDocument(
      createDocument(
        'duplicate.md',
        [
          '# 根标题',
          '',
          '## 重复标题',
          '',
          '内容 A',
          '',
          '## 重复标题',
          '',
          '内容 B',
        ].join('\n'),
      ),
    )

    const duplicateNodes = constellation.nodes.filter((node) => node.title === '重复标题')
    expect(duplicateNodes).toHaveLength(2)
    expect(new Set(duplicateNodes.map((node) => node.id)).size).toBe(2)
  })

  it('keeps a single root node when markdown has no headings', () => {
    const markdown = [
      '只是普通正文',
      '',
      '```ts',
      '# 依旧不是标题',
      'console.log("envstar")',
      '```',
    ].join('\n')

    const constellation = parseMarkdownDocument(createDocument('plain.md', markdown))

    expect(constellation.nodes).toHaveLength(1)
    expect(constellation.nodes[0]?.title).toBe('plain.md')
    expect(constellation.nodes[0]?.detailMarkdown).toContain('只是普通正文')
  })
})
