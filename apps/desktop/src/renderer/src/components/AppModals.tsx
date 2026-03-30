import React from 'react'
import type { SchemaUsageTag } from '@apicaramba/shared-types'

export function CreateFolderModal({
  open,
  value,
  onChange,
  onConfirm,
  onCancel
}: {
  open: boolean
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element | null {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100">Create Folder</h3>
        <p className="mt-1 text-xs text-slate-400">Choose a name for the new folder.</p>
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onConfirm()
            if (event.key === 'Escape') onCancel()
          }}
          placeholder="New folder"
          className="mt-3 w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-40"
            disabled={value.trim().length === 0}
            onClick={onConfirm}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

export function CreateSchemaModal({
  open,
  name,
  usageTag,
  onChangeName,
  onChangeUsageTag,
  onConfirm,
  onCancel
}: {
  open: boolean
  name: string
  usageTag: SchemaUsageTag
  onChangeName: (value: string) => void
  onChangeUsageTag: (value: SchemaUsageTag) => void
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element | null {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100">Create Schema</h3>
        <p className="mt-1 text-xs text-slate-400">Choose a schema name and usage tag.</p>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs text-slate-400">Schema Name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => onChangeName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onConfirm()
              if (event.key === 'Escape') onCancel()
            }}
            placeholder="NewSchema"
            className="w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs text-slate-400">Usage Tag</span>
          <select
            value={usageTag}
            onChange={(event) => onChangeUsageTag(event.target.value as SchemaUsageTag)}
            className="w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
          >
            <option value="Rqst">Request</option>
            <option value="Resp">Response</option>
            <option value="Both">Both</option>
          </select>
        </label>
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80"
            onClick={onConfirm}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

export function RenameFolderModal({
  open,
  value,
  onChange,
  onConfirm,
  onCancel
}: {
  open: boolean
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element | null {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100">Rename Folder</h3>
        <p className="mt-1 text-xs text-slate-400">Enter a new name for this folder.</p>
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onConfirm()
            if (event.key === 'Escape') onCancel()
          }}
          placeholder="Folder name"
          className="mt-3 w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-40"
            disabled={value.trim().length === 0}
            onClick={onConfirm}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  )
}

export function CreateWorkspaceModal({
  open,
  workspaceName,
  firstApiName,
  loading,
  onChangeWorkspaceName,
  onChangeFirstApiName,
  onConfirm,
  onCancel
}: {
  open: boolean
  workspaceName: string
  firstApiName: string
  loading: boolean
  onChangeWorkspaceName: (value: string) => void
  onChangeFirstApiName: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element | null {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100">Create New Workspace</h3>
        <p className="mt-1 text-xs text-slate-400">
          Enter a workspace name and the first API to create. The workspace folder will be the repo root.
        </p>
        <input
          autoFocus
          value={workspaceName}
          onChange={(event) => onChangeWorkspaceName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onConfirm()
            if (event.key === 'Escape') onCancel()
          }}
          placeholder="My API Workspace"
          className="mt-3 w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
        />
        <input
          value={firstApiName}
          onChange={(event) => onChangeFirstApiName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onConfirm()
            if (event.key === 'Escape') onCancel()
          }}
          placeholder="Payments API"
          className="mt-3 w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-40"
            disabled={workspaceName.trim().length === 0 || firstApiName.trim().length === 0 || loading}
            onClick={onConfirm}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CreateApiModal({
  open,
  value,
  loading,
  onChange,
  onConfirm,
  onCancel
}: {
  open: boolean
  value: string
  loading: boolean
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element | null {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100">Create New API</h3>
        <p className="mt-1 text-xs text-slate-400">
          Enter an API name. It will be created in its own folder at the workspace root.
        </p>
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onConfirm()
            if (event.key === 'Escape') onCancel()
          }}
          placeholder="Payments API"
          className="mt-3 w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-40"
            disabled={value.trim().length === 0 || loading}
            onClick={onConfirm}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeleteResourceModal({
  open,
  onConfirm,
  onCancel
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element | null {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100">Delete Resource</h3>
        <p className="mt-1 text-xs text-slate-400">Are you sure you want to delete this resource?</p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary text-white hover:bg-secondary/80"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export function SavePromptModal({
  open,
  onSave,
  onDiscard,
  onCancel
}: {
  open: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}): React.JSX.Element | null {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-base p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100">Unsaved Changes</h3>
        <p className="mt-1 text-xs text-slate-400">You have unsaved changes. What would you like to do?</p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-slate-400 hover:bg-surface-raised hover:text-slate-100 transition-colors"
            onClick={onDiscard}
          >
            Discard
          </button>
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80"
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
