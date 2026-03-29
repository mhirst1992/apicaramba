import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  HttpMethod,
  ApiStructure,
  FolderNode,
  OperationRef,
  StructureConfig,
  OperationDetail
} from '@apicaramba/shared-types'

const API_TOOL_DIR = '.api-tool'
const STRUCTURE_FILE = 'structure.json'
const STRUCTURE_VERSION = '1'
const OPENAPI_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const

interface OpenApiOperation {
  operationId?: unknown
  summary?: unknown
  description?: unknown
  tags?: unknown
}

interface OpenApiDocument {
  openapi?: unknown
  info?: { title?: unknown; version?: unknown }
  paths?: Record<string, Record<string, OpenApiOperation> | undefined>
}

/**
 * Loads the full operation list and structural metadata for a single API,
 * merging the openapi.json with .api-tool/structure.json when present.
 * Falls back to a flat ungrouped structure when no structure file exists.
 */
export async function loadApiEditor(
  workspaceRoot: string,
  openapiRelativePath: string
): Promise<{ structure: ApiStructure; operations: OperationDetail[] }> {
  const absOpenapiPath = path.resolve(workspaceRoot, openapiRelativePath)
  const raw = await fs.readFile(absOpenapiPath, 'utf8')
  const document = JSON.parse(raw) as OpenApiDocument

  const operations = extractOperationDetails(document)
  const apiId = toId(openapiRelativePath)
  const legacyApiId = toId(path.dirname(openapiRelativePath) || openapiRelativePath)
  const apiName =
    typeof document.info?.title === 'string' && document.info.title.trim().length > 0
      ? document.info.title
      : path.basename(path.dirname(absOpenapiPath))

  const existingStructure = await tryLoadStructure(workspaceRoot, apiId, legacyApiId)
  const structure = existingStructure ?? buildUngroupedStructure(apiId, apiName, openapiRelativePath, operations)

  return { structure, operations }
}

/**
 * Applies edited operation fields to the openapi.json document in memory
 * and returns the serialised JSON string ready for validation and write.
 */
export function buildUpdatedDocument(
  rawDocumentJson: string,
  operations: OperationDetail[]
): string {
  const document = JSON.parse(rawDocumentJson) as OpenApiDocument
  const opsByKey = new Map(operations.map((op) => [`${op.method.toLowerCase()}:${op.path}`, op]))

  const updatedPaths: Record<string, Record<string, unknown>> = {}

  for (const [pathKey, pathItem] of Object.entries(document.paths ?? {})) {
    if (!pathItem) continue
    updatedPaths[pathKey] = { ...pathItem }

    for (const method of OPENAPI_METHODS) {
      const operation = pathItem[method]
      if (!operation) continue

      const key = `${method}:${pathKey}`
      const edited = opsByKey.get(key)
      if (!edited) continue

      updatedPaths[pathKey][method] = {
        ...(operation as Record<string, unknown>),
        ...(edited.summary !== '' ? { summary: edited.summary } : {}),
        ...(edited.description !== '' ? { description: edited.description } : {}),
        ...(edited.tags.length > 0 ? { tags: edited.tags } : {})
      }

      // Remove empty fields rather than writing empty strings
      const op = updatedPaths[pathKey][method] as Record<string, unknown>
      if (edited.summary === '') delete op['summary']
      if (edited.description === '') delete op['description']
      if (edited.tags.length === 0) delete op['tags']
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
      // responses is required by OpenAPI 3 spec
      newOp['responses'] = { '200': { description: 'OK' } }
      updatedPaths[op.path][lowerMethod] = newOp
    }
  }

  const updatedDocument = { ...document, paths: updatedPaths }
  return JSON.stringify(updatedDocument, null, 2) + '\n'
}

/**
 * Writes an updated structure.json (or creates it for the first time) in .api-tool/.
 * Merges with any existing structure file to preserve other APIs' entries.
 */
export async function saveStructure(
  workspaceRoot: string,
  structure: ApiStructure
): Promise<void> {
  const toolDir = path.join(workspaceRoot, API_TOOL_DIR)
  await fs.mkdir(toolDir, { recursive: true })

  const structurePath = path.join(toolDir, STRUCTURE_FILE)
  let existing: StructureConfig = { version: STRUCTURE_VERSION, apis: [] }

  try {
    const raw = await fs.readFile(structurePath, 'utf8')
    existing = JSON.parse(raw) as StructureConfig
  } catch {
    // File doesn't exist yet — use fresh config
  }

  const otherApis = existing.apis.filter((a) => a.id !== structure.id)
  const updated: StructureConfig = {
    version: STRUCTURE_VERSION,
    apis: [...otherApis, structure]
  }

  await fs.writeFile(structurePath, JSON.stringify(updated, null, 2) + '\n', 'utf8')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractOperationDetails(document: OpenApiDocument): OperationDetail[] {
  const results: OperationDetail[] = []

  for (const [pathKey, pathItem] of Object.entries(document.paths ?? {})) {
    if (!pathItem) continue

    for (const method of OPENAPI_METHODS) {
      const operation = pathItem[method]
      if (!operation) continue

      const httpMethod = method.toUpperCase() as HttpMethod
      results.push({
        key: `${httpMethod}:${pathKey}`,
        operationId: typeof operation.operationId === 'string' ? operation.operationId : null,
        method: httpMethod,
        path: pathKey,
        summary: typeof operation.summary === 'string' ? operation.summary : '',
        description: typeof operation.description === 'string' ? operation.description : '',
        tags: Array.isArray(operation.tags)
          ? operation.tags.filter((t): t is string => typeof t === 'string')
          : []
      })
    }
  }

  results.sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method)
    return a.path.localeCompare(b.path)
  })

  return results
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
  apiId: string,
  legacyApiId: string
): Promise<ApiStructure | null> {
  const structurePath = path.join(workspaceRoot, API_TOOL_DIR, STRUCTURE_FILE)

  try {
    const raw = await fs.readFile(structurePath, 'utf8')
    const config = JSON.parse(raw) as StructureConfig
    return config.apis.find((a) => a.id === apiId || a.id === legacyApiId) ?? null
  } catch {
    return null
  }
}

function toId(input: string): string {
  return input
    .replaceAll('\\', '/')
    .toLowerCase()
    .replace(/[^a-z0-9/._-]+/g, '-')
    .replaceAll('/', '__')
}
