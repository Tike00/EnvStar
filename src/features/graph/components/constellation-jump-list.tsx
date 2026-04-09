import { Orbit, Sparkles, X } from 'lucide-react'
import type { MarkdownConstellation } from '../../../shared/types/knowledge.ts'
import { cn } from '../../../shared/lib/cn.ts'

interface ConstellationJumpListProps {
  constellations: MarkdownConstellation[]
  activeConstellationId: string | null
  onJump: (constellationId: string) => void
  onRemove: (constellationId: string) => void
}

export function ConstellationJumpList({
  activeConstellationId,
  constellations,
  onJump,
  onRemove,
}: ConstellationJumpListProps) {
  return (
    <div className="glass-panel flex min-h-0 flex-col rounded-[1.75rem] px-4 py-4">
      <div className="flex shrink-0 items-center gap-2 text-white">
        <Sparkles className="h-4 w-4 text-violet-200" />
        <span className="font-medium">Markdown 星空导航</span>
      </div>

      <div className="mt-4 flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        {constellations.map((constellation) => (
          <div
            key={constellation.id}
            className={cn(
              'rounded-[1.25rem] border px-4 py-3 transition',
              constellation.id === activeConstellationId
                ? 'border-violet-200/16 bg-violet-400/10'
                : 'border-white/6 bg-white/4 hover:border-violet-200/14 hover:bg-violet-400/6',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onJump(constellation.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="text-sm font-medium text-white">{constellation.fileName}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {constellation.stats.headingCount} 个标题节点 ·{' '}
                  {constellation.stats.codeBlockCount} 个代码块
                </div>
              </button>

              <div className="flex items-center gap-2">
                <Orbit className="h-4 w-4 shrink-0 text-violet-200" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(constellation.id)
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/5 text-slate-300 transition hover:border-rose-200/18 hover:bg-rose-400/10 hover:text-rose-100"
                  title={`删除 ${constellation.fileName}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
