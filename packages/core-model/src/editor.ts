import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  HttpMethod,
  ApiStructure,
  FolderNode,
  OperationRef,
  StructureConfig,
  OperationDetail,
  ResponseSchemaAssignment,
  SchemaDetail,
  SchemaPropertyDetail,
  SchemaPropertyType,
  SchemaPrimitiveType,
  SchemaUsageTag,
  EnvironmentParameter,
  ParameterLocation
} from '@apicaramba/shared-types'
import type { OpenApiDocument } from './openapi.js'
import { parseAndNormalizeOpenApiSource } from './openapi.js'

const API_TOOL_DIR = '.api-tool'
const STRUCTURE_FILE = 'structure.json'
const STRUCTURE_VERSION = '1'
const OPENAPI_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const
const PARAMETER_LOCATIONS: ParameterLocation[] = ['query', 'header', 'path', 'cookie']
const SCHEMA_USAGE_EXTENSION = 'x-apicaramba-usage-tag'

interface OpenApiParameterObject {
  name?: unknown
  in?: unknown
  required?: unknown
  description?: unknown
  schema?: unknown
}

interface OpenApiRequestBodyObject {
  required?: unknown
  content?: unknown
}

interface OpenApiResponseObject {
  description?: unknown
  content?: unknown
}

/**
 * Loads the full operation list and structural metadata for a single API,
 * merging the openapi.json with .api-tool/structure.json when present.
 * Falls back to a flat ungrouped structure when no structure file exists.
 */
export async function loadApiEditor(
  workspaceRoot: string,
  openapiRelativePath: string
): Promise<{ structure: ApiStructure; operations: OperationDetail[]; schemas: SchemaDetail[] }> {
  const absOpenapiPath = path.resolve(workspaceRoot, openapiRelativePath)
  const raw = await fs.readFile(absOpenapiPath, 'utf8')
  const document = await parseAndNormalizeOpenApiSource(raw)
  if (!document) {
    throw new Error('Unsupported OpenAPI source. Expected OpenAPI 3.x or Swagger 2.0 in JSON or YAML.')
  }

  const operations = extractOperationDetails(document)
  const schemas = extractSchemaDetails(document)
  const apiId = toId(openapiRelativePath)
  const legacyApiId = toId(path.dirname(openapiRelativePath) || openapiRelativePath)
  const apiName =
    typeof document.info?.title === 'string' && document.info.title.trim().length > 0
      ? document.info.title
      : path.basename(path.dirname(absOpenapiPath))

  const existingStructure = await tryLoadStructure(workspaceRoot, openapiRelativePath, apiId, legacyApiId)
  const structure = existingStructure ?? buildUngroupedStructure(apiId, apiName, openapiRelativePath, operations)

  return { structure, operations, schemas }
}

/**
 * Applies edited operation fields to the openapi.json document in memory
 * and returns the serialised JSON string ready for validation and write.
 */
