import { FolderOpen, LoaderCircle, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { cn } from '../../../shared/lib/cn.ts'

interface FileImporterProps {
  onImport: (files: FileList | File[]) => Promise<void>
  onClear: () => void
  isBusy: boolean
  documentCount: number
}

export function FileImporter({
  documentCount,
  isBusy,
  onClear,
  onImport,
}: FileImporterProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="space-y-2.5">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".md,.markdown,text/markdown,text/plain"
        className="hidden"
        onChange={(event) => {
          const files = event.target.files
          if (!files || files.length === 0) {
            return
          }
          void onImport(files)
          event.target.value = ''
        }}
      />

      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept=".md,.markdown,text/markdown,text/plain"
        className="hidden"
        {...({ webkitdirectory: 'true', directory: '' } as Record<string, string>)}
        onChange={(event) => {
          const files = event.target.files
          if (!files || files.length === 0) {
            return
          }
          void onImport(files)
          event.target.value = ''
        }}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-1.5 rounded-[1rem] border border-violet-200/16 bg-violet-400/12 px-3 py-2.5 text-xs font-medium text-violet-50 transition hover:border-violet-200/26 hover:bg-violet-400/18"
        >
          {isBusy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          导入 Markdown
        </button>

        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-1.5 rounded-[1rem] border border-white/8 bg-white/5 px-3 py-2.5 text-xs font-medium text-slate-100 transition hover:border-violet-200/16 hover:bg-white/8"
        >
          <FolderOpen className="h-3.5 w-3.5 text-violet-200" />
          导入文件夹
        </button>

        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center justify-center gap-1.5 rounded-[1rem] border border-white/8 bg-white/4 px-3 py-2.5 text-xs font-medium text-slate-100 transition hover:border-rose-300/20 hover:bg-rose-400/10"
        >
          <Trash2 className="h-3.5 w-3.5 text-rose-200" />
          清空本地
        </button>
      </div>

      <div
        className={cn(
          'rounded-[1rem] border border-white/6 bg-slate-950/45 px-3 py-2.5 text-[11px] leading-5 text-slate-300',
          isBusy && 'border-violet-200/16 text-violet-50',
        )}
      >
        当前已装载 {documentCount} 个 Markdown 星团。文件夹导入只会解析所选目录当前层级下的
        `.md`/`.markdown` 文件，不会继续递归到下一级目录。
      </div>
    </div>
  )
}
