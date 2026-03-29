import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { HttpMethod, WorkspaceSnapshot, OperationSummary, ApiSummary } from '@apicaramba/shared-types'
import type { OpenApiDocument } from './openapi.js'
import { parseAndNormalizeOpenApiSource } from './openapi.js'

export { loadApiEditor, buildUpdatedDocument, saveStructure } from './editor.js'

const OPENAPI_FILE_EXTENSIONS = new Set(['.json', '.yaml', '.yml'])
const OPENAPI_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', '.api-tool'])

export async function loadWorkspaceSnapshot(rootPath: string): Promise<WorkspaceSnapshot> {
	const absoluteRoot = path.resolve(rootPath)
	const openApiFiles = await findOpenApiFiles(absoluteRoot)

	const summaries = await Promise.all(
		openApiFiles.map(async (candidatePath) => buildApiSummary(absoluteRoot, candidatePath))
	)

	const apis = summaries.filter((summary): summary is ApiSummary => summary !== null)

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

			const extension = path.extname(entry.name).toLowerCase()
			if (entry.isFile() && OPENAPI_FILE_EXTENSIONS.has(extension)) {
				results.push(path.join(currentPath, entry.name))
			}
		}
	}

	await walk(rootPath)
	return results
}

async function buildApiSummary(workspaceRoot: string, candidateAbsolutePath: string): Promise<ApiSummary | null> {
	let parsedDocument: OpenApiDocument

	try {
		const raw = await fs.readFile(candidateAbsolutePath, 'utf8')
		const document = await parseAndNormalizeOpenApiSource(raw)
		if (!document) {
			return null
		}
		parsedDocument = document
	} catch {
		return null
	}

	const document = parsedDocument

	const openapiVersion = typeof document.openapi === 'string' ? document.openapi : ''
	if (!openapiVersion.startsWith('3.')) {
		return null
	}

	const apiDirectory = path.dirname(candidateAbsolutePath)
	const relativeApiPath = normalizeRelativePath(path.relative(workspaceRoot, apiDirectory))
	const relativeOpenapiPath = normalizeRelativePath(path.relative(workspaceRoot, candidateAbsolutePath))

	const operations = collectOperations(document.paths)

	return {
		id: toId(relativeOpenapiPath),
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
			if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
				continue
			}

			const operationObj = operation as Record<string, unknown>

			operations.push({
				method: method.toUpperCase() as HttpMethod,
				path: pathKey,
				operationId: typeof operationObj.operationId === 'string' ? operationObj.operationId : null,
				summary: typeof operationObj.summary === 'string' ? operationObj.summary : null
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

export { loadEnvironmentsConfig, saveEnvironmentsConfig } from './environments.js'