export async function buildUpdatedDocument(
  rawDocumentSource: string,
  operations: OperationDetail[],
  availableParameters: EnvironmentParameter[] = [],
  schemas: SchemaDetail[] = []
): Promise<string> {
  const document = await parseAndNormalizeOpenApiSource(rawDocumentSource)
  if (!document) {
    throw new Error('Unsupported OpenAPI source. Expected OpenAPI 3.x or Swagger 2.0 in JSON or YAML.')
  }
  const opsBySourceKey = new Map(operations.map((op) => [op.sourceKey ?? `${op.method}:${op.path}`, op]))
  const paramsById = new Map(availableParameters.map((parameter) => [parameter.id, parameter]))
  const schemasByName = new Map(schemas.map((schema) => [schema.name, schema]))

  const updatedPaths: Record<string, Record<string, unknown>> = {}

  for (const [pathKey, pathItem] of Object.entries(document.paths ?? {})) {
    if (!pathItem) continue
    updatedPaths[pathKey] = { ...pathItem }

    for (const method of OPENAPI_METHODS) {
      const operation = asObject(pathItem[method])
      if (!operation) continue

      const key = `${method.toUpperCase()}:${pathKey}`
      const edited = opsBySourceKey.get(key)
      if (!edited) continue

      const nextMethod = edited.method.toLowerCase()
      const nextPath = edited.path
      if (nextMethod !== method || nextPath !== pathKey) {
        delete updatedPaths[pathKey][method]
        continue
      }

      updatedPaths[pathKey][method] = {
        ...operation,
        ...(edited.summary !== '' ? { summary: edited.summary } : {}),
        ...(edited.description !== '' ? { description: edited.description } : {}),
        ...(edited.tags.length > 0 ? { tags: edited.tags } : {}),
        ...(edited.parameterIds.length > 0
          ? { parameters: buildOpenApiParameters(edited.parameterIds, paramsById) }
          : {}),
        ...(edited.requestBodyMediaType.trim() !== ''
          ? { requestBody: buildOpenApiRequestBody(edited, operation, schemasByName) }
          : {}),
        responses: buildOpenApiResponses(edited, operation, schemasByName)
      }

      // Remove empty fields rather than writing empty strings
      const op = updatedPaths[pathKey][method] as Record<string, unknown>
      if (edited.summary === '') delete op['summary']
      if (edited.description === '') delete op['description']
      if (edited.tags.length === 0) delete op['tags']
      if (edited.parameterIds.length === 0) delete op['parameters']
      if (edited.requestBodyMediaType.trim() === '') delete op['requestBody']
    }
  }

  // Add any new operations that are not yet present in the document paths
  for (const op of operations) {
    const lowerMethod = op.method.toLowerCase()
    if (!updatedPaths[op.path]) {
      updatedPaths[op.path] = {}
    }
    if (!updatedPaths[op.path][lowerMethod]) {
      const newOp: Record<string, unknown> = {}
      if (op.operationId) newOp['operationId'] = op.operationId
      if (op.summary) newOp['summary'] = op.summary
      if (op.description) newOp['description'] = op.description
      if (op.tags.length > 0) newOp['tags'] = op.tags
      if (op.parameterIds.length > 0) newOp['parameters'] = buildOpenApiParameters(op.parameterIds, paramsById)
      if (op.requestBodyMediaType.trim() !== '') {
        newOp['requestBody'] = buildOpenApiRequestBody(op, null, schemasByName)
      }
      newOp['responses'] = buildOpenApiResponses(op, null, schemasByName)
      updatedPaths[op.path][lowerMethod] = newOp
    }
  }

  const updatedDocument = {
    ...document,
    paths: updatedPaths,
    components: {
      ...(asObject(document.components) ?? {}),
      schemas: buildOpenApiSchemas(schemas)
    }
  }
  return JSON.stringify(updatedDocument, null, 2) + '\n'
}

/**
 * Writes an updated structure.json in the selected API's .api-tool/ directory.
 */
export async function saveStructure(
  workspaceRoot: string,
  openapiRelativePath: string,
  structure: ApiStructure
): Promise<void> {
  const apiDir = path.dirname(path.resolve(workspaceRoot, openapiRelativePath))
  const toolDir = path.join(apiDir, API_TOOL_DIR)
  await fs.mkdir(toolDir, { recursive: true })

  const structurePath = path.join(toolDir, STRUCTURE_FILE)
  const updated: StructureConfig = {
    version: STRUCTURE_VERSION,
    apis: [structure]
  }

  await fs.writeFile(structurePath, JSON.stringify(updated, null, 2) + '\n', 'utf8')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractOperationDetails(document: OpenApiDocument): OperationDetail[] {
  const results: OperationDetail[] = []

  for (const [pathKey, pathItem] of Object.entries(document.paths ?? {})) {
    if (!pathItem) continue

    for (const method of OPENAPI_METHODS) {
      const operation = asObject(pathItem[method])
      if (!operation) continue

      const httpMethod = method.toUpperCase() as HttpMethod
      const requestSchema = extractRequestSchema(operation)
      const responseSchemas = extractResponseSchemas(operation)
      results.push({
        key: `${httpMethod}:${pathKey}`,
        sourceKey: `${httpMethod}:${pathKey}`,
        operationId: typeof operation.operationId === 'string' ? operation.operationId : null,
        method: httpMethod,
        path: pathKey,
        summary: typeof operation.summary === 'string' ? operation.summary : '',
        description: typeof operation.description === 'string' ? operation.description : '',
        tags: Array.isArray(operation.tags)
          ? operation.tags.filter((t): t is string => typeof t === 'string')
          : [],
        parameterIds: extractOperationParameterIds(pathItem, operation),
        requestBodyMediaType: requestSchema.mediaType,
        requestBodySchemaName: requestSchema.schemaName,
        requestBodyRequired: requestSchema.required,
        responseSchemas
      })
    }
  }

  results.sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method)
    return a.path.localeCompare(b.path)
  })

  return results
}

