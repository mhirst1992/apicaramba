import type { HttpMethod } from './api.js'
import type { ApiStructure } from './api.js'
import type { OpenApiValidationIssue } from './validation.js'
import type { WorkspaceSnapshot } from './workspace.js'

/**
 * A single operation with all fields needed for the editor panel.
 * Serves as both the load result and the save payload.
 */
export interface OperationDetail {
  /** Stable composite key: "{METHOD}:{path}" — used as the edit key. */
  key: string
  operationId: string | null
  method: HttpMethod
  path: string
  summary: string
  description: string
  tags: string[]
}

export interface LoadApiEditorRequest {
  workspaceRootPath: string
  /** Relative path from workspace root, e.g. "apis/payments/payments-spec.json" or "apis/payments/openapi.yaml" */
  openapiRelativePath: string
}

export type LoadApiEditorResult =
  | { status: 'loaded'; structure: ApiStructure; operations: OperationDetail[] }
  | { status: 'error'; message: string }

export interface SaveApiEditorRequest {
  workspaceRootPath: string
  /** Relative path to the current source file. May be .json, .yaml, or .yml. */
  openapiRelativePath: string
  /** Full list of operations with their current (possibly edited) field values. */
  operations: OperationDetail[]
  /** Current folder structure and ungrouped assignments for this API. */
  structure: ApiStructure
}

export type SaveApiEditorResult =
  | { status: 'saved'; openapiRelativePath: string; snapshot: WorkspaceSnapshot }
  | { status: 'validation-failed'; issueCount: number; issues: OpenApiValidationIssue[] }
  | { status: 'error'; message: string }
