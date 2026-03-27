import { resolve } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import type {
	ValidateOpenApiRequest,
	ValidateOpenApiResult,
	OpenApiValidationIssue
} from '@apicaramba/shared-types'

interface MaybeValidationDetail {
	message?: unknown
	path?: unknown
}

interface MaybeValidationError {
	message?: unknown
	details?: unknown
}

export async function validateOpenApiDocument(
	request: ValidateOpenApiRequest
): Promise<ValidateOpenApiResult> {
	const filePath = resolve(request.workspaceRootPath, request.openapiRelativePath)

	try {
		await SwaggerParser.validate(filePath)
		return {
			status: 'valid',
			issueCount: 0,
			issues: []
		}
	} catch (error) {
		const issues = extractIssues(error)
		if (issues.length > 0) {
			return {
				status: 'invalid',
				issueCount: issues.length,
				issues
			}
		}

		const message = error instanceof Error ? error.message : 'Validation failed.'
		return {
			status: 'error',
			message
		}
	}
}

function extractIssues(error: unknown): OpenApiValidationIssue[] {
	if (!isObject(error)) {
		return []
	}

	const maybeError = error as MaybeValidationError
	const details = maybeError.details
	if (!Array.isArray(details)) {
		return []
	}

	return details
		.filter(isObject)
		.map((detailObject) => {
			const detail = detailObject as MaybeValidationDetail
			return {
				message: typeof detail.message === 'string' ? detail.message : 'Validation issue',
				path: typeof detail.path === 'string' ? detail.path : null
			}
		})
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}
