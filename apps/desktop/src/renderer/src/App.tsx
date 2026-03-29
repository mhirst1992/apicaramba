import React from 'react'
import type {
  WorkspaceSnapshot,
  ApiSummary,
  RecentWorkspace,
  ValidateOpenApiResult,
  ApiStructure,
  FolderNode,
  OperationRef,
  OperationDetail,
  SchemaDetail,
  SchemaUsageTag,
  SchemaPropertyDetail,
  SchemaPrimitiveType,
  SchemaPropertyType,
  SaveApiEditorResult,
  EnvironmentsConfig,
  Environment,
  HttpMethod,
  EnvironmentParameter,
  ParameterLocation
} from '@apicaramba/shared-types'
import { EndpointTree } from './components/EndpointTree.js'
import { OperationEditor } from './components/OperationEditor.js'
import { RequestRunner } from './components/RequestRunner.js'

// --- Types -------------------------------------------------------------------

interface EditorState {
  api: ApiSummary
  structure: ApiStructure
  operations: OperationDetail[]
  schemas: SchemaDetail[]
}

const SCHEMAS_FOLDER_ID = '__schemas__'

type SaveStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | { type: 'validation-failed'; issues: { message: string; path: string | null }[] }
  | { type: 'error'; message: string }

// --- Root component -----------------------------------------------------------

