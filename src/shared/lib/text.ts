export function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash).toString(36)
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function truncate(value: string, length: number) {
  if (value.length <= length) {
    return value
  }

  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…`
}

export function buildDocumentId(name: string, markdown: string) {
  return `${slugify(name) || 'document'}-${hashString(`${name}:${markdown}`)}`
}
