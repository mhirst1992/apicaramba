/**
 * HTTP methods supported by OpenAPI 3.x operations.
 */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'TRACE'

/**
 * A reference to an API within a workspace.
 * Points to its directory and source OpenAPI JSON location.
 */
export interface ApiReference {
  id: string
  name: string
  /** Relative path to the API directory from workspace root. e.g. "apis/payments" */
  path: string
  /** Relative path to the OpenAPI source JSON. e.g. "apis/payments/payments-spec.json" */
  openapiPath: string
}

/**
 * A lightweight reference to a single OpenAPI operation within the tool's internal model.
 */
export interface OperationRef {
  id: string
  /** The operationId from the OpenAPI document, if present. */
  operationId: string | null
  method: HttpMethod
  /** The path template. e.g. "/payments/{id}" */
  path: string
}

/**
 * A folder node used to organise operations in the sidebar tree.
 * Folders can be nested arbitrarily.
 */
export interface FolderNode {
  id: string
  name: string
  children: FolderNode[]
  operations: OperationRef[]
}

/**
 * The full structural metadata for a single API.
 * Stored as part of .api-tool/structure.json.
 */
export interface ApiStructure {
  id: string
  name: string
  /** Relative path to the API directory from workspace root. */
  path: string
  /** Root folder containing the organised endpoint tree. */
  rootFolder: FolderNode
  /** Operations not yet placed into any folder (e.g. newly imported). */
  ungrouped: OperationRef[]
}
