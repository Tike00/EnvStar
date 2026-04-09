import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { KnowledgeNode } from '../../../shared/types/knowledge.ts'
import { MarkdownContent } from './markdown-content.tsx'

interface NodeDetailDrawerProps {
  node: KnowledgeNode | null
  onClose: () => void
  onSelectNode: (nodeId: string) => void
  relatedNodes: KnowledgeNode[]
}

export function NodeDetailDrawer({
  node,
  onClose,
  onSelectNode,
  relatedNodes,
}: NodeDetailDrawerProps) {
  return (
    <AnimatePresence>
      {node ? (
        <motion.aside
          key={node.id}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 28 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="pointer-events-auto fixed inset-x-4 bottom-4 z-30 rounded-[2rem] border border-white/8 bg-[rgba(19,13,34,0.82)] shadow-[0_30px_120px_rgba(0,0,0,0.4)] backdrop-blur-2xl lg:inset-x-auto lg:right-4 lg:top-4 lg:bottom-4 lg:w-[344px]"
        >
          <div className="flex h-full flex-col overflow-hidden rounded-[2rem]">
            <div className="flex items-start justify-between gap-3 border-b border-white/6 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">
                  {node.fileName}
                </p>
                <h2 className="mt-1.5 text-[1.15rem] font-semibold text-white">{node.title}</h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/4 text-white transition hover:border-violet-200/16 hover:bg-white/8"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex justify-end px-4">
              <Link
                to={`/constellation/${node.constellationId}/node/${node.id}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-violet-200/16 bg-violet-400/12 px-3.5 py-2.5 text-sm font-medium text-violet-50 transition hover:border-violet-200/26 hover:bg-violet-400/18"
              >
                进入详情页
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-2 flex-1 overflow-y-auto px-4 pb-4">
              <div className="rounded-[1.5rem] border border-white/6 bg-slate-950/46 px-4 py-4">
                <div className="mb-3 text-xs uppercase tracking-[0.28em] text-violet-200/65">
                  Markdown 内容
                </div>
                <MarkdownContent markdown={node.detailMarkdown || '_暂无正文内容_'} />
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-white/6 bg-white/4 px-4 py-3">
                <div className="mb-3 text-xs uppercase tracking-[0.28em] text-violet-200/65">
                  关联分支
                </div>
                <div className="flex flex-wrap gap-2">
                  {relatedNodes.map((relatedNode) => (
                    <button
                      key={relatedNode.id}
                      type="button"
                      onClick={() => onSelectNode(relatedNode.id)}
                      className="rounded-full border border-white/8 bg-slate-950/55 px-3 py-1.5 text-xs text-slate-100 transition hover:border-violet-200/18 hover:bg-violet-400/10"
                    >
                      {relatedNode.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
