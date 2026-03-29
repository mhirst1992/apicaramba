import React from 'react'
import type {
  WorkspaceSnapshot,
  ApiSummary,
  RecentWorkspace,
  ValidateOpenApiResult,
  ApiStructure,
  OperationRef,
  OperationDetail,
  SchemaDetail,
  SchemaUsageTag,
  SchemaPropertyDetail,
  SaveApiEditorResult,
  EnvironmentsConfig,
  Environment,
  EnvironmentParameter
} from '@apicaramba/shared-types'
import { EndpointTree } from './components/EndpointTree.js'
import { OperationEditor } from './components/OperationEditor.js'
import { RequestRunner } from './components/RequestRunner.js'
import { TitleBar } from './components/TitleBar.js'
import { ApiDropdownCard } from './components/ApiDropdownCard.js'
import { EnvironmentModal } from './components/EnvironmentModal.js'
import { SchemaEditor } from './components/SchemaEditor.js'
import { EditorSkeleton, SidebarPlaceholder } from './components/AppPlaceholders.js'
import { SaveButton, SaveFeedback, ValidationResultPanel, type SaveStatus } from './components/AppFeedback.js'
import {
  CreateFolderModal,
  CreateSchemaModal,
  RenameFolderModal,
  CreateWorkspaceModal,
  CreateApiModal
} from './components/AppModals.js'
import { createSchemaId, createSchemaName } from './utils/schemaUtils.js'
import { createParameterId } from './utils/parameterUtils.js'
import {
  findFolderById,
  collectAllFolderOps,
  collectAndRemoveFolder,
  isFolderAncestorOrSelf,
  collectAndRemoveOperation,
  syncOperationRefInStructure
} from './utils/structureUtils.js'

// --- Types -------------------------------------------------------------------

interface EditorState {
  api: ApiSummary
  structure: ApiStructure
  operations: OperationDetail[]
  schemas: SchemaDetail[]
}

const SCHEMAS_FOLDER_ID = '__schemas__'

// --- Root component -----------------------------------------------------------