export default function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = React.useState<WorkspaceSnapshot | null>(null)
  const [selectedApiId, setSelectedApiId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [openError, setOpenError] = React.useState<string | null>(null)

  // Editor state
  const [editorState, setEditorState] = React.useState<EditorState | null>(null)
  const [editedOps, setEditedOps] = React.useState<Record<string, OperationDetail>>({})
  const [editedSchemas, setEditedSchemas] = React.useState<Record<string, SchemaDetail>>({})
  const [selectedOpKey, setSelectedOpKey] = React.useState<string | null>(null)
  const [selectedSchemaId, setSelectedSchemaId] = React.useState<string | null>(null)
  const [editorLoading, setEditorLoading] = React.useState(false)
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle')

  // Validation
  const [validationResult, setValidationResult] = React.useState<ValidateOpenApiResult | null>(null)
  const [validating, setValidating] = React.useState(false)
  const [environmentsConfig, setEnvironmentsConfig] = React.useState<EnvironmentsConfig | null>(null)
  const [environmentsDraft, setEnvironmentsDraft] = React.useState<EnvironmentsConfig | null>(null)
  const [environmentsLoading, setEnvironmentsLoading] = React.useState(false)
  const [environmentsSaving, setEnvironmentsSaving] = React.useState(false)
  const [environmentsError, setEnvironmentsError] = React.useState<string | null>(null)
  const [environmentsMessage, setEnvironmentsMessage] = React.useState<string | null>(null)
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null)
  const [draggingOperationId, setDraggingOperationId] = React.useState<string | null>(null)
  const [draggingFolderId, setDraggingFolderId] = React.useState<string | null>(null)
  const [openApiMenuId, setOpenApiMenuId] = React.useState<string | null>(null)
  const [showEnvironmentPanel, setShowEnvironmentPanel] = React.useState(false)
  const [savedStructureHash, setSavedStructureHash] = React.useState('')
  const [showCreateFolderModal, setShowCreateFolderModal] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState('')
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = React.useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = React.useState('')
  const [newWorkspaceFirstApiName, setNewWorkspaceFirstApiName] = React.useState('')
  const [recentWorkspaces, setRecentWorkspaces] = React.useState<RecentWorkspace[]>([])
  const [showCreateApiModal, setShowCreateApiModal] = React.useState(false)
  const [newApiName, setNewApiName] = React.useState('')
  const [showRenameFolderModal, setShowRenameFolderModal] = React.useState(false)
  const [renameFolderTargetId, setRenameFolderTargetId] = React.useState<string | null>(null)
  const [renameFolderValue, setRenameFolderValue] = React.useState('')
  const [showCreateRequestModal, setShowCreateRequestModal] = React.useState(false)
  const [newRequestMethod, setNewRequestMethod] = React.useState<HttpMethod>('GET')
  const [newRequestPath, setNewRequestPath] = React.useState('')
  const [newRequestError, setNewRequestError] = React.useState<string | null>(null)
  const [showCreateSchemaModal, setShowCreateSchemaModal] = React.useState(false)
  const [newSchemaName, setNewSchemaName] = React.useState('')
  const [newSchemaUsageTag, setNewSchemaUsageTag] = React.useState<SchemaUsageTag>('Both')
  const [detailTab, setDetailTab] = React.useState<'edit' | 'run'>('edit')

  const selectedApi = React.useMemo(
    () => snapshot?.apis.find((a) => a.id === selectedApiId) ?? null,
    [snapshot, selectedApiId]
  )

  const isDirty = Object.keys(editedOps).length > 0
  const schemaDirty = Object.keys(editedSchemas).length > 0

  const mergedOperations: OperationDetail[] = React.useMemo(() => {
    if (!editorState) return []
    return editorState.operations.map((op) => editedOps[op.key] ?? op)
  }, [editorState, editedOps])

  const selectedOperation = React.useMemo(
    () => mergedOperations.find((op) => op.key === selectedOpKey) ?? null,
    [mergedOperations, selectedOpKey]
  )

  const mergedSchemas: SchemaDetail[] = React.useMemo(() => {
    if (!editorState) return []
    return editorState.schemas.map((schema) => editedSchemas[schema.id] ?? schema)
  }, [editorState, editedSchemas])

  const requestSchemas = React.useMemo(
    () => mergedSchemas.filter((schema) => (schema.usageTag ?? 'Both') !== 'Resp'),
    [mergedSchemas]
  )

  const responseSchemas = React.useMemo(
    () => mergedSchemas.filter((schema) => (schema.usageTag ?? 'Both') !== 'Rqst'),
    [mergedSchemas]
  )

  const selectedSchema = React.useMemo(
    () => mergedSchemas.find((schema) => schema.id === selectedSchemaId) ?? null,
    [mergedSchemas, selectedSchemaId]
  )

  React.useEffect(() => {
    void refreshRecentWorkspaces()
  }, [])

  async function refreshRecentWorkspaces(): Promise<void> {
    const result = await window.appBridge.loadRecentWorkspaces()
    if (result.status === 'error') {
      return
    }
    setRecentWorkspaces(result.workspaces)
  }

  async function initializeWorkspace(snapshotToLoad: WorkspaceSnapshot): Promise<void> {
    setSnapshot(snapshotToLoad)
    setSelectedApiId(snapshotToLoad.apis[0]?.id ?? null)
    setEditorState(null)
    setEditedOps({})
    setEditedSchemas({})
    setSelectedOpKey(null)
    setSelectedSchemaId(null)
    setSelectedFolderId(null)
    setSaveStatus('idle')
    setValidationResult(null)
    if (snapshotToLoad.apis[0]) {
      await loadEnvironmentsForApi(snapshotToLoad.workspace.rootPath, snapshotToLoad.apis[0].openapiPath)
      await loadEditorForApi(snapshotToLoad.workspace.rootPath, snapshotToLoad.apis[0])
    } else {
      setEnvironmentsConfig(null)
      setEnvironmentsDraft(null)
    }
  }

  async function onOpenWorkspace(): Promise<void> {
    setLoading(true)
    setOpenError(null)
    try {
      const result = await window.appBridge.openWorkspace()
      if (result.status === 'cancelled') return
      if (result.status === 'error') { setOpenError(result.message); return }
      await initializeWorkspace(result.snapshot)
      await refreshRecentWorkspaces()
    } finally {
      setLoading(false)
    }
  }

  async function onCreateWorkspace(): Promise<void> {
    const name = newWorkspaceName.trim()
    const firstApiName = newWorkspaceFirstApiName.trim()
    if (!name) {
      setOpenError('Workspace name is required.')
      return
    }

    if (!firstApiName) {
      setOpenError('First API name is required.')
      return
    }

    setLoading(true)
    setOpenError(null)
    try {
      const result = await window.appBridge.createWorkspace({ name, firstApiName })
      if (result.status === 'cancelled') return
      if (result.status === 'error') {
        setOpenError(result.message)
        return
      }

      setShowCreateWorkspaceModal(false)
      setNewWorkspaceName('')
      setNewWorkspaceFirstApiName('')
      await initializeWorkspace(result.snapshot)
      await refreshRecentWorkspaces()
    } finally {
      setLoading(false)
    }
  }

  async function onOpenRecentWorkspace(rootPath: string): Promise<void> {
    setLoading(true)
    setOpenError(null)
    try {
      const result = await window.appBridge.openRecentWorkspace({ rootPath })
      if (result.status === 'error') {
        setOpenError(result.message)
        await refreshRecentWorkspaces()
        return
      }

      await initializeWorkspace(result.snapshot)
      await refreshRecentWorkspaces()
    } finally {
      setLoading(false)
    }
  }

  async function onRemoveRecentWorkspace(rootPath: string): Promise<void> {
    setOpenError(null)
    const result = await window.appBridge.removeRecentWorkspace({ rootPath })
    if (result.status === 'error') {
      setOpenError(result.message)
      return
    }

    setRecentWorkspaces(result.workspaces)
  }

  async function onCreateApi(): Promise<void> {
    if (!snapshot) return

    const apiName = newApiName.trim()
    if (!apiName) {
      setOpenError('API name is required.')
      return
    }

    setLoading(true)
    setOpenError(null)
    try {
      const result = await window.appBridge.createApi({
        workspaceRootPath: snapshot.workspace.rootPath,
        apiName
      })

      if (result.status === 'error') {
        setOpenError(result.message)
        return
      }

      setShowCreateApiModal(false)
      setNewApiName('')
      await initializeWorkspace(result.snapshot)
    } finally {
      setLoading(false)
    }
  }

  function onReturnHome(): void {
    setSnapshot(null)
    setSelectedApiId(null)
    setEditorState(null)
    setEditedOps({})
    setEditedSchemas({})
    setSelectedOpKey(null)
    setSelectedSchemaId(null)
    setSelectedFolderId(null)
    setValidationResult(null)
    setSaveStatus('idle')
    setOpenApiMenuId(null)
    setShowEnvironmentPanel(false)
    setOpenError(null)
    void refreshRecentWorkspaces()
  }

  async function onSelectApi(api: ApiSummary): Promise<void> {
    if (!snapshot) return
    setSelectedApiId(api.id)
    setValidationResult(null)
    setSelectedFolderId(null)
    await loadEnvironmentsForApi(snapshot.workspace.rootPath, api.openapiPath)
    await loadEditorForApi(snapshot.workspace.rootPath, api)
  }

  async function loadEnvironmentsForApi(
    rootPath: string,
    openapiRelativePath: string
  ): Promise<void> {
    setEnvironmentsLoading(true)
    setEnvironmentsError(null)
    setEnvironmentsMessage(null)

    try {
      const result = await window.appBridge.loadEnvironments({
        workspaceRootPath: rootPath,
        openapiRelativePath
      })
      if (result.status === 'error') {
        setEnvironmentsError(result.message)
        setEnvironmentsConfig(null)
        setEnvironmentsDraft(null)
        return
      }

      setEnvironmentsConfig(result.config)
      setEnvironmentsDraft(result.config)
    } finally {
      setEnvironmentsLoading(false)
    }
  }

  function updateActiveEnvironment(patch: Partial<Environment>): void {
    setEnvironmentsDraft((current) => {
      if (!current) return current

      const active = current.environments[0]
      if (!active) return current

      return {
        ...current,
        environments: [{ ...active, ...patch }]
      }
    })
    setEnvironmentsMessage(null)
    setEnvironmentsError(null)
  }

  function upsertEnvironmentParameter(parameterId: string, patch: Partial<EnvironmentParameter>): void {
    const nextParameterId = typeof patch.id === 'string' && patch.id.trim().length > 0 ? patch.id : parameterId

    setEnvironmentsDraft((current) => {
      if (!current) return current
      const active = current.environments[0]
      if (!active) return current

      const nextParameters = active.parameters.map((parameter) =>
        parameter.id === parameterId ? { ...parameter, ...patch } : parameter
      )

      return {
        ...current,
        environments: [{ ...active, parameters: nextParameters }]
      }
    })

    if (nextParameterId !== parameterId) {
      setEditedOps((current) => {
        const next: Record<string, OperationDetail> = { ...current }
        const sourceOperations = editorState?.operations ?? []

        for (const baseOperation of sourceOperations) {
          const operation = current[baseOperation.key] ?? baseOperation
          if (!operation.parameterIds.includes(parameterId)) {
            continue
          }

          next[operation.key] = {
            ...operation,
            parameterIds: operation.parameterIds.map((id) => (id === parameterId ? nextParameterId : id))
          }
        }

        return next
      })
    }

    setEnvironmentsMessage(null)
    setEnvironmentsError(null)
  }

  function addEnvironmentParameter(): void {
    setEnvironmentsDraft((current) => {
      if (!current) return current
      const active = current.environments[0]
      if (!active) return current

      const nextParam: EnvironmentParameter = {
        id: createParameterId('query', 'new_parameter', active.parameters),
        name: 'new_parameter',
        in: 'query',
        required: false,
        description: ''
      }

      return {
        ...current,
        environments: [{ ...active, parameters: [...active.parameters, nextParam] }]
      }
    })
    setEnvironmentsMessage(null)
    setEnvironmentsError(null)
  }

  function removeEnvironmentParameter(parameterId: string): void {
    setEnvironmentsDraft((current) => {
      if (!current) return current
      const active = current.environments[0]
      if (!active) return current

      return {
        ...current,
        environments: [{
          ...active,
          parameters: active.parameters.filter((parameter) => parameter.id !== parameterId)
        }]
      }
    })

    setEditedOps((current) => {
      const next: Record<string, OperationDetail> = { ...current }
      const sourceOperations = editorState?.operations ?? []

      for (const baseOperation of sourceOperations) {
        const operation = current[baseOperation.key] ?? baseOperation
        if (!operation.parameterIds.includes(parameterId)) {
          continue
        }

        next[operation.key] = {
          ...operation,
          parameterIds: operation.parameterIds.filter((id) => id !== parameterId)
        }
      }
      return next
    })

    setEnvironmentsMessage(null)
    setEnvironmentsError(null)
  }

  async function onSaveEnvironments(): Promise<void> {
    const openapiRelativePath = editorState?.api.openapiPath ?? selectedApi?.openapiPath ?? null
    if (!snapshot || !environmentsDraft || !openapiRelativePath) {
      return
    }

    setEnvironmentsSaving(true)
    setEnvironmentsError(null)
    try {
      const result = await window.appBridge.saveEnvironments({
        workspaceRootPath: snapshot.workspace.rootPath,
        openapiRelativePath,
        config: environmentsDraft
      })

      if (result.status === 'error') {
        setEnvironmentsError(result.message)
        return
      }

      setEnvironmentsConfig(result.config)
      setEnvironmentsDraft(result.config)
      setEnvironmentsMessage('Environment saved.')
      setTimeout(() => setEnvironmentsMessage(null), 2500)
    } finally {
      setEnvironmentsSaving(false)
    }
  }

  async function loadEditorForApi(rootPath: string, api: ApiSummary): Promise<void> {
    setEditorLoading(true)
    setEditorState(null)
    setEditedOps({})
    setEditedSchemas({})
    setSelectedOpKey(null)
    setSelectedSchemaId(null)
    setSaveStatus('idle')
    try {
      const result = await window.appBridge.loadApiEditor({
        workspaceRootPath: rootPath,
        openapiRelativePath: api.openapiPath
      })
      if (result.status === 'error') { setSaveStatus({ type: 'error', message: result.message }); return }
      setEditorState({ api, structure: result.structure, operations: result.operations, schemas: result.schemas })
      setSelectedOpKey(result.operations[0]?.key ?? null)
      setSelectedFolderId(null)
      setSelectedSchemaId(result.schemas[0]?.id ?? null)
      setSavedStructureHash(JSON.stringify(result.structure))
    } finally {
      setEditorLoading(false)
    }
  }

  function findFolderById(folder: FolderNode, folderId: string): FolderNode | null {
    if (folder.id === folderId) {
      return folder
    }

    for (const child of folder.children) {
      const match = findFolderById(child, folderId)
      if (match) {
        return match
      }
    }

    return null
  }

  function operationsForSelectedFolder(structure: ApiStructure): OperationRef[] {
    if (selectedFolderId === null) {
      return structure.ungrouped
    }

    const folder = findFolderById(structure.rootFolder, selectedFolderId)
    return folder?.operations ?? []
  }

  function updateStructure(mutator: (draft: ApiStructure) => void): void {
    setEditorState((current) => {
      if (!current) return current

      const nextStructure = JSON.parse(JSON.stringify(current.structure)) as ApiStructure
      mutator(nextStructure)
      return { ...current, structure: nextStructure }
    })
  }

  function onCreateFolder(): void {
    if (!editorState) return
    setNewFolderName('')
    setShowCreateFolderModal(true)
  }

  function onConfirmCreateFolder(): void {
    const name = newFolderName.trim()
    if (!name) return

    updateStructure((draft) => {
      const parent = selectedFolderId ? findFolderById(draft.rootFolder, selectedFolderId) : draft.rootFolder
      const target = parent ?? draft.rootFolder
      const createdId = `${draft.id}__folder__${Date.now()}`
      target.children.push({
        id: createdId,
        name,
        children: [],
        operations: []
      })
      setSelectedFolderId(createdId)
    })

    setShowCreateFolderModal(false)
    setNewFolderName('')
  }

  function onRenameFolder(folderId: string, currentName: string): void {
    setRenameFolderTargetId(folderId)
    setRenameFolderValue(currentName)
    setShowRenameFolderModal(true)
  }

  function onConfirmRenameFolder(): void {
    const name = renameFolderValue.trim()
    if (!name || !renameFolderTargetId) return

    updateStructure((draft) => {
      const folder = findFolderById(draft.rootFolder, renameFolderTargetId)
      if (folder) folder.name = name
    })

    setShowRenameFolderModal(false)
    setRenameFolderTargetId(null)
    setRenameFolderValue('')
  }

  function collectAllFolderOps(folder: FolderNode): OperationRef[] {
    return [...folder.operations, ...folder.children.flatMap(collectAllFolderOps)]
  }

  function onDeleteFolder(folderId: string): void {
    if (!editorState) return

    updateStructure((draft) => {
      const folder = findFolderById(draft.rootFolder, folderId)
      if (!folder) return
      const orphaned = collectAllFolderOps(folder)
      collectAndRemoveFolder(draft.rootFolder, folderId)
      draft.ungrouped.push(...orphaned)
    })

    if (selectedFolderId === folderId) setSelectedFolderId(null)
  }

  function onConfirmCreateRequest(): void {
    const path = newRequestPath.trim()
    if (!path || !editorState) return

    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const key = `${newRequestMethod}:${normalizedPath}`

    if (editorState.operations.some((op) => op.key === key)) {
      setNewRequestError(`${newRequestMethod} ${normalizedPath} already exists in this API.`)
      return
    }

    const opId = `${editorState.structure.id}__op__${Date.now()}`
    const newRef: OperationRef = { id: opId, operationId: null, method: newRequestMethod, path: normalizedPath }
    const newDetail: OperationDetail = {
      key,
      operationId: null,
      method: newRequestMethod,
      path: normalizedPath,
      summary: '',
      description: '',
      tags: [],
      parameterIds: [],
      requestBodyMediaType: '',
      requestBodySchemaName: '',
      requestBodyRequired: false,
      responseSchemas: []
    }

    updateStructure((draft) => {
      if (selectedFolderId) {
        const folder = findFolderById(draft.rootFolder, selectedFolderId)
        if (folder) {
          folder.operations.push(newRef)
        } else {
          draft.ungrouped.push(newRef)
        }
      } else {
        draft.ungrouped.push(newRef)
      }
    })

    setEditorState((prev) => {
      if (!prev) return prev
      return { ...prev, operations: [...prev.operations, newDetail] }
    })

    setSelectedOpKey(key)
    setShowCreateRequestModal(false)
    setNewRequestMethod('GET')
    setNewRequestPath('')
    setNewRequestError(null)
  }

  function collectAndRemoveFolder(parent: FolderNode, folderId: string): FolderNode | null {
    const idx = parent.children.findIndex((c) => c.id === folderId)
    if (idx >= 0) {
      const [removed] = parent.children.splice(idx, 1)
      return removed ?? null
    }
    for (const child of parent.children) {
      const removed = collectAndRemoveFolder(child, folderId)
      if (removed) return removed
    }
    return null
  }

  function isFolderAncestorOrSelf(folder: FolderNode, candidateId: string): boolean {
    if (folder.id === candidateId) return true
    return folder.children.some((c) => isFolderAncestorOrSelf(c, candidateId))
  }

  function onDropFolder(folderId: string, targetParentId: string | null): void {
    if (!editorState) return

    updateStructure((draft) => {
      // Prevent dropping onto self or a descendant
      if (targetParentId !== null) {
        const dragged = findFolderById(draft.rootFolder, folderId)
        if (!dragged) return
        if (isFolderAncestorOrSelf(dragged, targetParentId)) return
      }

      const removed = collectAndRemoveFolder(draft.rootFolder, folderId)
      if (!removed) return

      if (targetParentId === null) {
        draft.rootFolder.children.push(removed)
        return
      }

      const target = findFolderById(draft.rootFolder, targetParentId)
      if (!target) {
        draft.rootFolder.children.push(removed)
        return
      }

      target.children.push(removed)
    })
    setDraggingFolderId(null)
  }

  function collectAndRemoveOperation(folder: FolderNode, operationId: string): OperationRef | null {
    const opIndex = folder.operations.findIndex((op) => op.id === operationId)
    if (opIndex >= 0) {
      const [removed] = folder.operations.splice(opIndex, 1)
      return removed ?? null
    }

    for (const child of folder.children) {
      const removed = collectAndRemoveOperation(child, operationId)
      if (removed) {
        return removed
      }
    }

    return null
  }

  function onDropOperation(operationId: string, folderId: string | null): void {
    if (!editorState) return

    updateStructure((draft) => {
      let moved: OperationRef | null = null

      const ungroupedIndex = draft.ungrouped.findIndex((op) => op.id === operationId)
      if (ungroupedIndex >= 0) {
        const [fromUngrouped] = draft.ungrouped.splice(ungroupedIndex, 1)
        moved = fromUngrouped ?? null
      }

      if (!moved) {
        moved = collectAndRemoveOperation(draft.rootFolder, operationId)
      }

      if (!moved) return

      if (folderId === null) {
        draft.ungrouped.push(moved)
        return
      }

      if (folderId === SCHEMAS_FOLDER_ID) {
        draft.ungrouped.push(moved)
        return
      }

      const target = findFolderById(draft.rootFolder, folderId)
      if (!target) {
        draft.ungrouped.push(moved)
        return
      }

      target.operations.push(moved)
    })
    setDraggingOperationId(null)
  }

  async function onValidate(): Promise<void> {
    if (!snapshot || !selectedApi) return
    setValidating(true)
    setValidationResult(null)
    try {
      const result = await window.appBridge.validateOpenApi({
        workspaceRootPath: snapshot.workspace.rootPath,
        openapiRelativePath: selectedApi.openapiPath
      })
      setValidationResult(result)
    } finally {
      setValidating(false)
    }
  }

  async function onSave(): Promise<void> {
    if (!snapshot || !editorState) return
    setSaveStatus('saving')
    try {
      const previousOpenapiPath = editorState.api.openapiPath
      const previousSelectedOpKey = selectedOpKey
      const result: SaveApiEditorResult = await window.appBridge.saveApiEditor({
        workspaceRootPath: snapshot.workspace.rootPath,
        openapiRelativePath: editorState.api.openapiPath,
        operations: mergedOperations,
        schemas: mergedSchemas,
        structure: editorState.structure
      })
      if (result.status === 'saved') {
        setSnapshot(result.snapshot)

        if (result.openapiRelativePath !== previousOpenapiPath) {
          const migratedApi = result.snapshot.apis.find((api) => api.openapiPath === result.openapiRelativePath) ?? null
          if (!migratedApi) {
            setSaveStatus({ type: 'error', message: 'Saved API was not found after converting YAML to JSON.' })
            return
          }

          setSelectedApiId(migratedApi.id)
          await loadEditorForApi(result.snapshot.workspace.rootPath, migratedApi)
          if (previousSelectedOpKey) {
            setSelectedOpKey(previousSelectedOpKey)
          }
        } else {
          const currentApi = result.snapshot.apis.find((api) => api.openapiPath === previousOpenapiPath) ?? editorState.api
          setEditorState((prev) => prev ? { ...prev, api: currentApi, operations: mergedOperations, schemas: mergedSchemas } : prev)
          if (editorState) {
            setSavedStructureHash(JSON.stringify(editorState.structure))
          }
        }

        setEditedOps({})
        setEditedSchemas({})
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } else if (result.status === 'validation-failed') {
        setSaveStatus({ type: 'validation-failed', issues: result.issues })
      } else {
        setSaveStatus({ type: 'error', message: result.message })
      }
    } catch {
      setSaveStatus({ type: 'error', message: 'Unexpected error during save.' })
    }
  }

  function onOperationChange(updated: OperationDetail): void {
    setEditedOps((prev) => ({ ...prev, [updated.key]: updated }))
    setSaveStatus('idle')
  }

  function onSchemaChange(updated: SchemaDetail): void {
    const previous = mergedSchemas.find((schema) => schema.id === updated.id)
    const previousName = previous?.name ?? updated.name

    setEditedSchemas((prev) => ({ ...prev, [updated.id]: updated }))

    if (previousName !== updated.name) {
      setEditedOps((current) => {
        const next: Record<string, OperationDetail> = { ...current }
        const sourceOperations = editorState?.operations ?? []

        for (const baseOperation of sourceOperations) {
          const operation = current[baseOperation.key] ?? baseOperation
          if (
            operation.requestBodySchemaName !== previousName
            && !operation.responseSchemas.some((assignment) => assignment.schemaName === previousName)
          ) {
            continue
          }

          next[operation.key] = {
            ...operation,
            requestBodySchemaName: operation.requestBodySchemaName === previousName
              ? updated.name
              : operation.requestBodySchemaName,
            responseSchemas: operation.responseSchemas.map((assignment) =>
              assignment.schemaName === previousName
                ? { ...assignment, schemaName: updated.name }
                : assignment
            )
          }
        }

        return next
      })
    }

    setSaveStatus('idle')
  }

  function onSelectFolder(folderId: string | null): void {
    setSelectedFolderId(folderId)
    if (folderId === SCHEMAS_FOLDER_ID) {
      if (selectedSchemaId === null) {
        setSelectedSchemaId(mergedSchemas[0]?.id ?? null)
      }
      setSelectedOpKey(null)
      return
    }

    if (selectedOpKey === null) {
      const first = editorState ? operationsForSelectedFolder(editorState.structure)[0] : null
      if (first) setSelectedOpKey(`${first.method}:${first.path}`)
    }
  }

  function onCreateSchema(usageTag: SchemaUsageTag, explicitName?: string): void {
    if (!editorState) return

    const existing = mergedSchemas
    const rawName = explicitName?.trim() ?? ''
    const name = createSchemaName(rawName === '' ? 'NewSchema' : rawName, existing)
    const id = createSchemaId(name, existing)

    const created: SchemaDetail = {
      id,
      name,
      description: '',
      usageTag,
      properties: []
    }

    setEditorState((current) => current ? { ...current, schemas: [...current.schemas, created] } : current)
    setEditedSchemas((current) => ({ ...current, [created.id]: created }))
    setSelectedFolderId(SCHEMAS_FOLDER_ID)
    setSelectedSchemaId(created.id)
    setSelectedOpKey(null)
    setSaveStatus('idle')
  }

  function onConfirmCreateSchema(): void {
    onCreateSchema(newSchemaUsageTag, newSchemaName)
    setShowCreateSchemaModal(false)
    setNewSchemaName('')
    setNewSchemaUsageTag('Both')
  }

  function addSchemaProperty(schema: SchemaDetail): void {
    const property: SchemaPropertyDetail = {
      id: `${schema.id}__prop__${Date.now()}`,
      name: `property_${schema.properties.length + 1}`,
      type: 'string',
      required: false,
      description: ''
    }

    onSchemaChange({ ...schema, properties: [...schema.properties, property] })
  }

  function updateSchemaProperty(schema: SchemaDetail, propertyId: string, patch: Partial<SchemaPropertyDetail>): void {
    onSchemaChange({
      ...schema,
      properties: schema.properties.map((property) =>
        property.id === propertyId ? { ...property, ...patch } : property
      )
    })
  }

  function deleteSchemaProperty(schema: SchemaDetail, propertyId: string): void {
    onSchemaChange({
      ...schema,
      properties: schema.properties.filter((property) => property.id !== propertyId)
    })
  }

  const sideApis = snapshot?.apis ?? []
  const activeEnvironment = environmentsDraft?.environments[0] ?? null
  const availableEnvironmentParameters = activeEnvironment?.parameters ?? []
  const environmentsDirty = JSON.stringify(environmentsConfig) !== JSON.stringify(environmentsDraft)
  const structureDirty = editorState ? JSON.stringify(editorState.structure) !== savedStructureHash : false
  const activeFolderOperations = editorState ? operationsForSelectedFolder(editorState.structure) : []
  const hasAnyDirty = isDirty || schemaDirty || structureDirty

  return (
    <div className="flex flex-col h-full bg-surface-base text-slate-100">
      <TitleBar workspaceName={snapshot?.workspace.rootPath.split(/[\\/]/).pop()} />
      <div className="flex flex-1 overflow-hidden">
      <aside className="w-80 shrink-0 flex flex-col bg-surface-lower border-r border-surface-border">
        <div className="flex items-center justify-between px-4 h-12 border-b border-surface-border shrink-0">
          <span className="text-xs font-semibold text-slate-300 truncate">
            {snapshot?.workspace.rootPath.split(/[\\/]/).pop() ?? 'Workspace'}
          </span>
          <button
            className="text-slate-500 hover:text-slate-300 shrink-0 ml-2 px-1 rounded hover:bg-surface-raised transition-colors"
            title="Workspace options"
          >
            ···
          </button>
        </div>
        <div className="flex-1 flex flex-col items-stretch px-3 pt-3 gap-2 overflow-y-auto">
          {sideApis.length === 0 ? (
            <SidebarPlaceholder />
          ) : (
            sideApis.map((api) => (
              <React.Fragment key={api.id}>
                <ApiDropdownCard
                  api={api}
                  isSelected={selectedApiId === api.id}
                  isMenuOpen={openApiMenuId === api.id}
                  onToggleMenu={() => setOpenApiMenuId((current) => current === api.id ? null : api.id)}
                  onSelect={() => { void onSelectApi(api) }}
                  onEnvironment={() => {
                    const open = async (): Promise<void> => {
                      if (selectedApiId !== api.id) {
                        await onSelectApi(api)
                      }
                      setShowEnvironmentPanel(true)
                      setOpenApiMenuId(null)
                    }
                    void open()
                  }}
                  onNewFolder={() => {
                    if (selectedApiId === api.id) {
                      onCreateFolder()
                    } else {
                      void onSelectApi(api).then(() => onCreateFolder())
                    }
                    setOpenApiMenuId(null)
                  }}
                  onNewRequest={() => {
                    setOpenApiMenuId(null)
                    setNewRequestError(null)
                    setNewRequestPath('')
                    setNewRequestMethod('GET')
                    if (selectedApiId !== api.id) {
                      void onSelectApi(api).then(() => setShowCreateRequestModal(true))
                    } else {
                      setShowCreateRequestModal(true)
                    }
                  }}
                />
                {editorState && selectedApiId === api.id ? (
                  <div className="mb-1 rounded-lg border border-surface-border bg-surface-base px-2 py-2">
                    <EndpointTree
                      structure={editorState.structure}
                      selectedFolderId={selectedFolderId}
                      onSelectFolder={onSelectFolder}
                      schemaCount={mergedSchemas.length}
                      schemasFolderId={SCHEMAS_FOLDER_ID}
                      draggingOperationId={draggingOperationId}
                      onDropOperation={onDropOperation}
                      draggingFolderId={draggingFolderId}
                      onFolderDragStart={setDraggingFolderId}
                      onFolderDragEnd={() => setDraggingFolderId(null)}
                      onDropFolder={onDropFolder}
                      onRenameFolder={onRenameFolder}
                      onDeleteFolder={onDeleteFolder}
                    />
                  </div>
                ) : null}
              </React.Fragment>
            ))
          )}
        </div>
        {snapshot ? (
          <div className="px-3 pb-3 shrink-0 flex gap-2">
            <button
              className="w-1/2 text-xs px-3 py-2 rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-200 transition-colors disabled:opacity-40"
              onClick={onReturnHome}
              disabled={loading}
            >
              Switch Workspace
            </button>
            <button
              className="w-1/2 text-xs px-3 py-2 rounded-lg border border-primary/35 text-slate-200 hover:bg-primary/15 transition-colors disabled:opacity-40"
              onClick={() => {
                setOpenError(null)
                setNewApiName('')
                setShowCreateApiModal(true)
              }}
              disabled={loading}
            >
              New API
            </button>
          </div>
        ) : null}
      </aside>

      {!snapshot ? (
        <main className="flex-1 overflow-auto bg-surface-base">
          <div className="max-w-3xl mx-auto px-8 py-10">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">Getting Started with Workspaces</h1>
                <p className="text-sm text-slate-400 leading-relaxed">
                  A workspace is a local folder containing your API definitions.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 active:bg-primary/70 disabled:bg-primary/30 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  onClick={() => { void onOpenWorkspace() }}
                  disabled={loading}
                >
                  {loading ? 'Opening...' : 'Open Workspace'}
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-surface-border text-slate-200 hover:bg-surface-raised transition-colors disabled:opacity-40"
                  onClick={() => {
                    setOpenError(null)
                    setShowCreateWorkspaceModal(true)
                  }}
                  disabled={loading}
                >
                  Create a New Workspace
                </button>
              </div>
            </div>
            {openError ? (
              <div className="mt-5 rounded-lg border border-secondary/60 bg-secondary/10 px-4 py-3 text-sm text-slate-300">
                {openError}
              </div>
            ) : null}

            {recentWorkspaces.length > 0 ? (
              <section className="mt-6 rounded-xl border border-surface-border bg-surface-lower/70 px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-200">Recent Workspaces</h2>
                  <span className="text-xs text-slate-500">Jump back in quickly</span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {recentWorkspaces.map((workspace) => (
                    <div
                      key={workspace.rootPath}
                      className="w-full rounded-lg border border-surface-border bg-surface-base px-3 py-2 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <button
                          className="flex-1 text-left min-w-0 hover:text-white transition-colors disabled:opacity-40"
                          onClick={() => { void onOpenRecentWorkspace(workspace.rootPath) }}
                          disabled={loading}
                        >
                          <div className="text-sm text-slate-100 truncate">{workspace.name}</div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">{workspace.rootPath}</div>
                        </button>
                        <button
                          title="Remove from recent"
                          aria-label={`Remove ${workspace.name} from recent workspaces`}
                          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-surface-border text-slate-400 hover:text-secondary hover:border-secondary/60 hover:bg-secondary/10 transition-colors disabled:opacity-40"
                          onClick={() => { void onRemoveRecentWorkspace(workspace.rootPath) }}
                          disabled={loading}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M4 7H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                            <path d="M9 7V5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                            <path d="M7 7L8 19C8.09485 20.155 9.05832 21 10.2172 21H13.7828C14.9417 21 15.9051 20.155 16 19L17 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                            <path d="M10 11V17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                            <path d="M14 11V17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </main>
      ) : (
        <main className="flex-1 flex overflow-hidden">
          <section className="w-80 shrink-0 flex flex-col border-r border-surface-border overflow-hidden">
            <div className="flex items-center px-4 h-12 border-b border-surface-border shrink-0">
              <span className="text-sm font-semibold text-slate-200 truncate">
                {selectedFolderId === SCHEMAS_FOLDER_ID
                  ? 'Schemas'
                  : selectedFolderId === null
                    ? 'Unsorted Methods'
                    : 'Folder Methods'}
              </span>
              {selectedFolderId === SCHEMAS_FOLDER_ID ? (
                <button
                  className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded border border-surface-border text-slate-300 hover:bg-surface-raised"
                  title="New Schema"
                  onClick={() => setShowCreateSchemaModal(true)}
                >
                  +
                </button>
              ) : null}
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">
              {editorLoading ? (
                <TreeSkeleton />
              ) : editorState ? (
                selectedFolderId === SCHEMAS_FOLDER_ID ? (
                  <SchemasPanel
                    schemas={mergedSchemas}
                    selectedSchemaId={selectedSchemaId}
                    onSelectSchema={setSelectedSchemaId}
                  />
                ) : (
                  <MethodsPanel
                    operations={activeFolderOperations}
                    selectedOperationKey={selectedOpKey}
                    onSelectOperation={setSelectedOpKey}
                    onDragStart={setDraggingOperationId}
                    onDragEnd={() => setDraggingOperationId(null)}
                  />
                )
              ) : (
                <p className="text-xs text-slate-500 px-2">Select an API to browse operations.</p>
              )}
            </div>
          </section>

          <section className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-6 h-12 border-b border-surface-border shrink-0">
              <span className="text-xs text-slate-400 truncate">
                {selectedApi?.openapiPath ?? ''}
              </span>
              <div className="flex items-center gap-2">
                {selectedOperation && selectedFolderId !== SCHEMAS_FOLDER_ID ? (
                  <div className="flex items-center gap-0.5 mr-1 rounded-lg border border-surface-border p-0.5">
                    <button
                      className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors ${detailTab === 'edit' ? 'bg-surface-raised text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
                      onClick={() => setDetailTab('edit')}
                    >
                      Edit
                    </button>
                    <button
                      className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors ${detailTab === 'run' ? 'bg-surface-raised text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
                      onClick={() => setDetailTab('run')}
                    >
                      Run
                    </button>
                  </div>
                ) : null}
                <button
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-300 hover:bg-surface-raised hover:text-slate-100 disabled:opacity-40 transition-colors"
                  onClick={() => { void onValidate() }}
                  disabled={validating || !editorState}
                >
                  {validating ? 'Validating...' : 'Validate'}
                </button>
                <SaveButton
                  status={saveStatus}
                  isDirty={hasAnyDirty}
                  disabled={!editorState || saveStatus === 'saving'}
                  onClick={() => { void onSave() }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <SaveFeedback status={saveStatus} />
              {validationResult ? (
                <div className="mb-5">
                  <ValidationResultPanel result={validationResult} />
                </div>
              ) : null}
              {selectedFolderId === SCHEMAS_FOLDER_ID && selectedSchema ? (
                <SchemaEditor
                  schema={selectedSchema}
                  availableSchemas={mergedSchemas}
                  onChange={onSchemaChange}
                  onAddProperty={() => addSchemaProperty(selectedSchema)}
                  onUpdateProperty={(propertyId, patch) => updateSchemaProperty(selectedSchema, propertyId, patch)}
                  onDeleteProperty={(propertyId) => deleteSchemaProperty(selectedSchema, propertyId)}
                />
              ) : selectedOperation && editorState ? (
                detailTab === 'run' ? (
                  <RequestRunner
                    key={selectedOpKey ?? ''}
                    operation={selectedOperation}
                    environment={activeEnvironment}
                    onExecute={(req) => window.appBridge.executeRequest(req)}
                  />
                ) : (
                    <OperationEditor
                      operation={selectedOperation}
                      availableParameters={availableEnvironmentParameters}
                      requestSchemas={requestSchemas}
                      responseSchemas={responseSchemas}
                      onChange={onOperationChange}
                    />
                )
              ) : editorLoading ? (
                <EditorSkeleton />
              ) : editorState ? (
                <p className="text-sm text-slate-400">
                  {selectedFolderId === SCHEMAS_FOLDER_ID
                    ? 'Select a schema to edit it, or create a new one.'
                    : 'Select an operation from the tree to edit it.'}
                </p>
              ) : (
                <p className="text-sm text-slate-400">Open a workspace to get started.</p>
              )}
            </div>
          </section>
        </main>
      )}
      </div>

      {showCreateFolderModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Create Folder</h3>
            <p className="mt-1 text-xs text-slate-400">Choose a name for the new folder.</p>
            <input
              autoFocus
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onConfirmCreateFolder()
                }
                if (event.key === 'Escape') {
                  setShowCreateFolderModal(false)
                }
              }}
              placeholder="New folder"
              className="mt-3 w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
                onClick={() => setShowCreateFolderModal(false)}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-40"
                disabled={newFolderName.trim().length === 0}
                onClick={onConfirmCreateFolder}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateSchemaModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Create Schema</h3>
            <p className="mt-1 text-xs text-slate-400">Choose a schema name and usage tag.</p>
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-xs text-slate-400">Schema Name</span>
              <input
                autoFocus
                value={newSchemaName}
                onChange={(event) => setNewSchemaName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onConfirmCreateSchema()
                  }
                  if (event.key === 'Escape') {
                    setShowCreateSchemaModal(false)
                  }
                }}
                placeholder="NewSchema"
                className="w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
              />
            </label>
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-xs text-slate-400">Usage Tag</span>
              <select
                value={newSchemaUsageTag}
                onChange={(event) => setNewSchemaUsageTag(event.target.value as SchemaUsageTag)}
                className="w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
              >
                <option value="Rqst">Rqst</option>
                <option value="Resp">Resp</option>
                <option value="Both">Both</option>
              </select>
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
                onClick={() => setShowCreateSchemaModal(false)}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80"
                onClick={onConfirmCreateSchema}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEnvironmentPanel ? (
        <EnvironmentModal
          environment={activeEnvironment}
          loading={environmentsLoading}
          saving={environmentsSaving}
          dirty={environmentsDirty}
          error={environmentsError}
          message={environmentsMessage}
          onClose={() => setShowEnvironmentPanel(false)}
          onChangeName={(name) => updateActiveEnvironment({ name })}
          onChangeBaseUrl={(baseUrl) => updateActiveEnvironment({ baseUrl })}
          onSave={() => { void onSaveEnvironments() }}
          onAddParameter={addEnvironmentParameter}
          onUpdateParameter={upsertEnvironmentParameter}
          onRemoveParameter={removeEnvironmentParameter}
        />
      ) : null}

      {showRenameFolderModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Rename Folder</h3>
            <p className="mt-1 text-xs text-slate-400">Enter a new name for this folder.</p>
            <input
              autoFocus
              value={renameFolderValue}
              onChange={(event) => setRenameFolderValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onConfirmRenameFolder()
                if (event.key === 'Escape') {
                  setShowRenameFolderModal(false)
                  setRenameFolderTargetId(null)
                }
              }}
              placeholder="Folder name"
              className="mt-3 w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
                onClick={() => { setShowRenameFolderModal(false); setRenameFolderTargetId(null) }}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-40"
                disabled={renameFolderValue.trim().length === 0}
                onClick={onConfirmRenameFolder}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateWorkspaceModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Create New Workspace</h3>
            <p className="mt-1 text-xs text-slate-400">
              Enter a workspace name and the first API to create. The workspace folder will be the repo root.
            </p>
            <input
              autoFocus
              value={newWorkspaceName}
              onChange={(event) => setNewWorkspaceName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void onCreateWorkspace()
                }
                if (event.key === 'Escape') {
                  setShowCreateWorkspaceModal(false)
                }
              }}
              placeholder="My API Workspace"
              className="mt-3 w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
            />
            <input
              value={newWorkspaceFirstApiName}
              onChange={(event) => setNewWorkspaceFirstApiName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void onCreateWorkspace()
                }
                if (event.key === 'Escape') {
                  setShowCreateWorkspaceModal(false)
                }
              }}
              placeholder="Payments API"
              className="mt-3 w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
                onClick={() => {
                  setShowCreateWorkspaceModal(false)
                  setNewWorkspaceName('')
                  setNewWorkspaceFirstApiName('')
                }}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-40"
                disabled={newWorkspaceName.trim().length === 0 || newWorkspaceFirstApiName.trim().length === 0 || loading}
                onClick={() => { void onCreateWorkspace() }}
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateRequestModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">New Request</h3>
            <p className="mt-1 text-xs text-slate-400">
              Choose an HTTP method and path. The request will be added to{' '}
              {selectedFolderId ? 'the selected folder' : 'Unsorted'} and you can edit it immediately.
            </p>
            <div className="mt-3 flex gap-2">
              <select
                value={newRequestMethod}
                onChange={(e) => setNewRequestMethod(e.target.value as HttpMethod)}
                className="rounded-lg border border-surface-border bg-surface-lower px-2 py-2 text-sm text-slate-100 outline-none focus:border-primary/60 shrink-0"
              >
                {(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','TRACE'] as HttpMethod[]).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                autoFocus
                value={newRequestPath}
                onChange={(e) => { setNewRequestPath(e.target.value); setNewRequestError(null) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onConfirmCreateRequest()
                  if (e.key === 'Escape') setShowCreateRequestModal(false)
                }}
                placeholder="/resource/{id}"
                className="flex-1 rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60 font-mono"
              />
            </div>
            {newRequestError ? (
              <p className="mt-2 text-xs text-red-400">{newRequestError}</p>
            ) : null}
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
                onClick={() => setShowCreateRequestModal(false)}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-40"
                disabled={newRequestPath.trim().length === 0}
                onClick={onConfirmCreateRequest}
              >
                Add Request
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateApiModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Create New API</h3>
            <p className="mt-1 text-xs text-slate-400">
              Enter an API name. It will be created in its own folder at the workspace root.
            </p>
            <input
              autoFocus
              value={newApiName}
              onChange={(event) => setNewApiName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void onCreateApi()
                }
                if (event.key === 'Escape') {
                  setShowCreateApiModal(false)
                }
              }}
              placeholder="Payments API"
              className="mt-3 w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
                onClick={() => {
                  setShowCreateApiModal(false)
                  setNewApiName('')
                }}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-40"
                disabled={newApiName.trim().length === 0 || loading}
                onClick={() => { void onCreateApi() }}
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface EnvironmentModalProps {
  environment: Environment | null
  loading: boolean
  saving: boolean
  dirty: boolean
  error: string | null
  message: string | null
  onClose: () => void
  onChangeName: (value: string) => void
  onChangeBaseUrl: (value: string) => void
  onSave: () => void
  onAddParameter: () => void
  onUpdateParameter: (parameterId: string, patch: Partial<EnvironmentParameter>) => void
  onRemoveParameter: (parameterId: string) => void
}

