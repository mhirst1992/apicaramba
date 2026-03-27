import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'path'
import { loadWorkspaceSnapshot } from '@apicaramba/core-model'
import type { OpenWorkspaceResult } from '@apicaramba/shared-types'

const isDev = !app.isPackaged

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0f1117',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function openWorkspaceDialog(): Promise<OpenWorkspaceResult> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Open APICaramba Workspace'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { status: 'cancelled' }
  }

  const selectedPath = result.filePaths[0]
  if (!selectedPath) {
    return { status: 'cancelled' }
  }

  try {
    await fs.access(join(selectedPath, '.git'))
  } catch {
    return {
      status: 'error',
      message: 'Selected folder is not a Git repository. Choose a cloned repository root.'
    }
  }

  try {
    const snapshot = await loadWorkspaceSnapshot(selectedPath)
    return { status: 'selected', snapshot }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open workspace.'
    return {
      status: 'error',
      message
    }
  }
}

app.whenReady().then(() => {
  ipcMain.handle('workspace:open', openWorkspaceDialog)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  ipcMain.removeHandler('workspace:open')
})