function extractOperationParameterIds(pathItem: Record<string, unknown>, operation: Record<string, unknown>): string[] {
  const pathParameters = readOpenApiParameterList(pathItem['parameters'])
  const operationParameters = readOpenApiParameterList(operation['parameters'])

  const deduped = new Map<string, string>()
  for (const parameter of [...pathParameters, ...operationParameters]) {
    const id = toParameterId(parameter)
    if (!id) continue
    deduped.set(id, id)
  }

  return [...deduped.values()]
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function readOpenApiParameterList(value: unknown): OpenApiParameterObject[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is OpenApiParameterObject => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false
    }

    const candidate = item as Record<string, unknown>
    if (typeof candidate['$ref'] === 'string') {
      return false
    }

    return true
  })
}

function toParameterId(parameter: OpenApiParameterObject): string | null {
  const name = typeof parameter.name === 'string' ? parameter.name.trim() : ''
  const location = typeof parameter.in === 'string' ? parameter.in.trim().toLowerCase() : ''
  if (!name || !PARAMETER_LOCATIONS.includes(location as ParameterLocation)) {
    return null
  }

  return `${location}:${name}`
}

function buildOpenApiParameters(
  parameterIds: string[],
  parametersById: Map<string, EnvironmentParameter>
): OpenApiParameterObject[] {
  const result: OpenApiParameterObject[] = []

  for (const parameterId of parameterIds) {
    const parameter = parametersById.get(parameterId)
    if (!parameter) continue

    result.push({
      name: parameter.name,
      in: parameter.in,
      required: parameter.in === 'path' ? true : parameter.required,
      // OpenAPI 3 Parameter Object requires either schema or content.
      // We emit a default string schema so generated parameters are always valid.
      schema: { type: 'string' },
      ...(parameter.description ? { description: parameter.description } : {})
    })
  }

  return result
}

function extractRequestSchema(operation: Record<string, unknown>): {
  mediaType: string
  schemaName: string
  required: boolean
} {
  const requestBody = asObject(operation['requestBody']) as OpenApiRequestBodyObject | null
  if (!requestBody) {
    return { mediaType: '', schemaName: '', required: false }
  }

  const content = asObject(requestBody.content)
  if (!content) {
    return {
      mediaType: '',
      schemaName: '',
      required: requestBody.required === true
    }
  }

  for (const [mediaType, mediaDef] of Object.entries(content)) {
    const mediaObj = asObject(mediaDef)
    if (!mediaObj) continue

    const schema = mediaObj['schema']
    if (schema !== undefined) {
      const schemaName = extractSchemaRefName(schema)
      return {
        mediaType,
        schemaName,
        required: requestBody.required === true
      }
    }
  }

  return {
    mediaType: '',
    schemaName: '',
    required: requestBody.required === true
  }
}

function extractSchemaRefName(schema: unknown): string {
  const schemaObj = asObject(schema)
  if (!schemaObj || typeof schemaObj['$ref'] !== 'string') {
    return ''
  }

  const ref = schemaObj['$ref']
  const prefix = '#/components/schemas/'
  if (!ref.startsWith(prefix)) {
    return ''
  }

  return ref.slice(prefix.length)
}

