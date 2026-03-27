import type { ApiStructure } from './api.js'

/**
 * Contents of .api-tool/metadata.json
 * Top-level workspace identity and timestamps.
 */
export interface WorkspaceMetadata {
  /** Schema version for forward-compatibility checks. */
  version: string
  workspaceId: string
  name: string
  /** ISO 8601 timestamp. */
  createdAt: string
  /** ISO 8601 timestamp. */
  updatedAt: string
}

/**
 * Contents of .api-tool/structure.json
 * Stores the full folder/group hierarchy for all APIs in the workspace.
 */
export interface StructureConfig {
  /** Schema version for forward-compatibility checks. */
  version: string
  apis: ApiStructure[]
}
