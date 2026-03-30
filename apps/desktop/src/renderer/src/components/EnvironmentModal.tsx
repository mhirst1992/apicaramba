import React from 'react'
import type { Environment, EnvironmentParameter, ParameterLocation } from '@apicaramba/shared-types'
import { createParameterId } from '../utils/parameterUtils.js'

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
  onRenameApi?: () => void
}

export function EnvironmentModal(props: EnvironmentModalProps): React.JSX.Element {
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
              disabled={props.loading}
              onClick={props.onRenameApi}
              title="Rename this API"
            >
              Rename API
            </button>
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
