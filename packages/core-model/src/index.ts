import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { HttpMethod, WorkspaceSnapshot, OperationSummary } from '@apicaramba/shared-types'

const OPENAPI_FILE = 'openapi.json'
const OPENAPI_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', '.api-tool'])

interface OpenApiInfo {
	title?: unknown
	version?: unknown
}

interface OpenApiOperation {
	operationId?: unknown
	summary?: unknown
}

interface OpenApiDocument {
	openapi?: unknown
	info?: OpenApiInfo
	paths?: Record<string, Record<string, OpenApiOperation> | undefined>
}

export async function loadWorkspaceSnapshot(rootPath: string): Promise<WorkspaceSnapshot> {
	const absoluteRoot = path.resolve(rootPath)
	const openapiFiles = await findOpenApiFiles(absoluteRoot)

	const apis = await Promise.all(
		openapiFiles.map(async (openapiPath) => buildApiSummary(absoluteRoot, openapiPath))
	)

	apis.sort((a, b) => a.path.localeCompare(b.path))

	return {
		workspace: {
			id: toId(absoluteRoot),
			name: path.basename(absoluteRoot),
			rootPath: absoluteRoot
		},
		apis
	}
}

async function findOpenApiFiles(rootPath: string): Promise<string[]> {
	const results: string[] = []

	async function walk(currentPath: string): Promise<void> {
		const entries = await fs.readdir(currentPath, { withFileTypes: true })

		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (IGNORED_DIRECTORIES.has(entry.name)) {
					continue
				}

				await walk(path.join(currentPath, entry.name))
				continue
			}

			if (entry.isFile() && entry.name.toLowerCase() === OPENAPI_FILE) {
				results.push(path.join(currentPath, entry.name))
			}
		}
	}

	await walk(rootPath)
	return results
}

async function buildApiSummary(workspaceRoot: string, openapiAbsolutePath: string) {
	const raw = await fs.readFile(openapiAbsolutePath, 'utf8')
	const document = JSON.parse(raw) as OpenApiDocument

	const openapiVersion = typeof document.openapi === 'string' ? document.openapi : ''
	if (!openapiVersion.startsWith('3.')) {
		throw new Error(`Unsupported OpenAPI version in ${openapiAbsolutePath}`)
	}

	const apiDirectory = path.dirname(openapiAbsolutePath)
	const relativeApiPath = normalizeRelativePath(path.relative(workspaceRoot, apiDirectory))
	const relativeOpenapiPath = normalizeRelativePath(path.relative(workspaceRoot, openapiAbsolutePath))

	const operations = collectOperations(document.paths)

	return {
		id: toId(relativeApiPath || relativeOpenapiPath),
		name:
			typeof document.info?.title === 'string' && document.info.title.trim().length > 0
				? document.info.title
				: path.basename(apiDirectory),
		path: relativeApiPath,
		openapiPath: relativeOpenapiPath,
		title: typeof document.info?.title === 'string' ? document.info.title : null,
		version: typeof document.info?.version === 'string' ? document.info.version : null,
		operationCount: operations.length,
		operations
	}
}

function collectOperations(pathsObject: OpenApiDocument['paths']): OperationSummary[] {
	if (!pathsObject || typeof pathsObject !== 'object') {
		return []
	}

	const operations: OperationSummary[] = []

	for (const [pathKey, value] of Object.entries(pathsObject)) {
		if (!value || typeof value !== 'object') {
			continue
		}

		for (const method of OPENAPI_METHODS) {
			const operation = value[method]
			if (!operation || typeof operation !== 'object') {
				continue
			}

			operations.push({
				method: method.toUpperCase() as HttpMethod,
				path: pathKey,
				operationId: typeof operation.operationId === 'string' ? operation.operationId : null,
				summary: typeof operation.summary === 'string' ? operation.summary : null
			})
		}
	}

	operations.sort((a, b) => {
		if (a.path === b.path) {
			return a.method.localeCompare(b.method)
		}

		return a.path.localeCompare(b.path)
	})

	return operations
}

function normalizeRelativePath(value: string): string {
	if (!value || value === '.') {
		return ''
	}

	return value.split(path.sep).join('/')
}

function toId(input: string): string {
	const normalized = input.replaceAll('\\', '/').toLowerCase()
	return normalized.replace(/[^a-z0-9/._-]+/g, '-').replaceAll('/', '__')
}
