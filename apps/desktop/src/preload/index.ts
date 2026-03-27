import { contextBridge, ipcRenderer } from 'electron'
import type { OpenWorkspaceResult } from '@apicaramba/shared-types'

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
}

const bridge: AppBridge = {
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  platform: process.platform,
  openWorkspace: () => ipcRenderer.invoke('workspace:open') as Promise<OpenWorkspaceResult>
}

contextBridge.exposeInMainWorld('appBridge', bridge)
