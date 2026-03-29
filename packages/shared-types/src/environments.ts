/**
 * A single variable within an environment.
 * Secret variables have their value stored in the OS credential store, not here.
 */
export interface EnvironmentVariable {
  id: string
  /** The variable name used in substitution, e.g. "AUTH_TOKEN" */
  name: string
  /**
   * The value for non-secret variables.
   * Always an empty string for secret variables — actual value lives in the OS credential store.
   */
  value: string
  /** When true, the value is stored in the OS credential store and never committed. */
  isSecret: boolean
  description?: string
}

/**
 * A named environment profile (e.g. "local", "dev", "staging").
 */
export interface Environment {
  id: string
  name: string
  /** Base URL for all requests in this environment. May contain variable references. */
  baseUrl: string
  variables: EnvironmentVariable[]
}

/**
 * Contents of .api-tool/environments.json
 * v1 supports a single active environment.
 */
export interface EnvironmentsConfig {
  /** Schema version for forward-compatibility checks. */
  version: string
  /** ID of the currently active environment. */
  activeEnvironmentId: string
  environments: Environment[]
}

export interface LoadEnvironmentsRequest {
  workspaceRootPath: string
  /** Relative path to the selected API OpenAPI source file. */
  openapiRelativePath: string
}

export type LoadEnvironmentsResult =
  | { status: 'loaded'; config: EnvironmentsConfig }
  | { status: 'error'; message: string }

export interface SaveEnvironmentsRequest {
  workspaceRootPath: string
  /** Relative path to the selected API OpenAPI source file. */
  openapiRelativePath: string
  config: EnvironmentsConfig
}

export type SaveEnvironmentsResult =
  | { status: 'saved'; config: EnvironmentsConfig }
  | { status: 'error'; message: string }
