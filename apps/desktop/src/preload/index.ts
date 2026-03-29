import { contextBridge, ipcRenderer } from 'electron'
import type {
  OpenWorkspaceResult,
  CreateWorkspaceRequest,
  CreateWorkspaceResult,
  LoadRecentWorkspacesResult,
  OpenRecentWorkspaceRequest,
  OpenRecentWorkspaceResult,
  CreateApiRequest,
  CreateApiResult,
  ValidateOpenApiRequest,
  ValidateOpenApiResult,
  LoadApiEditorRequest,
  LoadApiEditorResult,
  SaveApiEditorRequest,
  SaveApiEditorResult,
  LoadEnvironmentsRequest,
  LoadEnvironmentsResult,
  SaveEnvironmentsRequest,
  SaveEnvironmentsResult
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
  createWorkspace: (request: CreateWorkspaceRequest) => Promise<CreateWorkspaceResult>
  loadRecentWorkspaces: () => Promise<LoadRecentWorkspacesResult>
  openRecentWorkspace: (request: OpenRecentWorkspaceRequest) => Promise<OpenRecentWorkspaceResult>
  createApi: (request: CreateApiRequest) => Promise<CreateApiResult>
  validateOpenApi: (request: ValidateOpenApiRequest) => Promise<ValidateOpenApiResult>
  loadApiEditor: (request: LoadApiEditorRequest) => Promise<LoadApiEditorResult>
  saveApiEditor: (request: SaveApiEditorRequest) => Promise<SaveApiEditorResult>
  loadEnvironments: (request: LoadEnvironmentsRequest) => Promise<LoadEnvironmentsResult>
  saveEnvironments: (request: SaveEnvironmentsRequest) => Promise<SaveEnvironmentsResult>
  windowControls: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximizeChange: (cb: (maximized: boolean) => void) => void
  }
}

const bridge: AppBridge = {
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  platform: process.platform,
  openWorkspace: () => ipcRenderer.invoke('workspace:open') as Promise<OpenWorkspaceResult>,
  createWorkspace: (request: CreateWorkspaceRequest) =>
    ipcRenderer.invoke('workspace:create', request) as Promise<CreateWorkspaceResult>,
  loadRecentWorkspaces: () =>
    ipcRenderer.invoke('workspace:list-recent') as Promise<LoadRecentWorkspacesResult>,
  openRecentWorkspace: (request: OpenRecentWorkspaceRequest) =>
    ipcRenderer.invoke('workspace:open-recent', request) as Promise<OpenRecentWorkspaceResult>,
  createApi: (request: CreateApiRequest) =>
    ipcRenderer.invoke('workspace:create-api', request) as Promise<CreateApiResult>,
  validateOpenApi: (request: ValidateOpenApiRequest) =>
    ipcRenderer.invoke('openapi:validate', request) as Promise<ValidateOpenApiResult>,
  loadApiEditor: (request: LoadApiEditorRequest) =>
    ipcRenderer.invoke('openapi:load-editor', request) as Promise<LoadApiEditorResult>,
  saveApiEditor: (request: SaveApiEditorRequest) =>
    ipcRenderer.invoke('openapi:save-editor', request) as Promise<SaveApiEditorResult>,
  loadEnvironments: (request: LoadEnvironmentsRequest) =>
    ipcRenderer.invoke('environments:load', request) as Promise<LoadEnvironmentsResult>,
  saveEnvironments: (request: SaveEnvironmentsRequest) =>
    ipcRenderer.invoke('environments:save', request) as Promise<SaveEnvironmentsResult>,
  windowControls: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
    onMaximizeChange: (cb: (maximized: boolean) => void) => {
      ipcRenderer.on('window:maximized', () => cb(true))
      ipcRenderer.on('window:unmaximized', () => cb(false))
    }
  }
}

contextBridge.exposeInMainWorld('appBridge', bridge)
