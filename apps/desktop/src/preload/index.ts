import { contextBridge } from 'electron'

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
}

const bridge: AppBridge = {
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('appBridge', bridge)
