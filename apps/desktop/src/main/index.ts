import { app, BrowserWindow, dialog, ipcMain, IpcMainEvent } from 'electron'
import { promises as fs } from 'node:fs'
import { dirname, join, resolve } from 'path'
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
import { executeRequest } from '@apicaramba/request-execution'
import type {
  OpenWorkspaceResult,
  CreateWorkspaceRequest,
  CreateWorkspaceResult,
  CreateApiRequest,
  CreateApiResult,
  RecentWorkspace,
  OpenRecentWorkspaceRequest,
  RemoveRecentWorkspaceRequest,
  LoadRecentWorkspacesResult,
  OpenRecentWorkspaceResult,
  RemoveRecentWorkspaceResult,
  ValidateOpenApiRequest,
  ValidateOpenApiResult,
  LoadApiEditorRequest,
  LoadApiEditorResult,
  SaveApiEditorRequest,
  SaveApiEditorResult,
  LoadEnvironmentsRequest,
  LoadEnvironmentsResult,
  SaveEnvironmentsRequest,
  SaveEnvironmentsResult,
  ExecuteRequestRequest,
  ApiStructure
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

interface NewApiDocument {
  openapi: string
  info: {
    title: string
    version: string
  }
  paths: Record<string, never>
}

function toJsonOpenApiRelativePath(relativePath: string): string {
  if (relativePath.toLowerCase().endsWith('.yaml')) {
    return relativePath.slice(0, -5) + '.json'
  }
  if (relativePath.toLowerCase().endsWith('.yml')) {
    return relativePath.slice(0, -4) + '.json'
  }
  return relativePath
}

function toStructureId(input: string): string {
  return input.replaceAll('\\', '/').toLowerCase().replace(/[^a-z0-9/._-]+/g, '-').replaceAll('/', '__')
}

function migrateStructureForPath(structure: ApiStructure, openapiRelativePath: string): ApiStructure {
  const nextId = toStructureId(openapiRelativePath)
  if (structure.id === nextId) {
    return structure
  }

  return {
    ...structure,
    id: nextId,
    rootFolder: {
      ...structure.rootFolder,
      id: `${nextId}__root`
    }
  }
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

async function handleRemoveRecentWorkspace(
  request: RemoveRecentWorkspaceRequest
): Promise<RemoveRecentWorkspaceResult> {
  const rootPath = request.rootPath?.trim()
  if (!rootPath) {
    return { status: 'error', message: 'Workspace path is required.' }
  }

  try {
    const existing = await loadRecentWorkspaceEntries()
    const filtered = existing.filter((entry) => !compareWorkspacePath(entry.rootPath, rootPath))
    await saveRecentWorkspaceEntries(filtered)
    return { status: 'updated', workspaces: filtered }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to remove recent workspace.'
    }
  }
}

async function handleCreateApi(request: CreateApiRequest): Promise<CreateApiResult> {
  const workspaceRootPath = request.workspaceRootPath?.trim()
  const apiName = request.apiName?.trim()

  if (!workspaceRootPath) {
    return { status: 'error', message: 'Workspace path is required.' }
  }

  if (!apiName) {
    return { status: 'error', message: 'API name is required.' }
  }

  const baseFileName = slugifyFileStem(apiName)

  try {
    const fileName = await resolveUniqueApiFileName(workspaceRootPath, baseFileName)
    const apiDoc: NewApiDocument = {
      openapi: '3.0.3',
      info: {
        title: apiName,
        version: '1.0.0'
      },
      paths: {}
    }

    await writeJsonFile(join(workspaceRootPath, fileName), apiDoc)

    const snapshot = await loadWorkspaceSnapshot(workspaceRootPath)
    return { status: 'created', snapshot }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create API.'
    }
  }
}

function slugifyFileStem(input: string): string {
  const stem = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')

  return stem.length > 0 ? stem : 'api'
}