function extractSchemaDetails(document: OpenApiDocument): SchemaDetail[] {
  const components = asObject(document.components)
  const schemasObj = asObject(components?.schemas)
  if (!schemasObj) {
    return []
  }

  const schemas: SchemaDetail[] = []

  for (const [name, schema] of Object.entries(schemasObj)) {
    const schemaObj = asObject(schema)
    if (!schemaObj) continue

    const propertiesObj = asObject(schemaObj['properties'])
    const requiredNames = new Set(
      Array.isArray(schemaObj['required'])
        ? schemaObj['required'].filter((value): value is string => typeof value === 'string')
        : []
    )

    const properties: SchemaPropertyDetail[] = propertiesObj
      ? Object.entries(propertiesObj).map(([propName, propValue], index) => {
          const propObj = asObject(propValue)
          const refName = extractSchemaRefNameFromObject(propObj)
          const type = typeof propObj?.type === 'string' && isSchemaType(propObj.type)
            ? propObj.type
            : refName
              ? 'object'
              : 'string'

          let arrayItemType: SchemaPrimitiveType | undefined
          let arrayItemSchemaName: string | undefined
          let objectSchemaName: string | undefined

          if (type === 'array') {
            const itemsObj = asObject(propObj?.['items'])
            const itemRefName = extractSchemaRefNameFromObject(itemsObj)
            if (itemRefName) {
              arrayItemSchemaName = itemRefName
            } else if (typeof itemsObj?.type === 'string' && isSchemaPrimitiveType(itemsObj.type)) {
              arrayItemType = itemsObj.type
            } else {
              arrayItemType = 'string'
            }
          }

          if (type === 'object' && refName) {
            objectSchemaName = refName
          }

          return {
            id: `${name}__prop__${index}`,
            name: propName,
            type,
            ...(arrayItemType ? { arrayItemType } : {}),
            ...(arrayItemSchemaName ? { arrayItemSchemaName } : {}),
            ...(objectSchemaName ? { objectSchemaName } : {}),
            required: requiredNames.has(propName),
            description: typeof propObj?.description === 'string' ? propObj.description : ''
          }
        })
      : []

    schemas.push({
      id: `schema:${name}`,
      name,
      description: typeof schemaObj['description'] === 'string' ? schemaObj['description'] : '',
      usageTag: parseSchemaUsageTag(schemaObj[SCHEMA_USAGE_EXTENSION]),
      properties
    })
  }

  schemas.sort((a, b) => a.name.localeCompare(b.name))
  return schemas
}

function isSchemaType(value: string): value is SchemaPropertyType {
  return value === 'string'
    || value === 'number'
    || value === 'integer'
    || value === 'boolean'
    || value === 'array'
    || value === 'object'
}

function isSchemaPrimitiveType(value: string): value is SchemaPrimitiveType {
  return value === 'string'
    || value === 'number'
    || value === 'integer'
    || value === 'boolean'
}

function buildOpenApiRequestBody(
  edited: OperationDetail,
  existingOperation: Record<string, unknown> | null,
  schemasByName: Map<string, SchemaDetail>
): OpenApiRequestBodyObject {
  const mediaType = edited.requestBodyMediaType.trim()
  if (!mediaType) {
    return {}
  }

  const existingRequestBody = existingOperation ? asObject(existingOperation['requestBody']) : null

  const schemaName = edited.requestBodySchemaName.trim()
  if (!schemaName || !schemasByName.has(schemaName)) {
    if (existingRequestBody) {
      return {
        ...existingRequestBody,
        ...(edited.requestBodyRequired ? { required: true } : { required: false })
      }
    }

    throw new Error(`Operation ${edited.key} references missing schema \"${schemaName}\".`)
  }

  const schema = { $ref: `#/components/schemas/${schemaName}` }
  const existingContent = asObject(existingRequestBody?.['content'])
  const nextContent: Record<string, unknown> = {
    ...(existingContent ?? {})
  }

  const existingMediaType = asObject(nextContent[mediaType])
  nextContent[mediaType] = {
    ...(existingMediaType ?? {}),
    schema
  }

  return {
    ...(existingRequestBody ?? {}),
    ...(edited.requestBodyRequired ? { required: true } : { required: false }),
    content: nextContent
  }
}

