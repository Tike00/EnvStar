import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { parseMarkdownDocument } from '../../features/markdown/lib/parse-markdown.ts'
import {
  clearStoredDocuments,
  readStoredDocuments,
  writeStoredDocuments,
} from '../../features/markdown/lib/storage.ts'
import { sampleDocuments } from '../../shared/sample-data/sample-documents.ts'
import type {
  MarkdownConstellation,
  RawMarkdownDocument,
} from '../../shared/types/knowledge.ts'
import { buildDocumentId } from '../../shared/lib/text.ts'

interface KnowledgeStoreValue {
  documents: RawMarkdownDocument[]
  constellations: MarkdownConstellation[]
  isHydrated: boolean
  isBusy: boolean
  importFiles: (files: FileList | File[]) => Promise<void>
  importMarkdownDocuments: (
    docs: Array<Pick<RawMarkdownDocument, 'name' | 'markdown'> & Partial<RawMarkdownDocument>>,
  ) => void
  clearAll: () => void
  removeConstellation: (constellationId: string) => void
}

const KnowledgeStoreContext = createContext<KnowledgeStoreValue | null>(null)

function mergeDocuments(
  current: RawMarkdownDocument[],
  incoming: RawMarkdownDocument[],
) {
  const byId = new Map(current.map((document) => [document.id, document]))
  for (const document of incoming) {
    byId.set(document.id, document)
  }

  return Array.from(byId.values()).sort((left, right) => {
    return (
      new Date(left.importedAt).getTime() - new Date(right.importedAt).getTime()
    )
  })
}

function createImportedDocument(
  name: string,
  markdown: string,
  source: RawMarkdownDocument['source'],
  importedAt = new Date().toISOString(),
): RawMarkdownDocument {
  return {
    id: buildDocumentId(name, markdown),
    name,
    markdown,
    importedAt,
    source,
  }
}

function isMarkdownFile(fileName: string) {
  return /\.(md|markdown)$/i.test(fileName)
}

function isTopLevelFolderFile(file: File) {
  const relativePath =
    'webkitRelativePath' in file && typeof file.webkitRelativePath === 'string'
      ? file.webkitRelativePath
      : ''

  if (!relativePath) {
    return true
  }

  const normalizedParts = relativePath.split('/').filter(Boolean)
  return normalizedParts.length <= 2
}

export function KnowledgeStoreProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [documents, setDocuments] = useState<RawMarkdownDocument[]>([])
  const [isHydrated, setHydrated] = useState(false)
  const [isBusy, setBusy] = useState(false)

  useEffect(() => {
    let isActive = true

    void (async () => {
      setBusy(true)
      try {
        const restored = await readStoredDocuments()
        if (!isActive) {
          return
        }

        const nextDocuments =
          restored.length > 0
            ? restored.map((document) => ({
                ...document,
                source: 'restored' as const,
              }))
            : sampleDocuments

        startTransition(() => {
          setDocuments(nextDocuments)
          setHydrated(true)
          setBusy(false)
        })
      } catch {
        if (!isActive) {
          return
        }

        startTransition(() => {
          setDocuments(sampleDocuments)
          setHydrated(true)
          setBusy(false)
        })
      }
    })()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    void writeStoredDocuments(documents)
  }, [documents, isHydrated])

  const constellations = useMemo(() => {
    return documents.map((document) => parseMarkdownDocument(document))
  }, [documents])

  const importMarkdownDocuments = useCallback(
    (
      docs: Array<
        Pick<RawMarkdownDocument, 'name' | 'markdown'> & Partial<RawMarkdownDocument>
      >,
    ) => {
      const importedDocuments = docs.map((document) =>
        createImportedDocument(
          document.name,
          document.markdown,
          document.source ?? 'upload',
          document.importedAt ?? new Date().toISOString(),
        ),
      )

      startTransition(() => {
        setDocuments((current) => mergeDocuments(current, importedDocuments))
      })
    },
    [],
  )

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const normalizedFiles = Array.from(files).filter(
        (file) => isMarkdownFile(file.name) && isTopLevelFolderFile(file),
      )
      if (normalizedFiles.length === 0) {
        return
      }

      setBusy(true)

      try {
        const importedDocuments = await Promise.all(
          normalizedFiles.map(async (file) => {
            const markdown = await file.text()
            return createImportedDocument(file.name, markdown, 'upload')
          }),
        )

        startTransition(() => {
          setDocuments((current) => mergeDocuments(current, importedDocuments))
          setBusy(false)
        })
      } catch {
        setBusy(false)
      }
    },
    [],
  )

  const clearAll = useCallback(() => {
    startTransition(() => {
      setDocuments([])
    })
    void clearStoredDocuments()
  }, [])

  const removeConstellation = useCallback((constellationId: string) => {
    startTransition(() => {
      setDocuments((current) =>
        current.filter((document) => buildDocumentId(document.name, document.markdown) !== constellationId),
      )
    })
  }, [])

  const value = useMemo<KnowledgeStoreValue>(
    () => ({
      documents,
      constellations,
      isHydrated,
      isBusy,
      importFiles,
      importMarkdownDocuments,
      clearAll,
      removeConstellation,
    }),
    [
      constellations,
      documents,
      importFiles,
      importMarkdownDocuments,
      isBusy,
      isHydrated,
      clearAll,
      removeConstellation,
    ],
  )

  return (
    <KnowledgeStoreContext.Provider value={value}>
      {children}
    </KnowledgeStoreContext.Provider>
  )
}

export function useKnowledgeStore() {
  const value = useContext(KnowledgeStoreContext)
  if (!value) {
    throw new Error('useKnowledgeStore must be used inside KnowledgeStoreProvider')
  }

  return value
}