export default function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = React.useState<WorkspaceSnapshot | null>(null)
  const [selectedApiId, setSelectedApiId] = React.useState<string | null>(null)
  const [expandedApiId, setExpandedApiId] = React.useState<string | null>(null)
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
    return editorState.operations.map((op) => editedOps[op.sourceKey ?? op.key] ?? op)
  }, [editorState, editedOps])

  const selectedOperation = React.useMemo(
    () => mergedOperations.find((op) => (op.sourceKey ?? op.key) === selectedOpKey || op.key === selectedOpKey) ?? null,
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
    const firstApiId = snapshotToLoad.apis[0]?.id ?? null
    setSnapshot(snapshotToLoad)
    setSelectedApiId(firstApiId)
    setExpandedApiId(firstApiId)
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
    setExpandedApiId(null)
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
    setExpandedApiId(api.id)
    setValidationResult(null)
    setSelectedFolderId(null)
    await loadEnvironmentsForApi(snapshot.workspace.rootPath, api.openapiPath)
    await loadEditorForApi(snapshot.workspace.rootPath, api)
  }

  function onToggleApiCard(api: ApiSummary): void {
    if (expandedApiId === api.id) {
      setExpandedApiId(null)
      setOpenApiMenuId(null)
      return
    }

    if (selectedApiId === api.id) {
      setExpandedApiId(api.id)
      setOpenApiMenuId(null)
      return
    }

    setOpenApiMenuId(null)
    void onSelectApi(api)
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
      setSelectedOpKey(result.operations[0]?.sourceKey ?? result.operations[0]?.key ?? null)
      setSelectedFolderId(null)
      setSelectedSchemaId(result.schemas[0]?.id ?? null)
      setSavedStructureHash(JSON.stringify(result.structure))
    } finally {
      setEditorLoading(false)
    }
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

  function onCreateDefaultRequest(): void {
    if (!editorState) return

    const existingKeys = new Set(editorState.operations.map((op) => `${op.method}:${op.path}`))
    let candidatePath = '/new'
    let suffix = 2
    while (existingKeys.has(`GET:${candidatePath}`)) {
      candidatePath = `/new${suffix}`
      suffix += 1
    }

    const key = `GET:${candidatePath}`

    const opId = `${editorState.structure.id}__op__${Date.now()}`
    const newRef: OperationRef = { id: opId, operationId: null, method: 'GET', path: candidatePath }
    const newDetail: OperationDetail = {
      key,
      sourceKey: key,
      operationId: null,
      method: 'GET',
      path: candidatePath,
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
    const sourceKey = updated.sourceKey ?? updated.key
    updateStructure((draft) => {
      syncOperationRefInStructure(draft, sourceKey, updated.method, updated.path)
    })
    setEditedOps((prev) => ({ ...prev, [sourceKey]: { ...updated, sourceKey } }))
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
          const editKey = baseOperation.sourceKey ?? baseOperation.key
          const operation = current[editKey] ?? baseOperation
          if (
            operation.requestBodySchemaName !== previousName
            && !operation.responseSchemas.some((assignment) => assignment.schemaName === previousName)
          ) {
            continue
          }

          next[editKey] = {
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

  function onSelectOperation(operationKey: string, folderId: string | null): void {
    setSelectedFolderId(folderId)
    setSelectedOpKey(operationKey)
    if (folderId !== SCHEMAS_FOLDER_ID) {
      setSelectedSchemaId(null)
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
  const hasAnyDirty = isDirty || schemaDirty || structureDirty

  return (
    <div className="flex flex-col h-full bg-surface-base text-slate-100">
      <TitleBar workspaceName={snapshot?.workspace.rootPath.split(/[\\/]/).pop()} />
      <div className="flex flex-1 overflow-hidden">
      <aside className="w-96 shrink-0 flex flex-col bg-surface-lower border-r border-surface-border">
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
                  onSelect={() => onToggleApiCard(api)}
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
                    if (selectedApiId !== api.id) {
                      void onSelectApi(api).then(() => onCreateDefaultRequest())
                    } else {
                      onCreateDefaultRequest()
                    }
                  }}
                />
                {editorState && selectedApiId === api.id && expandedApiId === api.id ? (
                  <div className="mb-1 rounded-lg border border-surface-border bg-surface-base px-2 py-2">
                    <EndpointTree
                      structure={editorState.structure}
                      selectedFolderId={selectedFolderId}
                      selectedOperationKey={selectedOperation ? `${selectedOperation.method}:${selectedOperation.path}` : selectedOpKey}
                      onSelectFolder={onSelectFolder}
                      onSelectOperation={onSelectOperation}
                      schemas={mergedSchemas}
                      selectedSchemaId={selectedSchemaId}
                      onSelectSchema={setSelectedSchemaId}
                      onCreateSchema={() => setShowCreateSchemaModal(true)}
                      schemaCount={mergedSchemas.length}
                      schemasFolderId={SCHEMAS_FOLDER_ID}
                      draggingOperationId={draggingOperationId}
                      onOperationDragStart={setDraggingOperationId}
                      onOperationDragEnd={() => setDraggingOperationId(null)}
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
              {selectedFolderId === SCHEMAS_FOLDER_ID ? (
                <div className="flex flex-col gap-4">
                  {selectedSchema ? (
                    <SchemaEditor
                      schema={selectedSchema}
                      availableSchemas={mergedSchemas}
                      onChange={onSchemaChange}
                      onAddProperty={() => addSchemaProperty(selectedSchema)}
                      onUpdateProperty={(propertyId, patch) => updateSchemaProperty(selectedSchema, propertyId, patch)}
                      onDeleteProperty={(propertyId) => deleteSchemaProperty(selectedSchema, propertyId)}
                    />
                  ) : (
                    <p className="text-sm text-slate-400">Select a schema to edit it, or create a new one.</p>
                  )}
                </div>
              ) : selectedOperation && editorState ? (
                detailTab === 'run' ? (
                  <RequestRunner
                    key={selectedOpKey ?? ''}
                    operation={selectedOperation}
                    environment={activeEnvironment}
                    schemas={mergedSchemas}
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
                <p className="text-sm text-slate-400">Select an operation from the tree to edit it.</p>
              ) : (
                <p className="text-sm text-slate-400">Open a workspace to get started.</p>
              )}
            </div>
          </section>
        </main>
      )}
      </div>

      <CreateFolderModal
        open={showCreateFolderModal}
        value={newFolderName}
        onChange={setNewFolderName}
        onConfirm={onConfirmCreateFolder}
        onCancel={() => setShowCreateFolderModal(false)}
      />

      <CreateSchemaModal
        open={showCreateSchemaModal}
        name={newSchemaName}
        usageTag={newSchemaUsageTag}
        onChangeName={setNewSchemaName}
        onChangeUsageTag={setNewSchemaUsageTag}
        onConfirm={onConfirmCreateSchema}
        onCancel={() => setShowCreateSchemaModal(false)}
      />

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

      <RenameFolderModal
        open={showRenameFolderModal}
        value={renameFolderValue}
        onChange={setRenameFolderValue}
        onConfirm={onConfirmRenameFolder}
        onCancel={() => {
          setShowRenameFolderModal(false)
          setRenameFolderTargetId(null)
        }}
      />

      <CreateWorkspaceModal
        open={showCreateWorkspaceModal}
        workspaceName={newWorkspaceName}
        firstApiName={newWorkspaceFirstApiName}
        loading={loading}
        onChangeWorkspaceName={setNewWorkspaceName}
        onChangeFirstApiName={setNewWorkspaceFirstApiName}
        onConfirm={() => { void onCreateWorkspace() }}
        onCancel={() => {
          setShowCreateWorkspaceModal(false)
          setNewWorkspaceName('')
          setNewWorkspaceFirstApiName('')
        }}
      />

      <CreateApiModal
        open={showCreateApiModal}
        value={newApiName}
        loading={loading}
        onChange={setNewApiName}
        onConfirm={() => { void onCreateApi() }}
        onCancel={() => {
          setShowCreateApiModal(false)
          setNewApiName('')
        }}
      />
    </div>
  )
}