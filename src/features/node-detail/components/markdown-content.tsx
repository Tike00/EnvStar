import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../../../shared/lib/cn.ts'

interface MarkdownContentProps {
  markdown: string
  className?: string
}

export function MarkdownContent({ className, markdown }: MarkdownContentProps) {
  return (
    <div className={cn('tech-markdown', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-100"
            >
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="my-5 overflow-x-auto rounded-[1.5rem] border border-white/8 bg-slate-950/88 px-4 py-4">
              {children}
            </pre>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const language =
              codeClassName?.replace('language-', '').trim().toLowerCase() ?? ''
            const renderedChildren = String(children).replace(/\n$/, '')

            if (language) {
              return (
                <code
                  {...props}
                  className={cn(
                    codeClassName,
                    'block font-mono text-[13px] leading-6 text-slate-100',
                  )}
                >
                  {renderedChildren}
                </code>
              )
            }

            return (
              <code
                {...props}
                className="rounded-lg bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em] text-cyan-100"
              >
                {children}
              </code>
            )
          },
          blockquote: ({ children }) => (
            <blockquote className="my-5 rounded-r-[1.25rem] border-l-2 border-cyan-300/30 bg-white/4 px-4 py-3 text-slate-300">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto rounded-[1.5rem] border border-white/8 bg-slate-950/70">
              <table className="min-w-full border-collapse">{children}</table>
            </div>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
