import type { SchemaDetail } from '@apicaramba/shared-types'

export function createSchemaName(baseName: string, existing: SchemaDetail[]): string {
  const normalizedBase = baseName.trim().replace(/\s+/g, '') || 'Schema'
  const existingNames = new Set(existing.map((schema) => schema.name))
  if (!existingNames.has(normalizedBase)) {
    return normalizedBase
  }

  let index = 2
  let candidate = `${normalizedBase}${index}`
  while (existingNames.has(candidate)) {
    index += 1
    candidate = `${normalizedBase}${index}`
  }

  return candidate
}

export function createSchemaId(name: string, existing: SchemaDetail[]): string {
  const base = `schema:${name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')}`
  const existingIds = new Set(existing.map((schema) => schema.id))
  if (!existingIds.has(base)) {
    return base
  }

  let index = 2
  let candidate = `${base}-${index}`
  while (existingIds.has(candidate)) {
    index += 1
    candidate = `${base}-${index}`
  }

  return candidate
}
