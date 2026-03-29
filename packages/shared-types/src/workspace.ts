import type { HttpMethod } from './api.js'

/**
 * Represents a workspace — a single Git repository opened by the tool.
 */
export interface Workspace {
  id: string
  name: string
  /** Absolute path to the repository root on the local filesystem. */
  rootPath: string
}

export interface OperationSummary {
  method: HttpMethod
  path: string
  operationId: string | null
  summary: string | null
}

export interface ApiSummary {
  id: string
  name: string
  path: string
  openapiPath: string
  title: string | null
  version: string | null
  operationCount: number
  operations: OperationSummary[]
}

export interface WorkspaceSnapshot {
  workspace: Workspace
  apis: ApiSummary[]
}

export interface CreateWorkspaceRequest {
  name: string
}

export interface RecentWorkspace {
  name: string
  rootPath: string
  lastOpenedAt: string
}

export interface OpenRecentWorkspaceRequest {
  rootPath: string
}

export interface CreateApiRequest {
  workspaceRootPath: string
  apiName: string
}

export type OpenWorkspaceResult =
  | { status: 'cancelled' }
  | { status: 'selected'; snapshot: WorkspaceSnapshot }
  | { status: 'error'; message: string }

export type CreateWorkspaceResult =
  | { status: 'cancelled' }
  | { status: 'selected'; snapshot: WorkspaceSnapshot }
  | { status: 'error'; message: string }

export type LoadRecentWorkspacesResult =
  | { status: 'loaded'; workspaces: RecentWorkspace[] }
  | { status: 'error'; message: string }

export type OpenRecentWorkspaceResult =
  | { status: 'selected'; snapshot: WorkspaceSnapshot }
  | { status: 'error'; message: string }

export type CreateApiResult =
  | { status: 'created'; snapshot: WorkspaceSnapshot }
  | { status: 'error'; message: string }
