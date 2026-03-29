import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { HttpMethod, WorkspaceSnapshot, OperationSummary, ApiSummary } from '@apicaramba/shared-types'
import swagger2openapi from 'swagger2openapi'

export { loadApiEditor, buildUpdatedDocument, saveStructure } from './editor.js'

const JSON_FILE_EXTENSION = '.json'
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
	swagger?: unknown
	definitions?: unknown
	securityDefinitions?: unknown
	schemes?: unknown
	consumes?: unknown
	produces?: unknown
	info?: OpenApiInfo
	paths?: Record<string, Record<string, OpenApiOperation> | undefined>
}

interface SwaggerConversionResult {
	openapi: unknown
}

interface Swagger2OpenApiConverter {
	convertObj: (
		source: unknown,
		options: {
			patch?: boolean
			warnOnly?: boolean
			resolve?: boolean
		}
	) => Promise<SwaggerConversionResult>
}

const swaggerConverter = swagger2openapi as unknown as Swagger2OpenApiConverter

export async function loadWorkspaceSnapshot(rootPath: string): Promise<WorkspaceSnapshot> {
	const absoluteRoot = path.resolve(rootPath)
	const jsonFiles = await findJsonFiles(absoluteRoot)

	const summaries = await Promise.all(
		jsonFiles.map(async (candidatePath) => buildApiSummary(absoluteRoot, candidatePath))
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

async function findJsonFiles(rootPath: string): Promise<string[]> {
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

			if (entry.isFile() && entry.name.toLowerCase().endsWith(JSON_FILE_EXTENSION)) {
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
		parsedDocument = JSON.parse(raw) as OpenApiDocument
	} catch {
		return null
	}

	const document = await normalizeToOpenApi3(parsedDocument)
	if (!document) {
		return null
	}

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

async function normalizeToOpenApi3(
	document: OpenApiDocument
): Promise<OpenApiDocument | null> {
	const openapiVersion = typeof document.openapi === 'string' ? document.openapi : ''
	if (openapiVersion.startsWith('3.')) {
		return document
	}

	const swaggerVersion = typeof document.swagger === 'string' ? document.swagger : ''
	if (swaggerVersion.length === 0) {
		return null
	}

	const sourceForConversion = coerceSwaggerVersionForConversion(document)

	try {
		const converted = await swaggerConverter.convertObj(sourceForConversion, {
			patch: true,
			warnOnly: true,
			resolve: false
		})

		if (!isObject(converted.openapi)) {
			return null
		}

		return converted.openapi as OpenApiDocument
	} catch {
		return null
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

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function coerceSwaggerVersionForConversion(document: OpenApiDocument): OpenApiDocument {
	const swaggerVersion = typeof document.swagger === 'string' ? document.swagger : ''
	if (!swaggerVersion.startsWith('3.')) {
		return document
	}

	const looksLikeSwagger2 =
		document.definitions !== undefined ||
		document.securityDefinitions !== undefined ||
		document.schemes !== undefined ||
		document.consumes !== undefined ||
		document.produces !== undefined

	if (!looksLikeSwagger2) {
		return document
	}

	return {
		...document,
		swagger: '2.0'
	}
}

export { loadEnvironmentsConfig, saveEnvironmentsConfig } from './environments.js'
