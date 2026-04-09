import { del, get, set } from 'idb-keyval'
import type { RawMarkdownDocument } from '../../../shared/types/knowledge.ts'

const DOCUMENTS_STORAGE_KEY = 'envstar:documents:v1'

export async function readStoredDocuments() {
  return (await get<RawMarkdownDocument[]>(DOCUMENTS_STORAGE_KEY)) ?? []
}

export async function writeStoredDocuments(documents: RawMarkdownDocument[]) {
  await set(DOCUMENTS_STORAGE_KEY, documents)
}

export async function clearStoredDocuments() {
  await del(DOCUMENTS_STORAGE_KEY)
}
