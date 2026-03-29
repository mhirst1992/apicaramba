import { app, BrowserWindow, dialog, ipcMain, IpcMainEvent } from 'electron'
import { promises as fs } from 'node:fs'
import { join, resolve } from 'path'
import {
  loadWorkspaceSnapshot,
  loadApiEditor,
  buildUpdatedDocument,
  saveStructure,
  loadEnvironmentsConfig,
  saveEnvironmentsConfig
} from '@apicaramba/core-model'
import { validateOpenApiDocument } from '@apicaramba/validation'
import { writeJsonFile } from '@apicaramba/import-export'
import type {
  OpenWorkspaceResult,
  CreateWorkspaceRequest,
  CreateWorkspaceResult,
  RecentWorkspace,
  OpenRecentWorkspaceRequest,
  LoadRecentWorkspacesResult,
  OpenRecentWorkspaceResult,
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

const isDev = !app.isPackaged
const appIconPath = resolve(__dirname, '../../resources/icon.ico')
const RECENT_WORKSPACES_FILE = 'recent-workspaces.json'
const RECENT_WORKSPACES_MAX = 8

let mainWindow: BrowserWindow | null = null

interface BootstrapOpenApiDocument {
  openapi: string
  info: {
    title: string
    version: string
  }
  paths: Record<string, never>
}

interface RecentWorkspacesConfig {
  version: string
  workspaces: RecentWorkspace[]
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0f1117',
    icon: appIconPath,
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized'))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:unmaximized'))

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function openWorkspaceDialog(): Promise<OpenWorkspaceResult> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Open {api:caramba} Workspace'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { status: 'cancelled' }
  }

  const selectedPath = result.filePaths[0]
  if (!selectedPath) {
    return { status: 'cancelled' }
  }

  try {
    const snapshot = await loadWorkspaceSnapshot(selectedPath)
    await addRecentWorkspace(snapshot.workspace)
    return { status: 'selected', snapshot }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open workspace.'
    return {
      status: 'error',
      message
    }
  }
}

async function createWorkspaceDialog(
  request: CreateWorkspaceRequest
): Promise<CreateWorkspaceResult> {
  const workspaceName = request.name.trim()
  if (!workspaceName) {
    return { status: 'error', message: 'Workspace name is required.' }
  }

  const locationResult = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose where to create workspace'
  })

  if (locationResult.canceled || locationResult.filePaths.length === 0) {
    return { status: 'cancelled' }
  }

  const parentPath = locationResult.filePaths[0]
  if (!parentPath) {
    return { status: 'cancelled' }
  }

  const workspacePath = join(parentPath, workspaceName)

  try {
    await fs.mkdir(workspacePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return {
        status: 'error',
        message: 'A folder with that workspace name already exists at this location.'
      }
    }

    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create workspace folder.'
    }
  }

  try {
    await createWorkspaceBootstrapFiles(workspacePath, workspaceName)
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to initialize workspace files.'
    }
  }

  try {
    const snapshot = await loadWorkspaceSnapshot(workspacePath)
    await addRecentWorkspace(snapshot.workspace)
    return { status: 'selected', snapshot }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Workspace created but failed to open.'
    }
  }
}

function recentWorkspacesConfigPath(): string {
  return join(app.getPath('userData'), RECENT_WORKSPACES_FILE)
}

async function loadRecentWorkspaceEntries(): Promise<RecentWorkspace[]> {
  try {
    const raw = await fs.readFile(recentWorkspacesConfigPath(), 'utf8')
    const parsed = JSON.parse(raw) as RecentWorkspacesConfig

    if (!Array.isArray(parsed.workspaces)) {
      return []
    }

    return parsed.workspaces.filter((entry) =>
      typeof entry.name === 'string' &&
      typeof entry.rootPath === 'string' &&
      typeof entry.lastOpenedAt === 'string'
    )
  } catch {
    return []
  }
}

async function saveRecentWorkspaceEntries(entries: RecentWorkspace[]): Promise<void> {
  const config: RecentWorkspacesConfig = {
    version: '1.0.0',
    workspaces: entries.slice(0, RECENT_WORKSPACES_MAX)
  }
  await writeJsonFile(recentWorkspacesConfigPath(), config)
}

function compareWorkspacePath(a: string, b: string): boolean {
  return process.platform === 'win32'
    ? a.toLowerCase() === b.toLowerCase()
    : a === b
}

async function addRecentWorkspace(workspace: { name: string; rootPath: string }): Promise<void> {
  const existing = await loadRecentWorkspaceEntries()
  const deduped = existing.filter((entry) => !compareWorkspacePath(entry.rootPath, workspace.rootPath))
  const next: RecentWorkspace[] = [
    {
      name: workspace.name,
      rootPath: workspace.rootPath,
      lastOpenedAt: new Date().toISOString()
    },
    ...deduped
  ]

  await saveRecentWorkspaceEntries(next)
}

async function handleLoadRecentWorkspaces(): Promise<LoadRecentWorkspacesResult> {
  try {
    const entries = await loadRecentWorkspaceEntries()
    return { status: 'loaded', workspaces: entries }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load recent workspaces.'
    }
  }
}

async function handleOpenRecentWorkspace(
  request: OpenRecentWorkspaceRequest
): Promise<OpenRecentWorkspaceResult> {
  const rootPath = request.rootPath?.trim()
  if (!rootPath) {
    return { status: 'error', message: 'Workspace path is required.' }
  }

  try {
    const snapshot = await loadWorkspaceSnapshot(rootPath)
    await addRecentWorkspace(snapshot.workspace)
    return { status: 'selected', snapshot }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to open workspace.'
    }
  }
}