function EnvironmentModal(props: EnvironmentModalProps): React.JSX.Element {
  const parameters = props.environment?.parameters ?? []

  return (
    <div className="fixed inset-0 z-50 bg-black/65 p-4 md:p-6">
      <div className="h-full w-full rounded-xl border border-surface-border bg-surface-base shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-surface-border px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Environment Settings</h3>
            <p className="text-xs text-slate-400 mt-0.5">Stored in .api-tool/environments.json for the selected API</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-300 hover:bg-surface-raised hover:text-slate-100 disabled:opacity-40 transition-colors"
              disabled={props.loading || props.saving || !props.environment || !props.dirty}
              onClick={props.onSave}
            >
              {props.saving ? 'Saving...' : 'Save Environment'}
            </button>
            <button
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
              onClick={props.onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {props.error ? (
            <div className="mb-4 rounded-lg border border-secondary/60 bg-secondary/10 px-3 py-2 text-xs text-slate-300">
              {props.error}
            </div>
          ) : null}

          {props.message ? (
            <div className="mb-4 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-xs text-slate-200">
              {props.message}
            </div>
          ) : null}

          {props.loading ? (
            <p className="text-xs text-slate-400">Loading environment...</p>
          ) : props.environment ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Environment Name</span>
                  <input
                    value={props.environment.name}
                    onChange={(event) => props.onChangeName(event.target.value)}
                    className="rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
                    placeholder="Default"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Base URL</span>
                  <input
                    value={props.environment.baseUrl}
                    onChange={(event) => props.onChangeBaseUrl(event.target.value)}
                    className="rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
                    placeholder="https://api.example.com"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-surface-border bg-surface-lower/60">
                <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Reusable Parameters</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Define query/header/path/cookie parameters for this API.</p>
                  </div>
                  <button
                    className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md border border-surface-border text-slate-300 hover:bg-surface-raised"
                    onClick={props.onAddParameter}
                  >
                    + Add Parameter
                  </button>
                </div>

                {parameters.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-500">No parameters defined yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-surface-border">
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Location</th>
                          <th className="px-3 py-2 font-medium">Required</th>
                          <th className="px-3 py-2 font-medium">Description</th>
                          <th className="px-3 py-2 font-medium w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {parameters.map((parameter) => (
                          <tr key={parameter.id} className="border-b border-surface-border/70 align-top">
                            <td className="px-3 py-2">
                              <input
                                className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60 font-mono"
                                value={parameter.name}
                                onChange={(event) => {
                                  const name = event.target.value
                                  const nextId = createParameterId(
                                    parameter.in,
                                    name,
                                    parameters.filter((item) => item.id !== parameter.id)
                                  )
                                  props.onUpdateParameter(parameter.id, { id: nextId, name })
                                }}
                                placeholder="userId"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                                value={parameter.in}
                                onChange={(event) => {
                                  const nextIn = event.target.value as ParameterLocation
                                  const nextId = createParameterId(
                                    nextIn,
                                    parameter.name,
                                    parameters.filter((item) => item.id !== parameter.id)
                                  )
                                  props.onUpdateParameter(parameter.id, {
                                    id: nextId,
                                    in: nextIn,
                                    required: nextIn === 'path' ? true : parameter.required
                                  })
                                }}
                              >
                                <option value="query">query</option>
                                <option value="header">header</option>
                                <option value="path">path</option>
                                <option value="cookie">cookie</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <label className="inline-flex items-center gap-1.5 text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={parameter.in === 'path' ? true : parameter.required}
                                  disabled={parameter.in === 'path'}
                                  onChange={(event) => props.onUpdateParameter(parameter.id, { required: event.target.checked })}
                                />
                                <span>{parameter.in === 'path' ? 'Always' : 'Yes'}</span>
                              </label>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                                value={parameter.description ?? ''}
                                onChange={(event) => props.onUpdateParameter(parameter.id, { description: event.target.value })}
                                placeholder="Optional notes"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                className="text-slate-500 hover:text-red-300"
                                onClick={() => props.onRemoveParameter(parameter.id)}
                                aria-label={`Delete ${parameter.name}`}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Environment profile unavailable.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function createParameterId(inValue: ParameterLocation, name: string, existing: EnvironmentParameter[]): string {
  const baseName = name.trim().replace(/\s+/g, '_') || 'parameter'
  const base = `${inValue}:${baseName}`
  if (!existing.some((parameter) => parameter.id === base)) {
    return base
  }

  let index = 2
  let candidate = `${base}_${index}`
  while (existing.some((parameter) => parameter.id === candidate)) {
    index += 1
    candidate = `${base}_${index}`
  }

  return candidate
}

function SaveButton({ status, isDirty, disabled, onClick }: { status: SaveStatus; isDirty: boolean; disabled: boolean; onClick: () => void }): React.JSX.Element {
  const label = status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : 'Save'
  const colour = status === 'saved'
    ? 'bg-primary/80 border-primary/40 text-white'
    : isDirty
      ? 'bg-primary hover:bg-primary/80 border-transparent text-white'
      : 'bg-surface-raised border-surface-border text-slate-400 hover:text-slate-200'
  return (
    <button
      className={`inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-40 ${colour}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function SaveFeedback({ status }: { status: SaveStatus }): React.JSX.Element | null {
  if (status === 'idle' || status === 'saving' || status === 'saved') return null
  if (status.type === 'error') {
    return (
      <div className="mb-5 rounded-lg border border-secondary/60 bg-secondary/10 px-4 py-3 text-sm text-slate-300">
        {status.message}
      </div>
    )
  }
  return (
    <div className="mb-5 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3">
      <p className="text-sm text-accent">Save blocked: {status.issues.length} validation issue{status.issues.length === 1 ? '' : 's'}.</p>
      <ul className="mt-2 space-y-1">
        {status.issues.slice(0, 6).map((issue, i) => (
          <li key={i} className="text-xs text-slate-300">{issue.path ? `${issue.path}: ` : ''}{issue.message}</li>
        ))}
      </ul>
    </div>
  )
}

function ValidationResultPanel({ result }: { result: ValidateOpenApiResult }): React.JSX.Element | null {
  if (result.status === 'valid') {
    return <div className="rounded-lg border border-primary/50 bg-primary/10 px-4 py-3 text-sm text-slate-200">OpenAPI document is structurally valid.</div>
  }
  if (result.status === 'error') {
    return <div className="rounded-lg border border-secondary/60 bg-secondary/10 px-4 py-3 text-sm text-slate-300">{result.message}</div>
  }
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3">
      <p className="text-sm text-accent">{result.issueCount} validation issue{result.issueCount === 1 ? '' : 's'}.</p>
      <ul className="mt-2 space-y-1">
        {result.issues.slice(0, 8).map((issue, i) => (
          <li key={i} className="text-xs text-slate-300">{issue.path ? `${issue.path}: ` : ''}{issue.message}</li>
        ))}
      </ul>
      {result.issueCount > 8 ? <p className="mt-1 text-xs text-slate-500">Showing first 8 issues.</p> : null}
    </div>
  )
}

function ApiDropdownCard({
  api,
  isSelected,
  isMenuOpen,
  onToggleMenu,
  onSelect,
  onEnvironment,
  onNewFolder,
  onNewRequest
}: {
  api: ApiSummary
  isSelected: boolean
  isMenuOpen: boolean
  onToggleMenu: () => void
  onSelect: () => void
  onEnvironment: () => void
  onNewFolder: () => void
  onNewRequest: () => void
}): React.JSX.Element {
  return (
    <div className={`rounded-lg border ${isSelected ? 'border-primary/35 bg-primary/10' : 'border-surface-border bg-surface-base'}`}>
      <div className="flex items-center gap-1 px-2.5 py-2">
        <button className="flex-1 text-left min-w-0" onClick={onSelect}>
          <div className="text-sm font-medium truncate">{api.name}</div>
          <div className="text-xs text-slate-500 truncate">{api.operationCount} operations</div>
        </button>
        <button
          className="text-slate-400 hover:text-slate-100 rounded px-1 shrink-0"
          onClick={onNewFolder}
          title="New Folder"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            <line x1="12" y1="11" x2="12" y2="17"/>
            <line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
        </button>
        <button
          className="text-slate-400 hover:text-slate-100 rounded px-1 shrink-0"
          onClick={onNewRequest}
          title="New Request"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </button>
        <button
          className="text-slate-400 hover:text-slate-100 rounded px-1 shrink-0"
          onClick={onToggleMenu}
          title="API actions"
        >
          ⋯
        </button>
      </div>

      {isMenuOpen ? (
        <div className="px-2.5 pb-2 flex flex-col gap-1">
          <button className="text-left text-xs px-2 py-1 rounded hover:bg-surface-raised" onClick={onEnvironment}>Environment</button>
          <button className="text-left text-xs px-2 py-1 rounded hover:bg-surface-raised" onClick={onNewFolder}>New Folder</button>
          <button className="text-left text-xs px-2 py-1 rounded hover:bg-surface-raised" onClick={onNewRequest}>New Request</button>
        </div>
      ) : null}
    </div>
  )
}

function MethodsPanel({
  operations,
  selectedOperationKey,
  onSelectOperation,
  onDragStart,
  onDragEnd
}: {
  operations: OperationRef[]
  selectedOperationKey: string | null
  onSelectOperation: (key: string) => void
  onDragStart: (operationId: string) => void
  onDragEnd: () => void
}): React.JSX.Element {
  const METHOD_COLOURS: Record<string, string> = {
    GET: 'text-[#6C7D47]',
    POST: 'text-[#FACC15]',
    PUT: 'text-blue-400',
    PATCH: 'text-purple-400',
    DELETE: 'text-[#BC4B51]',
    HEAD: 'text-slate-400',
    OPTIONS: 'text-slate-400',
    TRACE: 'text-slate-400'
  }

  return (
    <div className="flex flex-col gap-1">
      {operations.map((op) => {
        const key = `${op.method}:${op.path}`
        return (
          <div
            key={op.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-colors ${
              selectedOperationKey === key
                ? 'bg-primary/15 border-primary/35'
                : 'border-transparent hover:bg-surface-raised'
            }`}
          >
            <button
              className="text-slate-500 hover:text-slate-300 cursor-grab"
              title="Drag to move"
              draggable
              onDragStart={() => onDragStart(op.id)}
              onDragEnd={onDragEnd}
            >
              ⋮⋮
            </button>
            <button className="flex-1 text-left" onClick={() => onSelectOperation(key)}>
              <span className={`font-mono text-xs font-semibold mr-2 ${METHOD_COLOURS[op.method] ?? 'text-slate-400'}`}>
                {op.method}
              </span>
              <span className="text-xs text-slate-300 truncate">{op.path}</span>
            </button>
          </div>
        )
      })}

      {operations.length === 0 ? (
        <p className="text-xs text-slate-500 px-2 py-2">No methods in this folder.</p>
      ) : null}
    </div>
  )
}

function TitleBar({ workspaceName }: { workspaceName?: string }): React.JSX.Element {
  const [maximized, setMaximized] = React.useState(false)

  React.useEffect(() => {
    let mounted = true
    void window.appBridge.windowControls.isMaximized().then((m) => { if (mounted) setMaximized(m) })
    window.appBridge.windowControls.onMaximizeChange((m) => { if (mounted) setMaximized(m) })
    return () => { mounted = false }
  }, [])

  return (
    <div
      className="flex h-9 items-stretch shrink-0 bg-surface-lower border-b border-surface-border"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex items-center px-4 w-56 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <BrandLogo />
      </div>
      <div className="flex-1 flex items-center justify-center pointer-events-none">
        {workspaceName ? (
          <span className="text-xs text-slate-500 truncate max-w-[260px]">{workspaceName}</span>
        ) : null}
      </div>
      <div
        className="flex items-stretch"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <TitleBarButton onClick={() => window.appBridge.windowControls.minimize()} title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1" aria-hidden="true"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.5" /></svg>
        </TitleBarButton>
        <TitleBarButton
          onClick={() => { window.appBridge.windowControls.toggleMaximize() }}
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="2" y="0" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <rect x="0" y="2" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.5" className="fill-surface-lower" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="0.75" y="0.75" width="8.5" height="8.5" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          )}
        </TitleBarButton>
        <TitleBarButton onClick={() => window.appBridge.windowControls.close()} title="Close" isClose>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </TitleBarButton>
      </div>
    </div>
  )
}

function TitleBarButton({
  onClick, title, isClose = false, children
}: {
  onClick: () => void
  title: string
  isClose?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex items-center justify-center w-11 h-full text-slate-400 transition-colors ${isClose ? 'hover:bg-secondary hover:text-white' : 'hover:bg-surface-raised hover:text-slate-200'}`}
    >
      {children}
    </button>
  )
}

function BrandLogo(): React.JSX.Element {
  return (
    <span className="flex items-baseline font-mono text-sm font-bold leading-none" aria-label="APICaramba">
      <span className="text-accent mr-1.5">{'>'}</span>
      <span className="text-accent">{'{'}</span>
      <span className="text-primary">api</span>
      <span className="text-accent">{':'}</span>
      <span className="text-secondary">caramba</span>
      <span className="text-accent">{'}'}</span>
    </span>
  )
}

function TreeSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-1.5 px-2" aria-hidden="true">
      {[75, 55, 80, 60, 70].map((w, i) => (
        <div key={i} className="h-7 rounded bg-surface-border animate-pulse" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

function EditorSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-7 w-48 rounded bg-surface-border animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-16 rounded bg-surface-border animate-pulse" />
        <div className="h-10 rounded bg-surface-border animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-20 rounded bg-surface-border animate-pulse" />
        <div className="h-28 rounded bg-surface-border animate-pulse" />
      </div>
    </div>
  )
}

function SidebarPlaceholder(): React.JSX.Element {
  return (
    <div className="w-full space-y-1" aria-hidden="true">
      {[80, 60, 70].map((w, i) => (
        <div key={i} className="h-5 rounded bg-surface-border animate-pulse" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

function SchemasPanel({
  schemas,
  selectedSchemaId,
  onSelectSchema
}: {
  schemas: SchemaDetail[]
  selectedSchemaId: string | null
  onSelectSchema: (schemaId: string) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      {schemas.map((schema) => (
        <button
          key={schema.id}
          className={`text-left px-2 py-1.5 rounded border transition-colors text-xs ${
            selectedSchemaId === schema.id
              ? 'bg-primary/15 border-primary/35 text-slate-100'
              : 'border-transparent hover:bg-surface-raised text-slate-300'
          }`}
          onClick={() => onSelectSchema(schema.id)}
        >
          <span className="font-mono">{schema.name}</span>
          <span className="ml-2 text-slate-500">({schema.properties.length})</span>
          <span className="ml-2 rounded border border-surface-border bg-surface-lower px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
            {schema.usageTag ?? 'Both'}
          </span>
        </button>
      ))}

      {schemas.length === 0 ? (
        <p className="text-xs text-slate-500 px-2 py-2">No schemas yet. Use + to create one.</p>
      ) : null}
    </div>
  )
}

function SchemaEditor({
  schema,
  availableSchemas,
  onChange,
  onAddProperty,
  onUpdateProperty,
  onDeleteProperty
}: {
  schema: SchemaDetail
  availableSchemas: SchemaDetail[]
  onChange: (schema: SchemaDetail) => void
  onAddProperty: () => void
  onUpdateProperty: (propertyId: string, patch: Partial<SchemaPropertyDetail>) => void
  onDeleteProperty: (propertyId: string) => void
}): React.JSX.Element {
  const typeOptions: SchemaPropertyType[] = ['string', 'number', 'integer', 'boolean', 'array', 'object']
  const primitiveOptions: SchemaPrimitiveType[] = ['string', 'number', 'integer', 'boolean']
  const schemaOptions = availableSchemas
    .filter((candidate) => candidate.id !== schema.id)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Schema Name</span>
          <input
            className="rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60 font-mono"
            value={schema.name}
            onChange={(event) => onChange({ ...schema, name: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Description</span>
          <input
            className="rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
            value={schema.description}
            onChange={(event) => onChange({ ...schema, description: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Usage Tag</span>
          <select
            className="rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
            value={schema.usageTag ?? 'Both'}
            onChange={(event) => onChange({ ...schema, usageTag: event.target.value as SchemaUsageTag })}
          >
            <option value="Rqst">Rqst</option>
            <option value="Resp">Resp</option>
            <option value="Both">Both</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-lower/60">
        <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Properties</h4>
          <button
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-surface-border text-slate-300 hover:bg-surface-raised"
            onClick={onAddProperty}
          >
            + Add Property
          </button>
        </div>
        {schema.properties.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-500">No properties defined.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-surface-border">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Definition</th>
                  <th className="px-3 py-2 font-medium">Required</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium w-16" />
                </tr>
              </thead>
              <tbody>
                {schema.properties.map((property) => (
                  <tr key={property.id} className="border-b border-surface-border/70 align-top">
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60 font-mono"
                        value={property.name}
                        onChange={(event) => onUpdateProperty(property.id, { name: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                        value={property.type}
                        onChange={(event) => {
                          const nextType = event.target.value as SchemaPropertyType
                          if (nextType === 'array') {
                            onUpdateProperty(property.id, {
                              type: nextType,
                              arrayItemType: property.arrayItemType ?? 'string',
                              arrayItemSchemaName: ''
                            })
                            return
                          }

                          if (nextType === 'object') {
                            onUpdateProperty(property.id, {
                              type: nextType,
                              objectSchemaName: property.objectSchemaName ?? ''
                            })
                            return
                          }

                          onUpdateProperty(property.id, {
                            type: nextType,
                            arrayItemType: undefined,
                            arrayItemSchemaName: undefined,
                            objectSchemaName: undefined
                          })
                        }}
                      >
                        {typeOptions.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {property.type === 'array' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                            value={property.arrayItemSchemaName ? 'schema' : 'primitive'}
                            onChange={(event) => {
                              const mode = event.target.value
                              if (mode === 'schema') {
                                onUpdateProperty(property.id, {
                                  arrayItemSchemaName: schemaOptions[0]?.name ?? '',
                                  arrayItemType: undefined
                                })
                              } else {
                                onUpdateProperty(property.id, {
                                  arrayItemSchemaName: '',
                                  arrayItemType: property.arrayItemType ?? 'string'
                                })
                              }
                            }}
                          >
                            <option value="primitive">Primitive</option>
                            <option value="schema">Schema</option>
                          </select>
                          {property.arrayItemSchemaName ? (
                            <select
                              className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                              value={property.arrayItemSchemaName}
                              onChange={(event) => onUpdateProperty(property.id, { arrayItemSchemaName: event.target.value })}
                            >
                              {schemaOptions.length === 0 ? <option value="">No schemas</option> : null}
                              {schemaOptions.map((schemaOption) => (
                                <option key={schemaOption.id} value={schemaOption.name}>{schemaOption.name}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                              value={property.arrayItemType ?? 'string'}
                              onChange={(event) => onUpdateProperty(property.id, { arrayItemType: event.target.value as SchemaPrimitiveType })}
                            >
                              {primitiveOptions.map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : property.type === 'object' ? (
                        <select
                          className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                          value={property.objectSchemaName ?? ''}
                          onChange={(event) => onUpdateProperty(property.id, { objectSchemaName: event.target.value })}
                        >
                          <option value="">Inline object</option>
                          {schemaOptions.map((schemaOption) => (
                            <option key={schemaOption.id} value={schemaOption.name}>{schemaOption.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={property.required}
                        onChange={(event) => onUpdateProperty(property.id, { required: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                        value={property.description}
                        onChange={(event) => onUpdateProperty(property.id, { description: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-slate-500 hover:text-red-300" onClick={() => onDeleteProperty(property.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function createSchemaName(baseName: string, existing: SchemaDetail[]): string {
  const normalizedBase = baseName.trim().replace(/\s+/g, '') || 'Schema'
  const existingNames = new Set(existing.map((schema) => schema.name))
  if (!existingNames.has(normalizedBase)) {
    return normalizedBase
  }

  let index = 2
  let candidate = `${normalizedBase}${index}`
  while (existingNames.has(candidate)) {
    index += 1
    candidate = `${normalizedBase}${index}`
  }

  return candidate
}

function createSchemaId(name: string, existing: SchemaDetail[]): string {
  const base = `schema:${name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')}`
  const existingIds = new Set(existing.map((schema) => schema.id))
  if (!existingIds.has(base)) {
    return base
  }

  let index = 2
  let candidate = `${base}-${index}`
  while (existingIds.has(candidate)) {
    index += 1
    candidate = `${base}-${index}`
  }

  return candidate
}