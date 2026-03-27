export interface ValidateOpenApiRequest {
  workspaceRootPath: string
  openapiRelativePath: string
}

export interface OpenApiValidationIssue {
  message: string
  path: string | null
}

export type ValidateOpenApiResult =
  | { status: 'valid'; issueCount: 0; issues: [] }
  | { status: 'invalid'; issueCount: number; issues: OpenApiValidationIssue[] }
  | { status: 'error'; message: string }
