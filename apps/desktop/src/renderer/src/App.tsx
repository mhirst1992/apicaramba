import React from 'react'
import type {
  WorkspaceSnapshot,
  ApiSummary,
  ValidateOpenApiResult,
  ApiStructure,
  OperationDetail,
  SaveApiEditorResult,
  EnvironmentsConfig,
  Environment
} from '@apicaramba/shared-types'
import { EndpointTree } from './components/EndpointTree.js'
import { OperationEditor } from './components/OperationEditor.js'

// --- Types -------------------------------------------------------------------

interface EditorState {
  api: ApiSummary
  structure: ApiStructure
  operations: OperationDetail[]
}

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
  const [selectedOpKey, setSelectedOpKey] = React.useState<string | null>(null)
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

  const selectedApi = React.useMemo(
    () => snapshot?.apis.find((a) => a.id === selectedApiId) ?? null,
    [snapshot, selectedApiId]
  )

  const isDirty = Object.keys(editedOps).length > 0

  const mergedOperations: OperationDetail[] = React.useMemo(() => {
    if (!editorState) return []
    return editorState.operations.map((op) => editedOps[op.key] ?? op)
  }, [editorState, editedOps])

  const selectedOperation = React.useMemo(
    () => mergedOperations.find((op) => op.key === selectedOpKey) ?? null,
    [mergedOperations, selectedOpKey]
  )

  async function onOpenWorkspace(): Promise<void> {
    setLoading(true)
    setOpenError(null)
    try {
      const result = await window.appBridge.openWorkspace()
      if (result.status === 'cancelled') return
      if (result.status === 'error') { setOpenError(result.message); return }
      setSnapshot(result.snapshot)
      setSelectedApiId(result.snapshot.apis[0]?.id ?? null)
      setEditorState(null)
      setEditedOps({})
      setSelectedOpKey(null)
      setSaveStatus('idle')
      setValidationResult(null)
      await loadEnvironmentsForWorkspace(result.snapshot.workspace.rootPath)
      if (result.snapshot.apis[0]) {
        await loadEditorForApi(result.snapshot.workspace.rootPath, result.snapshot.apis[0])
      }
    } finally {
      setLoading(false)
    }
  }

  async function onSelectApi(api: ApiSummary): Promise<void> {
    if (!snapshot) return
    setSelectedApiId(api.id)
    setValidationResult(null)
    await loadEditorForApi(snapshot.workspace.rootPath, api)
  }

  async function loadEnvironmentsForWorkspace(rootPath: string): Promise<void> {
    setEnvironmentsLoading(true)
    setEnvironmentsError(null)
    setEnvironmentsMessage(null)

    try {
      const result = await window.appBridge.loadEnvironments({ workspaceRootPath: rootPath })
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

  async function onSaveEnvironments(): Promise<void> {
    if (!snapshot || !environmentsDraft) {
      return
    }

    setEnvironmentsSaving(true)
    setEnvironmentsError(null)
    try {
      const result = await window.appBridge.saveEnvironments({
        workspaceRootPath: snapshot.workspace.rootPath,
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
    setSelectedOpKey(null)
    setSaveStatus('idle')
    try {
      const result = await window.appBridge.loadApiEditor({
        workspaceRootPath: rootPath,
        openapiRelativePath: api.openapiPath
      })
      if (result.status === 'error') { setSaveStatus({ type: 'error', message: result.message }); return }
      setEditorState({ api, structure: result.structure, operations: result.operations })
      setSelectedOpKey(result.operations[0]?.key ?? null)
    } finally {
      setEditorLoading(false)
    }
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
      const result: SaveApiEditorResult = await window.appBridge.saveApiEditor({
        workspaceRootPath: snapshot.workspace.rootPath,
        openapiRelativePath: editorState.api.openapiPath,
        operations: mergedOperations
      })
      if (result.status === 'saved') {
        setEditorState((prev) => prev ? { ...prev, operations: mergedOperations } : prev)
        setEditedOps({})
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

  const sideApis = snapshot?.apis ?? []
  const activeEnvironment = environmentsDraft?.environments[0] ?? null
  const environmentsDirty = JSON.stringify(environmentsConfig) !== JSON.stringify(environmentsDraft)

  return (
    <div className="flex flex-col h-full bg-surface-base text-slate-100">
      <TitleBar workspaceName={snapshot?.workspace.rootPath.split(/[\\/]/).pop()} />
      <div className="flex flex-1 overflow-hidden">
      <aside className="w-56 shrink-0 flex flex-col bg-surface-lower border-r border-surface-border">
        <div className="flex items-center px-4 h-10 border-b border-surface-border shrink-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">APIs</span>
        </div>
        <div className="flex-1 flex flex-col items-start px-3 pt-3 gap-1 overflow-y-auto">
          {sideApis.length === 0 ? (
            <SidebarPlaceholder />
          ) : (
            sideApis.map((api) => (
              <ApiListItem
                key={api.id}
                api={api}
                isSelected={selectedApiId === api.id}
                onClick={() => { void onSelectApi(api) }}
              />
            ))
          )}
        </div>
        {snapshot ? (
          <div className="px-3 pb-3 shrink-0">
            <button
              className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-200 transition-colors"
              onClick={() => { void onOpenWorkspace() }}
              disabled={loading}
            >
              {loading ? 'Opening�' : 'Switch Workspace'}
            </button>
          </div>
        ) : null}
      </aside>

      {!snapshot ? (
        <main className="flex-1 overflow-auto bg-surface-base">
          <div className="max-w-3xl mx-auto px-8 py-10">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">Open a workspace</h1>
                <p className="text-sm text-slate-400 leading-relaxed">
                  A workspace is a Git repository containing your API definitions.
                </p>
              </div>
              <button
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 active:bg-primary/70 disabled:bg-primary/30 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={() => { void onOpenWorkspace() }}
                disabled={loading}
              >
                {loading ? 'Opening�' : 'Open Workspace'}
              </button>
            </div>
            {openError ? (
              <div className="mt-5 rounded-lg border border-secondary/60 bg-secondary/10 px-4 py-3 text-sm text-slate-300">
                {openError}
              </div>
            ) : null}
            <EmptyState />
          </div>
        </main>
      ) : (
        <main className="flex-1 flex overflow-hidden">
          <section className="w-72 shrink-0 flex flex-col border-r border-surface-border overflow-hidden">
            <div className="flex items-center px-4 h-12 border-b border-surface-border shrink-0">
              <span className="text-sm font-semibold text-slate-200 truncate">
                {editorState?.api.name ?? selectedApi?.name ?? 'Endpoints'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">
              {editorLoading ? (
                <TreeSkeleton />
              ) : editorState ? (
                <EndpointTree
                  structure={editorState.structure}
                  selectedKey={selectedOpKey}
                  onSelectOperation={setSelectedOpKey}
                />
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
                <button
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-300 hover:bg-surface-raised hover:text-slate-100 disabled:opacity-40 transition-colors"
                  onClick={() => { void onValidate() }}
                  disabled={validating || !editorState}
                >
                  {validating ? 'Validating�' : 'Validate'}
                </button>
                <SaveButton
                  status={saveStatus}
                  isDirty={isDirty}
                  disabled={!editorState || saveStatus === 'saving'}
                  onClick={() => { void onSave() }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <EnvironmentPanel
                environment={activeEnvironment}
                loading={environmentsLoading}
                saving={environmentsSaving}
                dirty={environmentsDirty}
                error={environmentsError}
                message={environmentsMessage}
                onChangeName={(name) => updateActiveEnvironment({ name })}
                onChangeBaseUrl={(baseUrl) => updateActiveEnvironment({ baseUrl })}
                onSave={onSaveEnvironments}
              />
              <SaveFeedback status={saveStatus} />
              {validationResult ? (
                <div className="mb-5">
                  <ValidationResultPanel result={validationResult} />
                </div>
              ) : null}
              {selectedOperation && editorState ? (
                <OperationEditor operation={selectedOperation} onChange={onOperationChange} />
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
    </div>
  )
}

interface EnvironmentPanelProps {
  environment: Environment | null
  loading: boolean
  saving: boolean
  dirty: boolean
  error: string | null
  message: string | null
  onChangeName: (value: string) => void
  onChangeBaseUrl: (value: string) => void
  onSave: () => void
}

function EnvironmentPanel(props: EnvironmentPanelProps): React.JSX.Element {
  return (
    <div className="mb-5 rounded-lg border border-surface-border bg-surface-lower px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Environment</h3>
          <p className="text-xs text-slate-400 mt-0.5">Single profile stored in .api-tool/environments.json</p>
        </div>
        <button
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-300 hover:bg-surface-raised hover:text-slate-100 disabled:opacity-40 transition-colors"
          disabled={props.loading || props.saving || !props.environment || !props.dirty}
          onClick={props.onSave}
        >
          {props.saving ? 'Saving...' : 'Save Environment'}
        </button>
      </div>

      {props.error ? (
        <div className="mt-3 rounded-lg border border-secondary/60 bg-secondary/10 px-3 py-2 text-xs text-slate-300">
          {props.error}
        </div>
      ) : null}

      {props.message ? (
        <div className="mt-3 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-xs text-slate-200">
          {props.message}
        </div>
      ) : null}

      {props.loading ? (
        <p className="mt-3 text-xs text-slate-400">Loading environment...</p>
      ) : props.environment ? (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Name</span>
            <input
              value={props.environment.name}
              onChange={(event) => props.onChangeName(event.target.value)}
              className="rounded-lg border border-surface-border bg-surface-base px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
              placeholder="Default"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Base URL</span>
            <input
              value={props.environment.baseUrl}
              onChange={(event) => props.onChangeBaseUrl(event.target.value)}
              className="rounded-lg border border-surface-border bg-surface-base px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
              placeholder="https://api.example.com"
            />
          </label>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">Environment profile unavailable.</p>
      )}
    </div>
  )
}

function SaveButton({ status, isDirty, disabled, onClick }: { status: SaveStatus; isDirty: boolean; disabled: boolean; onClick: () => void }): React.JSX.Element {
  const label = status === 'saving' ? 'Saving�' : status === 'saved' ? '? Saved' : 'Save'
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

function EmptyState(): React.JSX.Element {
  return (
    <div className="mt-10 flex flex-col items-center text-center gap-5 max-w-[460px] px-2">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <WorkspaceIcon />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">Load your Git workspace</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          APICaramba will scan the repository for openapi.json files and show operations by API.
        </p>
      </div>
    </div>
  )
}

function ApiListItem({ api, isSelected, onClick }: { api: ApiSummary; isSelected: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors ${isSelected ? 'bg-primary/15 border-primary/35 text-slate-100' : 'border-transparent text-slate-300 hover:bg-surface-raised hover:text-slate-100'}`}
      onClick={onClick}
    >
      <div className="text-sm font-medium truncate">{api.name}</div>
      <div className="text-xs text-slate-500 truncate">{api.operationCount} operations</div>
    </button>
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
      <span className="text-accent mr-1">{'}'}</span>
      <span className="text-secondary">caramba</span>
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

function WorkspaceIcon(): React.JSX.Element {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="text-primary">
      <path d="M4 8a4 4 0 014-4h16a4 4 0 014 4v16a4 4 0 01-4 4H8a4 4 0 01-4-4V8z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 16h12M16 10v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
