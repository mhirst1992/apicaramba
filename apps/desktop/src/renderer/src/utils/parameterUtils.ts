import type { EnvironmentParameter, ParameterLocation } from '@apicaramba/shared-types'

export function createParameterId(
  inValue: ParameterLocation,
  name: string,
  existing: EnvironmentParameter[]
): string {
  const baseName = name.trim().replace(/\s+/g, '_') || 'parameter'
  const base = `${inValue}:${baseName}`
  if (!existing.some((parameter) => parameter.id === base)) {
    return base
  }

  let index = 2
  let candidate = `${base}_${index}`
  while (existing.some((parameter) => parameter.id === candidate)) {
    index += 1
    candidate = `${base}_${index}`
  }

  return candidate
}
