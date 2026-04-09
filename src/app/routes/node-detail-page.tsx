import { motion } from 'motion/react'
import { ArrowLeft, Orbit, Telescope } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useKnowledgeStore } from '../providers/knowledge-store.tsx'
import { MarkdownContent } from '../../features/node-detail/components/markdown-content.tsx'
import { cn } from '../../shared/lib/cn.ts'

export function NodeDetailPage() {
  const navigate = useNavigate()
  const { constellationId, nodeId } = useParams()
  const { constellations } = useKnowledgeStore()

  const constellation = constellations.find((item) => item.id === constellationId) ?? null
  const node = constellation?.nodes.find((item) => item.id === nodeId) ?? null
  const relatedNodes = node
    ? node.relatedNodeIds
        .map((relatedNodeId) => constellation?.nodes.find((item) => item.id === relatedNodeId) ?? null)
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : []

  if (!constellation || !node) {
    return (
      <div className="cosmos-shell flex min-h-screen items-center justify-center p-6">
        <div className="glass-panel max-w-2xl rounded-[2rem] p-8 text-center">
          <Telescope className="mx-auto h-8 w-8 text-cyan-300" />
          <h1 className="mt-4 text-3xl font-semibold text-white">节点详情不存在</h1>
          <p className="mt-3 text-slate-300">
            当前路由对应的星体还没有被导入本地。返回星图后重新加载示例或继续上传 Markdown 即可。
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-medium text-cyan-50 transition hover:border-cyan-200/40 hover:bg-cyan-300/15"
          >
            回到星图
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmos-shell relative min-h-screen overflow-hidden px-4 py-6 md:px-6 xl:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(81,166,255,0.14),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(87,243,255,0.1),transparent_25%),linear-gradient(180deg,rgba(3,9,16,0.96),rgba(2,5,10,1))]" />

      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel sticky top-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] px-4 py-4 md:px-6"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:border-cyan-300/30 hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.36em] text-cyan-200/65">
                {constellation.fileName}
              </p>
              <h1 className="mt-1 text-xl font-semibold text-white md:text-2xl">
                {node.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to={`/?constellation=${constellation.id}&node=${node.id}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-300/30 hover:bg-white/10"
            >
              <Orbit className="h-4 w-4 text-cyan-300" />
              返回节点视角
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
        >
          <article className="glass-panel rounded-[2rem] px-6 py-8 md:px-8 md:py-10">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">
                  {node.pathTitles.join(' / ')}
                </p>
                <h2 className="mt-4 text-4xl font-semibold text-white">{node.title}</h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                  {node.summary}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/4 px-4 py-4 text-sm text-slate-300">
                <div>层级：L{node.depth}</div>
                <div className="mt-2">子节点：{node.childIds.length}</div>
                <div className="mt-2">相关节点：{node.relatedNodeIds.length}</div>
              </div>
            </div>

            <div className="mb-8 flex flex-wrap gap-2">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-cyan-300/12 bg-cyan-400/8 px-3 py-1 text-xs font-medium text-cyan-50"
                >
                  {tag}
                </span>
              ))}
            </div>

            <MarkdownContent markdown={node.detailMarkdown || '_暂无正文内容_'} />
          </article>

          <aside className="space-y-4">
            <div className="glass-panel rounded-[1.75rem] px-5 py-5">
              <h3 className="text-lg font-semibold text-white">关联节点</h3>
              <div className="mt-4 flex flex-col gap-3">
                {relatedNodes.length > 0 ? (
                  relatedNodes.map((relatedNode) => (
                    <Link
                      key={relatedNode.id}
                      to={`/constellation/${constellation.id}/node/${relatedNode.id}`}
                      className={cn(
                        'rounded-[1.25rem] border border-white/10 bg-white/4 px-4 py-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-400/8',
                        relatedNode.id === node.id && 'border-cyan-300/30 bg-cyan-400/10',
                      )}
                    >
                      <div className="text-sm font-medium text-white">{relatedNode.title}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {relatedNode.summary}
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">当前节点没有更多直连分支。</p>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-[1.75rem] px-5 py-5">
              <h3 className="text-lg font-semibold text-white">命令与代码片段</h3>
              <div className="mt-4 space-y-3">
                {node.codeSnippets.slice(0, 4).map((snippet, index) => (
                  <div
                    key={`${snippet.language}-${index.toString()}`}
                    className="rounded-[1.25rem] border border-white/8 bg-slate-950/70 px-4 py-4"
                  >
                    <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">
                      {snippet.language}
                    </div>
                    <pre className="overflow-x-auto text-xs leading-6 text-slate-200">
                      <code>{snippet.value}</code>
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </motion.div>
      </div>
    </div>
  )
}