function extractResponseSchemas(operation: Record<string, unknown>): ResponseSchemaAssignment[] {
  const responses = asObject(operation['responses'])
  if (!responses) {
    return []
  }

  const assignments: ResponseSchemaAssignment[] = []

  for (const [statusCode, responseValue] of Object.entries(responses)) {
    const responseObj = asObject(responseValue) as OpenApiResponseObject | null
    if (!responseObj) continue

    const content = asObject(responseObj.content)
    if (!content) continue

    for (const [mediaType, mediaDef] of Object.entries(content)) {
      const mediaObj = asObject(mediaDef)
      if (!mediaObj) continue

      const schemaName = extractSchemaRefName(mediaObj['schema'])
      if (!schemaName) continue

      assignments.push({
        id: `${statusCode}:${mediaType}`,
        responseCode: statusCode,
        schemaName
      })
      break
    }
  }

  assignments.sort((a, b) => a.responseCode.localeCompare(b.responseCode))
  return assignments
}

function buildOpenApiResponses(
  edited: OperationDetail,
  existingOperation: Record<string, unknown> | null,
  schemasByName: Map<string, SchemaDetail>
): Record<string, unknown> {
  const mediaType = 'application/json'
  const existingResponses = existingOperation ? asObject(existingOperation['responses']) : null
  const nextResponses: Record<string, unknown> = {
    ...(existingResponses ?? {})
  }

  for (const assignment of edited.responseSchemas) {
    const responseCode = assignment.responseCode.trim()
    const schemaName = assignment.schemaName.trim()
    if (!responseCode || !schemaName) {
      continue
    }
    if (!schemasByName.has(schemaName)) {
      throw new Error(`Operation ${edited.key} references missing response schema \"${schemaName}\" for status ${responseCode}.`)
    }

    const currentResponse = asObject(nextResponses[responseCode])
    const currentContent = asObject(currentResponse?.['content'])
    const currentMedia = asObject(currentContent?.[mediaType])

    const nextContent: Record<string, unknown> = {
      ...(currentContent ?? {}),
      [mediaType]: {
        ...(currentMedia ?? {}),
        schema: { $ref: `#/components/schemas/${schemaName}` }
      }
    }

    nextResponses[responseCode] = {
      ...(currentResponse ?? { description: responseCode.startsWith('2') ? 'OK' : 'Response' }),
      content: nextContent
    }
  }

  // Remove schema refs for response codes no longer assigned by the editor model.
  const assignedCodes = new Set(edited.responseSchemas.map((item) => item.responseCode.trim()).filter(Boolean))
  for (const [statusCode, responseValue] of Object.entries(nextResponses)) {
    if (assignedCodes.has(statusCode)) {
      continue
    }

    const responseObj = asObject(responseValue)
    if (!responseObj) {
      continue
    }

    const content = asObject(responseObj['content'])
    const mediaObj = asObject(content?.[mediaType])
    if (!mediaObj) {
      continue
    }

    if (extractSchemaRefName(mediaObj['schema'])) {
      const nextMedia = { ...mediaObj }
      delete nextMedia['schema']
      const nextContent = { ...(content ?? {}), [mediaType]: nextMedia }
      nextResponses[statusCode] = { ...responseObj, content: nextContent }
    }
  }

  if (Object.keys(nextResponses).length === 0) {
    return { '200': { description: 'OK' } }
  }

  return nextResponses
}

