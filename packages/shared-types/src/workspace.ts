/**
 * Represents a workspace — a single Git repository opened by the tool.
 */
export interface Workspace {
  id: string
  name: string
  /** Absolute path to the repository root on the local filesystem. */
  rootPath: string
}