async function createWorkspaceBootstrapFiles(
  workspacePath: string,
  workspaceName: string
): Promise<void> {
  const openapiPath = join(workspacePath, 'openapi.json')
  const openapiDoc: BootstrapOpenApiDocument = {
    openapi: '3.0.3',
    info: {
      title: workspaceName,
      version: '1.0.0'
    },
    paths: {}
  }

  await writeJsonFile(openapiPath, openapiDoc)

  await saveStructure(workspacePath, {
    id: 'openapi.json',
    name: workspaceName,
    path: '',
    rootFolder: {
      id: 'openapi.json__root',
      name: 'root',
      children: [],
      operations: []
    },
    ungrouped: []
  })

  await saveEnvironmentsConfig(workspacePath, {
    version: '1.0.0',
    activeEnvironmentId: 'default',
    environments: [
      {
        id: 'default',
        name: 'Default',
        baseUrl: '',
        variables: []
      }
    ]
  })
}

async function validateOpenApi(request: ValidateOpenApiRequest): Promise<ValidateOpenApiResult> {
  return validateOpenApiDocument(request)
}

async function handleLoadApiEditor(request: LoadApiEditorRequest): Promise<LoadApiEditorResult> {
  try {
    const { structure, operations } = await loadApiEditor(
      request.workspaceRootPath,
      request.openapiRelativePath
    )
    return { status: 'loaded', structure, operations }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Failed to load API.' }
  }
}

async function handleSaveApiEditor(request: SaveApiEditorRequest): Promise<SaveApiEditorResult> {
  const absPath = resolve(request.workspaceRootPath, request.openapiRelativePath)
  const tempPath = absPath + '.tmp'

  try {
    const rawJson = await fs.readFile(absPath, 'utf8')
    const updatedJson = buildUpdatedDocument(rawJson, request.operations)

    // Write to temp file first so we can validate without touching the real file
    await fs.writeFile(tempPath, updatedJson, 'utf8')

    const validationResult = await validateOpenApiDocument({
      workspaceRootPath: request.workspaceRootPath,
      openapiRelativePath: request.openapiRelativePath + '.tmp'
    })

    if (validationResult.status === 'invalid') {
      await fs.unlink(tempPath).catch(() => undefined)
      return {
        status: 'validation-failed',
        issueCount: validationResult.issueCount,
        issues: validationResult.issues
      }
    }

    if (validationResult.status === 'error') {
      await fs.unlink(tempPath).catch(() => undefined)
      return {
        status: 'validation-failed',
        issueCount: 1,
        issues: [{ message: validationResult.message, path: null }]
      }
    }

    // Validation passed - commit the write
    await writeJsonFile(absPath, JSON.parse(updatedJson) as unknown)
    await fs.unlink(tempPath).catch(() => undefined)

    // Persist structure (creates .api-tool/ if not present)
    await saveStructure(request.workspaceRootPath, request.structure)

    return { status: 'saved' }
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined)
    return { status: 'error', message: error instanceof Error ? error.message : 'Save failed.' }
  }
}

async function loadEnvironments(
  request: LoadEnvironmentsRequest
): Promise<LoadEnvironmentsResult> {
  try {
    const config = await loadEnvironmentsConfig(request.workspaceRootPath)
    return { status: 'loaded', config }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load environments.'
    }
  }
}

async function saveEnvironments(
  request: SaveEnvironmentsRequest
): Promise<SaveEnvironmentsResult> {
  try {
    const config = await saveEnvironmentsConfig(request.workspaceRootPath, request.config)
    return { status: 'saved', config }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to save environments.'
    }
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.apicaramba.desktop')
  }

  ipcMain.handle('workspace:open', openWorkspaceDialog)
  ipcMain.handle('workspace:create', (_, request: CreateWorkspaceRequest) =>
    createWorkspaceDialog(request)
  )
  ipcMain.handle('workspace:list-recent', handleLoadRecentWorkspaces)
  ipcMain.handle('workspace:open-recent', (_, request: OpenRecentWorkspaceRequest) =>
    handleOpenRecentWorkspace(request)
  )
  ipcMain.handle('openapi:validate', (_, request: ValidateOpenApiRequest) => validateOpenApi(request))
  ipcMain.handle('openapi:load-editor', (_, request: LoadApiEditorRequest) => handleLoadApiEditor(request))
  ipcMain.handle('openapi:save-editor', (_, request: SaveApiEditorRequest) => handleSaveApiEditor(request))
  ipcMain.handle('environments:load', (_, request: LoadEnvironmentsRequest) => loadEnvironments(request))
  ipcMain.handle('environments:save', (_, request: SaveEnvironmentsRequest) => saveEnvironments(request))
  ipcMain.on('window:minimize', (_e: IpcMainEvent) => mainWindow?.minimize())
  ipcMain.on('window:toggle-maximize', (_e: IpcMainEvent) => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', (_e: IpcMainEvent) => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)

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
  ipcMain.removeHandler('workspace:create')
  ipcMain.removeHandler('workspace:list-recent')
  ipcMain.removeHandler('workspace:open-recent')
  ipcMain.removeHandler('openapi:validate')
  ipcMain.removeHandler('openapi:load-editor')
  ipcMain.removeHandler('openapi:save-editor')
  ipcMain.removeHandler('environments:load')
  ipcMain.removeHandler('environments:save')
  ipcMain.removeAllListeners('window:minimize')
  ipcMain.removeAllListeners('window:toggle-maximize')
  ipcMain.removeAllListeners('window:close')
  ipcMain.removeHandler('window:is-maximized')
})
