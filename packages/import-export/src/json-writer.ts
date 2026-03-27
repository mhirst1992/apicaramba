import { writeFile } from 'node:fs/promises'

/**
 * Recursively sorts all object keys alphabetically for deterministic output.
 * Arrays preserve their element order.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys)
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys(obj[key])
        return acc
      }, {})
  }
  return value
}

/**
 * Serialises a value to a stable, deterministic JSON string.
 * - Keys are sorted alphabetically at every level.
 * - Output is 2-space indented.
 * - Output always ends with a single newline.
 */
export function toStableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + '\n'
}

/**
 * Writes a value to disk as stable JSON.
 * The file is always written UTF-8 with a trailing newline.
 */
export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, toStableJson(value), 'utf-8')
}