async function resolveUniqueApiFileName(workspaceRootPath: string, baseStem: string): Promise<string> {
  let index = 0

  while (index < 1000) {
    const fileName = index === 0 ? `${baseStem}.json` : `${baseStem}-${index + 1}.json`
    const candidatePath = join(workspaceRootPath, fileName)

    try {
      await fs.access(candidatePath)
      index += 1
      continue
    } catch {
      return fileName
    }
  }

  throw new Error('Could not allocate a filename for the new API.')
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
  const sourceRelativePath = request.openapiRelativePath
  const targetRelativePath = toJsonOpenApiRelativePath(sourceRelativePath)
  const sourceAbsPath = resolve(request.workspaceRootPath, sourceRelativePath)
  const targetAbsPath = resolve(request.workspaceRootPath, targetRelativePath)
  const tempPath = targetAbsPath + '.tmp'

  try {
    if (sourceAbsPath !== targetAbsPath) {
      try {
        await fs.access(targetAbsPath)
        return {
          status: 'error',
          message: `Cannot save as JSON because ${targetRelativePath} already exists.`
        }
      } catch {
        // Target does not exist yet - safe to migrate.
      }
    }

    const rawSource = await fs.readFile(sourceAbsPath, 'utf8')
    const updatedJson = await buildUpdatedDocument(rawSource, request.operations)

    // Write to temp file first so we can validate without touching the real file
    await fs.writeFile(tempPath, updatedJson, 'utf8')

    const validationResult = await validateOpenApiDocument({
      workspaceRootPath: request.workspaceRootPath,
      openapiRelativePath: targetRelativePath + '.tmp'
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
    await fs.mkdir(dirname(targetAbsPath), { recursive: true })
    await writeJsonFile(targetAbsPath, JSON.parse(updatedJson) as unknown)
    await fs.unlink(tempPath).catch(() => undefined)

    if (sourceAbsPath !== targetAbsPath) {
      await fs.unlink(sourceAbsPath).catch(() => undefined)
    }

    // Persist structure (creates .api-tool/ if not present)
    const migratedStructure = migrateStructureForPath(request.structure, targetRelativePath)
    await saveStructure(request.workspaceRootPath, migratedStructure, [request.structure.id])

    const snapshot = await loadWorkspaceSnapshot(request.workspaceRootPath)

    return { status: 'saved', openapiRelativePath: targetRelativePath, snapshot }
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
  ipcMain.handle('workspace:remove-recent', (_, request: RemoveRecentWorkspaceRequest) =>
    handleRemoveRecentWorkspace(request)
  )
  ipcMain.handle('workspace:create-api', (_, request: CreateApiRequest) => handleCreateApi(request))
  ipcMain.handle('openapi:validate', (_, request: ValidateOpenApiRequest) => validateOpenApi(request))
  ipcMain.handle('openapi:load-editor', (_, request: LoadApiEditorRequest) => handleLoadApiEditor(request))
  ipcMain.handle('openapi:save-editor', (_, request: SaveApiEditorRequest) => handleSaveApiEditor(request))
  ipcMain.handle('environments:load', (_, request: LoadEnvironmentsRequest) => loadEnvironments(request))
  ipcMain.handle('environments:save', (_, request: SaveEnvironmentsRequest) => saveEnvironments(request))
  ipcMain.handle('request:execute', (_, request: ExecuteRequestRequest) => executeRequest(request))
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
  ipcMain.removeHandler('workspace:remove-recent')
  ipcMain.removeHandler('workspace:create-api')
  ipcMain.removeHandler('openapi:validate')
  ipcMain.removeHandler('openapi:load-editor')
  ipcMain.removeHandler('openapi:save-editor')
  ipcMain.removeHandler('environments:load')
  ipcMain.removeHandler('environments:save')
  ipcMain.removeHandler('request:execute')
  ipcMain.removeAllListeners('window:minimize')
  ipcMain.removeAllListeners('window:toggle-maximize')
  ipcMain.removeAllListeners('window:close')
  ipcMain.removeHandler('window:is-maximized')
})