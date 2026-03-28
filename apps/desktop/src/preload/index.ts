import { contextBridge, ipcRenderer } from 'electron'
import type {
  OpenWorkspaceResult,
  ValidateOpenApiRequest,
  ValidateOpenApiResult,
  LoadApiEditorRequest,
  LoadApiEditorResult,
  SaveApiEditorRequest,
  SaveApiEditorResult
} from '@apicaramba/shared-types'

/**
 * Exposes a minimal, safe API surface to the renderer via contextBridge.
 * Expanded in Phase 1 with workspace and file system operations.
 */

export interface AppBridge {
  versions: {
    node: string
    chrome: string
    electron: string
  }
  platform: NodeJS.Platform
  openWorkspace: () => Promise<OpenWorkspaceResult>
  validateOpenApi: (request: ValidateOpenApiRequest) => Promise<ValidateOpenApiResult>
  loadApiEditor: (request: LoadApiEditorRequest) => Promise<LoadApiEditorResult>
  saveApiEditor: (request: SaveApiEditorRequest) => Promise<SaveApiEditorResult>
}

const bridge: AppBridge = {
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  platform: process.platform,
  openWorkspace: () => ipcRenderer.invoke('workspace:open') as Promise<OpenWorkspaceResult>,
  validateOpenApi: (request: ValidateOpenApiRequest) =>
    ipcRenderer.invoke('openapi:validate', request) as Promise<ValidateOpenApiResult>,
  loadApiEditor: (request: LoadApiEditorRequest) =>
    ipcRenderer.invoke('openapi:load-editor', request) as Promise<LoadApiEditorResult>,
  saveApiEditor: (request: SaveApiEditorRequest) =>
    ipcRenderer.invoke('openapi:save-editor', request) as Promise<SaveApiEditorResult>
}

contextBridge.exposeInMainWorld('appBridge', bridge)
