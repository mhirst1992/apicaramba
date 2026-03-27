import React from 'react'
import type {
  WorkspaceSnapshot,
  ApiSummary,
  ValidateOpenApiResult
} from '@apicaramba/shared-types'

export default function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = React.useState<WorkspaceSnapshot | null>(null)
  const [selectedApiId, setSelectedApiId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [validationResult, setValidationResult] = React.useState<ValidateOpenApiResult | null>(null)
  const [validating, setValidating] = React.useState(false)

  const selectedApi = React.useMemo(() => {
    if (!snapshot || !selectedApiId) {
      return null
    }

    return snapshot.apis.find((api) => api.id === selectedApiId) ?? null
  }, [snapshot, selectedApiId])

  async function onOpenWorkspace(): Promise<void> {
    setLoading(true)
    setError(null)

    try {
      const result = await window.appBridge.openWorkspace()
      if (result.status === 'cancelled') {
        return
      }

      if (result.status === 'error') {
        setError(result.message)
        return
      }

      setSnapshot(result.snapshot)
      setSelectedApiId(result.snapshot.apis[0]?.id ?? null)
      setValidationResult(null)
    } finally {
      setLoading(false)
    }
  }

  async function onValidateSelectedApi(): Promise<void> {
    if (!snapshot || !selectedApi) {
      return
    }

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

  const sideApis = snapshot?.apis ?? []

  return (
    <div className="flex h-full bg-[#0f1117] text-slate-100">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col bg-[#161b22] border-r border-[#21262d]">
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-[#21262d] shrink-0">
          <ApiIcon />
          <span className="text-sm font-semibold tracking-tight text-slate-100">
            APICaramba
          </span>
        </div>
        <div className="flex-1 flex flex-col items-start px-3 pt-4 gap-1">
          {sideApis.length === 0 ? (
            <SidebarPlaceholder />
          ) : (
            sideApis.map((api) => (
              <ApiListItem
                key={api.id}
                api={api}
                isSelected={selectedApiId === api.id}
                onClick={() => setSelectedApiId(api.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                {snapshot ? snapshot.workspace.name : 'Open a workspace'}
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                {snapshot
                  ? snapshot.workspace.rootPath
                  : 'A workspace is a Git repository containing your API definitions.'}
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-800/70 disabled:text-slate-300 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              onClick={onOpenWorkspace}
              disabled={loading}
            >
              {loading ? 'Opening...' : snapshot ? 'Switch Workspace' : 'Open Workspace'}
            </button>
          </div>

          {error ? (
            <div className="mt-5 rounded-lg border border-rose-800/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          {!snapshot ? (
            <EmptyState />
          ) : (
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-4">
              {snapshot.apis.length === 0 ? (
                <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-5 text-sm text-slate-400">
                  No openapi.json files were found in this repository.
                </div>
              ) : (
                snapshot.apis.map((api) => (
                  <ApiCard key={api.id} api={api} selected={selectedApiId === api.id} />
                ))
              )}
            </div>
          )}

          {selectedApi ? (
            <div className="mt-8 rounded-xl border border-[#21262d] bg-[#111723] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Operations</h2>
                  <p className="text-sm text-slate-400 mt-1">{selectedApi.openapiPath}</p>
                </div>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 disabled:bg-emerald-900/70 disabled:text-slate-300 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                  onClick={onValidateSelectedApi}
                  disabled={validating}
                >
                  {validating ? 'Validating...' : 'Validate OpenAPI'}
                </button>
              </div>

              <ValidationResultPanel result={validationResult} />

              <ul className="mt-4 space-y-2">
                {selectedApi.operations.length === 0 ? (
                  <li className="text-sm text-slate-500">No operations found in this API document.</li>
                ) : (
                  selectedApi.operations.map((operation) => (
                    <li
                      key={`${operation.method}:${operation.path}:${operation.operationId ?? ''}`}
                      className="rounded-lg border border-[#21262d] bg-[#0f1117] px-3 py-2 text-sm"
                    >
                      <span className="text-indigo-300 font-semibold mr-3">{operation.method}</span>
                      <span className="text-slate-200">{operation.path}</span>
                      {operation.operationId ? (
                        <span className="text-slate-500 ml-3">{operation.operationId}</span>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 text-xs text-slate-600">Git must be installed on your system.</div>
        </div>
      </main>
    </div>
  )
}

interface ValidationResultPanelProps {
  result: ValidateOpenApiResult | null
}

function ValidationResultPanel(props: ValidationResultPanelProps): React.JSX.Element | null {
  if (!props.result) {
    return null
  }

  if (props.result.status === 'valid') {
    return (
      <div className="mt-4 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
        OpenAPI document is structurally valid.
      </div>
    )
  }

  if (props.result.status === 'error') {
    return (
      <div className="mt-4 rounded-lg border border-rose-800/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
        {props.result.message}
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-3">
      <p className="text-sm text-amber-300">
        Validation found {props.result.issueCount} issue{props.result.issueCount === 1 ? '' : 's'}.
      </p>
      <ul className="mt-2 space-y-2">
        {props.result.issues.slice(0, 8).map((issue, index) => (
          <li key={`${issue.path ?? 'root'}-${index}`} className="text-xs text-amber-200/90">
            {issue.path ? `${issue.path}: ` : ''}
            {issue.message}
          </li>
        ))}
      </ul>
      {props.result.issueCount > 8 ? (
        <p className="mt-2 text-xs text-amber-400">Showing first 8 issues.</p>
      ) : null}
    </div>
  )
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="mt-10 flex flex-col items-center text-center gap-5 max-w-[460px] px-2">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
        <WorkspaceIcon />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-slate-100">Load your Git workspace</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          APICaramba will scan the repository for openapi.json files and show operations by API.
        </p>
      </div>
    </div>
  )
}

interface ApiListItemProps {
  api: ApiSummary
  isSelected: boolean
  onClick: () => void
}

function ApiListItem(props: ApiListItemProps): React.JSX.Element {
  return (
    <button
      className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors ${
        props.isSelected
          ? 'bg-indigo-500/20 border-indigo-400/40 text-slate-100'
          : 'border-transparent text-slate-300 hover:bg-[#1b2230] hover:text-slate-100'
      }`}
      onClick={props.onClick}
    >
      <div className="text-sm font-medium truncate">{props.api.name}</div>
      <div className="text-xs text-slate-500 truncate">{props.api.operationCount} operations</div>
    </button>
  )
}

interface ApiCardProps {
  api: ApiSummary
  selected: boolean
}

function ApiCard(props: ApiCardProps): React.JSX.Element {
  return (
    <div
      className={`rounded-xl border p-5 ${
        props.selected ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-[#21262d] bg-[#161b22]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">{props.api.name}</h3>
          <p className="text-xs text-slate-500 mt-1">{props.api.path || '/'}</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-[#0f1117] border border-[#273047] text-slate-300">
          {props.api.operationCount} ops
        </span>
      </div>
      <p className="text-sm text-slate-400 mt-3 line-clamp-2">{props.api.openapiPath}</p>
      {props.api.version ? <p className="text-xs text-slate-500 mt-2">v{props.api.version}</p> : null}
    </div>
  )
}

function ApiIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="text-indigo-400 shrink-0"
    >
      <rect x="1" y="1" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 9h8M9 5v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function WorkspaceIcon(): React.JSX.Element {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="text-indigo-400"
    >
      <path
        d="M4 8a4 4 0 014-4h16a4 4 0 014 4v16a4 4 0 01-4 4H8a4 4 0 01-4-4V8z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10 16h12M16 10v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SidebarPlaceholder(): React.JSX.Element {
  return (
    <div className="w-full space-y-1" aria-hidden="true">
      {[80, 60, 70].map((w, i) => (
        <div
          key={i}
          className="h-5 rounded bg-[#21262d] animate-pulse"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  )
}
