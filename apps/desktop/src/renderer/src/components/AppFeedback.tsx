import React from 'react'
import type { ValidateOpenApiResult } from '@apicaramba/shared-types'

export type SaveStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | { type: 'validation-failed'; issues: { message: string; path: string | null }[] }
  | { type: 'error'; message: string }

export function SaveButton({
  status,
  isDirty,
  disabled,
  onClick
}: {
  status: SaveStatus
  isDirty: boolean
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
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

export function SaveFeedback({ status }: { status: SaveStatus }): React.JSX.Element | null {
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

export function ValidationResultPanel({ result }: { result: ValidateOpenApiResult }): React.JSX.Element | null {
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