function buildOpenApiSchemas(schemas: SchemaDetail[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const schema of schemas) {
    const schemaName = schema.name.trim()
    if (!schemaName) continue

    const required = schema.properties
      .filter((property) => property.required)
      .map((property) => property.name.trim())
      .filter(Boolean)

    const properties: Record<string, unknown> = {}
    for (const property of schema.properties) {
      const propName = property.name.trim()
      if (!propName) continue

      if (property.type === 'array') {
        const itemSchemaName = property.arrayItemSchemaName?.trim() ?? ''
        const items = itemSchemaName
          ? { $ref: `#/components/schemas/${itemSchemaName}` }
          : { type: property.arrayItemType ?? 'string' }

        properties[propName] = {
          type: 'array',
          items,
          ...(property.description ? { description: property.description } : {})
        }
        continue
      }

      if (property.type === 'object') {
        const objectSchemaName = property.objectSchemaName?.trim() ?? ''
        if (objectSchemaName) {
          properties[propName] = {
            allOf: [{ $ref: `#/components/schemas/${objectSchemaName}` }],
            ...(property.description ? { description: property.description } : {})
          }
          continue
        }
      }

      properties[propName] = {
        type: property.type,
        ...(property.description ? { description: property.description } : {})
      }
    }

    result[schemaName] = {
      type: 'object',
      ...(schema.description ? { description: schema.description } : {}),
      ...(schema.usageTag ? { [SCHEMA_USAGE_EXTENSION]: schema.usageTag } : {}),
      properties,
      ...(required.length > 0 ? { required } : {})
    }
  }

  return result
}

function extractSchemaRefNameFromObject(schemaObj: Record<string, unknown> | null): string {
  if (!schemaObj) {
    return ''
  }

  const directRefName = extractSchemaRefName(schemaObj)
  if (directRefName) {
    return directRefName
  }

  const allOf = Array.isArray(schemaObj['allOf']) ? schemaObj['allOf'] : []
  for (const entry of allOf) {
    const candidate = asObject(entry)
    const refName = extractSchemaRefName(candidate)
    if (refName) {
      return refName
    }
  }

  return ''
}

function parseSchemaUsageTag(value: unknown): SchemaUsageTag {
  if (value === 'Rqst' || value === 'Resp' || value === 'Both') {
    return value
  }

  return 'Both'
}

function buildUngroupedStructure(
  apiId: string,
  apiName: string,
  openapiRelativePath: string,
  operations: OperationDetail[]
): ApiStructure {
  const ungrouped: OperationRef[] = operations.map((op) => ({
    id: toId(op.key),
    operationId: op.operationId,
    method: op.method,
    path: op.path
  }))

  const rootFolder: FolderNode = {
    id: `${apiId}__root`,
    name: 'root',
    children: [],
    operations: []
  }

  return {
    id: apiId,
    name: apiName,
    path: path.dirname(openapiRelativePath),
    rootFolder,
    ungrouped
  }
}

async function tryLoadStructure(
  workspaceRoot: string,
  openapiRelativePath: string,
  apiId: string,
  legacyApiId: string
): Promise<ApiStructure | null> {
  const apiDir = path.dirname(path.resolve(workspaceRoot, openapiRelativePath))
  const apiStructurePath = path.join(apiDir, API_TOOL_DIR, STRUCTURE_FILE)
  const workspaceStructurePath = path.join(workspaceRoot, API_TOOL_DIR, STRUCTURE_FILE)

  const fromApiScope = await tryLoadStructureFromFile(apiStructurePath, apiId, legacyApiId)
  if (fromApiScope) {
    return fromApiScope
  }

  return tryLoadStructureFromFile(workspaceStructurePath, apiId, legacyApiId)
}

async function tryLoadStructureFromFile(
  structurePath: string,
  apiId: string,
  legacyApiId: string
): Promise<ApiStructure | null> {
  const validIds = new Set([apiId, legacyApiId])

  try {
    const raw = await fs.readFile(structurePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown

    if (isApiStructure(parsed)) {
      return validIds.has(parsed.id) ? parsed : null
    }

    if (isStructureConfig(parsed)) {
      return parsed.apis.find((a) => validIds.has(a.id)) ?? null
    }

    return null
  } catch {
    return null
  }
}

function isApiStructure(value: unknown): value is ApiStructure {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ApiStructure>
  return typeof candidate.id === 'string' && typeof candidate.name === 'string' && !!candidate.rootFolder
}

function isStructureConfig(value: unknown): value is StructureConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StructureConfig>
  return Array.isArray(candidate.apis)
}

function toId(input: string): string {
  return input
    .replaceAll('\\', '/')
    .toLowerCase()
    .replace(/[^a-z0-9/._-]+/g, '-')
    .replaceAll('/', '__')
}
