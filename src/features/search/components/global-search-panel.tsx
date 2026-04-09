import { AnimatePresence, motion } from 'motion/react'
import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../../shared/lib/cn.ts'
import type { KnowledgeSearchResult } from '../lib/search-knowledge.ts'

interface GlobalSearchPanelProps {
  isOpen: boolean
  query: string
  results: KnowledgeSearchResult[]
  selectedNodeId: string | null
  onClose: () => void
  onOpen: () => void
  onQueryChange: (value: string) => void
  onSelectResult: (result: KnowledgeSearchResult) => void
}

const MATCH_LABELS: Record<KnowledgeSearchResult['matchedField'], string> = {
  title: '标题',
  path: '路径',
  file: '文件',
  tag: '标签',
  command: '命令',
  summary: '摘要',
  content: '正文',
}

export function GlobalSearchPanel({
  isOpen,
  query,
  results,
  selectedNodeId,
  onClose,
  onOpen,
  onQueryChange,
  onSelectResult,
}: GlobalSearchPanelProps) {
  const trimmedQuery = query.trim()
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const overlay =
    typeof document === 'undefined'
      ? null
      : createPortal(
          <AnimatePresence>
            {isOpen ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(6,4,16,0.44)] px-4 py-8 backdrop-blur-md"
                onClick={onClose}
              >
                <motion.div
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="glass-panel w-full max-w-3xl rounded-[2rem] border border-white/8 bg-[rgba(21,14,39,0.74)] p-4 shadow-[0_40px_140px_rgba(0,0,0,0.38)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center gap-3 rounded-[1.3rem] border border-white/8 bg-white/5 px-4 py-3 transition focus-within:border-violet-200/18 focus-within:bg-white/8">
                    <Search className="h-4 w-4 shrink-0 text-violet-200" />
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(event) => onQueryChange(event.target.value)}
                      placeholder="搜索标题、正文、命令、标签..."
                      className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                    />
                    {trimmedQuery ? (
                      <button
                        type="button"
                        onClick={() => onQueryChange('')}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
                        aria-label="清空搜索"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-[1.4rem] border border-white/6 bg-slate-950/42 p-3">
                    <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                      <span>{trimmedQuery ? '全局搜索结果' : '输入关键词开始搜索'}</span>
                      <span>{trimmedQuery ? `${results.length} 项` : '支持标题 / 正文 / 命令 / 标签'}</span>
                    </div>

                    {trimmedQuery ? (
                      results.length > 0 ? (
                        <div className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                          {results.map((result) => (
                            <button
                              key={result.node.id}
                              type="button"
                              onClick={() => onSelectResult(result)}
                              className={cn(
                                'w-full rounded-[1rem] border px-3 py-3 text-left transition',
                                result.node.id === selectedNodeId
                                  ? 'border-violet-200/18 bg-violet-400/10'
                                  : 'border-white/6 bg-white/4 hover:border-violet-200/14 hover:bg-white/7',
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-white">
                                    {result.node.title}
                                  </div>
                                  <div className="mt-1 truncate text-[11px] text-slate-400">
                                    {result.node.fileName} · {result.node.pathTitles.join(' / ')}
                                  </div>
                                </div>
                                <span className="shrink-0 rounded-full border border-violet-200/12 bg-violet-400/10 px-2 py-0.5 text-[10px] text-violet-50">
                                  {MATCH_LABELS[result.matchedField]}
                                </span>
                              </div>

                              {result.snippet ? (
                                <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-slate-300">
                                  {result.snippet}
                                </p>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-[1rem] border border-dashed border-white/8 bg-white/4 px-3 py-4 text-[12px] leading-6 text-slate-400">
                          没有找到匹配节点。可以试试标题关键词、命令名或正文里的关键句。
                        </div>
                      )
                    ) : (
                      <div className="mt-3 rounded-[1rem] border border-dashed border-white/8 bg-white/4 px-3 py-4 text-[12px] leading-6 text-slate-400">
                        会在所有已加载的 Markdown 星系里同时匹配标题、标签、命令和正文内容。
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2 rounded-[1rem] border border-white/8 bg-white/4 px-3 py-2.5 text-left text-slate-200 transition hover:border-violet-200/16 hover:bg-white/7"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-violet-200" />
        <span className={cn('min-w-0 flex-1 truncate text-sm', !trimmedQuery && 'text-slate-500')}>
          {trimmedQuery || '搜索标题、正文、命令...'}
        </span>
        {trimmedQuery ? (
          <span className="rounded-full border border-violet-200/12 bg-violet-400/10 px-2 py-0.5 text-[10px] text-violet-50">
            {results.length}
          </span>
        ) : null}
      </button>
      {overlay}
    </>
  )
}
