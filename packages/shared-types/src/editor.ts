import type { HttpMethod } from './api.js'
import type { ApiStructure } from './api.js'
import type { OpenApiValidationIssue } from './validation.js'
import type { WorkspaceSnapshot } from './workspace.js'
import type { ParameterLocation } from './environments.js'

/**
 * A single operation with all fields needed for the editor panel.
 * Serves as both the load result and the save payload.
 */
export interface OperationDetail {
  /** Stable composite key: "{METHOD}:{path}" — used as the edit key. */
  key: string
  /** Original loaded key used to map edits back to the source operation when method/path are changed. */
  sourceKey?: string
  operationId: string | null
  method: HttpMethod
  path: string
  summary: string
  description: string
  tags: string[]
  /** Environment parameter IDs attached to this operation. */
  parameterIds: string[]
  /** Media type for request body schema, e.g. application/json. Empty string means no request body schema. */
  requestBodyMediaType: string
  /** Selected schema name from components.schemas. Empty means no schema assigned. */
  requestBodySchemaName: string
  /** Whether requestBody.required is set in OpenAPI. */
  requestBodyRequired: boolean
  /** Response schema assignment by status code, e.g. 200 -> PetResponse, 404 -> ErrorResponse. */
  responseSchemas: ResponseSchemaAssignment[]
  /** Request-level custom parameters stored specifically against this operation (not in the global environment). */
  customParameters?: RequestCustomParameter[]
}

/**
 * A parameter defined at request level, stored with the operation rather than in the global environment.
 */
export interface RequestCustomParameter {
  id: string
  name: string
  in: ParameterLocation
  description: string
  required: boolean
}

export interface ResponseSchemaAssignment {
  id: string
  responseCode: string
  schemaName: string
}

export type SchemaPropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
export type SchemaPrimitiveType = 'string' | 'number' | 'integer' | 'boolean'
export type SchemaCompositionType = 'allOf' | 'anyOf' | 'oneOf'

export type SchemaUsageTag = 'Rqst' | 'Resp' | 'Both'

export interface SchemaPropertyDetail {
  id: string
  name: string
  type: SchemaPropertyType
  /** For array properties, primitive type of each item when no schema reference is selected. */
  arrayItemType?: SchemaPrimitiveType
  /** For array properties, optional referenced schema name for each item. */
  arrayItemSchemaName?: string
  /** For object properties, optional referenced schema name. */
  objectSchemaName?: string
  /** For object properties, composition mode when referencing one or more schemas. */
  objectCompositionType?: SchemaCompositionType
  /** For object properties, optional referenced schema names used by the selected composition mode. */
  objectSchemaNames?: string[]
  /** OpenAPI discriminator.propertyName for composed object schemas. */
  objectDiscriminatorPropertyName?: string
  required: boolean
  description: string
}

export interface SchemaDetail {
  id: string
  name: string
  description: string
  /** User-assigned usage tag to drive schema pickers in the operation editor. */
  usageTag?: SchemaUsageTag
  properties: SchemaPropertyDetail[]
}

export interface LoadApiEditorRequest {
  workspaceRootPath: string
  /** Relative path from workspace root, e.g. "apis/payments/payments-spec.json" or "apis/payments/openapi.yaml" */
  openapiRelativePath: string
}

export type LoadApiEditorResult =
  | { status: 'loaded'; structure: ApiStructure; operations: OperationDetail[]; schemas: SchemaDetail[] }
  | { status: 'error'; message: string }

export interface SaveApiEditorRequest {
  workspaceRootPath: string
  /** Relative path to the current source file. May be .json, .yaml, or .yml. */
  openapiRelativePath: string
  /** Full list of operations with their current (possibly edited) field values. */
  operations: OperationDetail[]
  /** API-level reusable schemas (OpenAPI components.schemas). */
  schemas: SchemaDetail[]
  /** Current folder structure and ungrouped assignments for this API. */
  structure: ApiStructure
}

export type SaveApiEditorResult =
  | { status: 'saved'; openapiRelativePath: string; snapshot: WorkspaceSnapshot }
  | { status: 'validation-failed'; issueCount: number; issues: OpenApiValidationIssue[] }
  | { status: 'error'; message: string }
