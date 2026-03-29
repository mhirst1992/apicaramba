import type { SchemaDetail, SchemaPropertyDetail } from '@apicaramba/shared-types'

function defaultValueForPrimitive(
  type: SchemaPropertyDetail['type'] | SchemaPropertyDetail['arrayItemType']
): unknown {
  if (type === 'number' || type === 'integer') return 0
  if (type === 'boolean') return false
  return ''
}

export function buildExampleForProperty(
  property: SchemaPropertyDetail,
  schemasByName: Map<string, SchemaDetail>,
  visiting: Set<string>
): unknown {
  if (property.type === 'array') {
    if (property.arrayItemSchemaName) {
      return [buildExampleFromSchemaName(property.arrayItemSchemaName, schemasByName, visiting)]
    }
    return [defaultValueForPrimitive(property.arrayItemType ?? 'string')]
  }

  if (property.type === 'object') {
    const objectSchemaNames =
      property.objectSchemaNames ?? (property.objectSchemaName ? [property.objectSchemaName] : [])
    if (objectSchemaNames.length > 0) {
      if (property.objectCompositionType === 'allOf' && objectSchemaNames.length > 1) {
        return objectSchemaNames.reduce<Record<string, unknown>>((acc, schemaName) => {
          const next = buildExampleFromSchemaName(schemaName, schemasByName, visiting)
          if (next && typeof next === 'object' && !Array.isArray(next)) {
            Object.assign(acc, next as Record<string, unknown>)
          }
          return acc
        }, {})
      }
      return buildExampleFromSchemaName(objectSchemaNames[0], schemasByName, visiting)
    }
    return {}
  }

  return defaultValueForPrimitive(property.type)
}

export function buildExampleFromSchemaName(
  schemaName: string,
  schemasByName: Map<string, SchemaDetail>,
  visiting: Set<string>
): unknown {
  const schema = schemasByName.get(schemaName)
  if (!schema) return {}
  if (visiting.has(schemaName)) return {}

  visiting.add(schemaName)

  // Schema-level array (unnamed array property) — return array example directly
  const inlineArray = schema.properties.find((p) => !p.name.trim() && p.type === 'array')
  if (inlineArray) {
    visiting.delete(schemaName)
    return buildExampleForProperty(inlineArray, schemasByName, visiting)
  }

  const result: Record<string, unknown> = {}
  for (const property of schema.properties) {
    const propName = property.name.trim()
    if (!propName) {
      // Unnamed (inlined) object property — merge into parent instead of nesting
      const inlineExample = buildExampleForProperty(property, schemasByName, visiting)
      if (inlineExample && typeof inlineExample === 'object' && !Array.isArray(inlineExample)) {
        Object.assign(result, inlineExample as Record<string, unknown>)
      }
    } else {
      result[propName] = buildExampleForProperty(property, schemasByName, visiting)
    }
  }
  visiting.delete(schemaName)
  return result
}
