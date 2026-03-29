import React from 'react'
import type { OperationDetail, EnvironmentParameter, SchemaDetail, ResponseSchemaAssignment } from '@apicaramba/shared-types'

interface Props {
  operation: OperationDetail
  availableParameters: EnvironmentParameter[]
  requestSchemas: SchemaDetail[]
  responseSchemas: SchemaDetail[]
  onChange: (updated: OperationDetail) => void
}

const METHOD_COLOURS: Record<string, string> = {
  GET: 'text-primary',
  POST: 'text-accent',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-secondary',
  HEAD: 'text-slate-400',
  OPTIONS: 'text-slate-400',
  TRACE: 'text-slate-400'
}

export function OperationEditor({ operation, availableParameters, requestSchemas, responseSchemas, onChange }: Props): React.JSX.Element {
  function update(fields: Partial<OperationDetail>): void {
    onChange({ ...operation, ...fields })
  }

  function toggleParameter(parameterId: string): void {
    const exists = operation.parameterIds.includes(parameterId)
    const next = exists
      ? operation.parameterIds.filter((id) => id !== parameterId)
      : [...operation.parameterIds, parameterId]

    update({ parameterIds: next })
  }

  function addRequestSchema(): void {
    update({
      requestBodyMediaType: 'application/json',
      requestBodySchemaName: requestSchemas[0]?.name ?? '',
      requestBodyRequired: false
    })
  }

  function removeRequestSchema(): void {
    update({
      requestBodyMediaType: '',
      requestBodySchemaName: '',
      requestBodyRequired: false
    })
  }

  function addResponseSchema(): void {
    const defaultCode = operation.responseSchemas.some((s) => s.responseCode === '200') ? '201' : '200'
    update({
      responseSchemas: [
        ...operation.responseSchemas,
        {
          id: `response:${Date.now()}`,
          responseCode: defaultCode,
              schemaName: responseSchemas[0]?.name ?? ''
        }
      ]
    })
  }

  function removeResponseSchema(assignmentId: string): void {
    update({
      responseSchemas: operation.responseSchemas.filter((assignment) => assignment.id !== assignmentId)
    })
  }

  function updateResponseSchema(assignmentId: string, patch: Partial<ResponseSchemaAssignment>): void {
    update({
      responseSchemas: operation.responseSchemas.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, ...patch } : assignment
      )
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Read-only identity row */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span
          className={`font-mono font-bold text-lg ${METHOD_COLOURS[operation.method] ?? 'text-slate-300'}`}
        >
          {operation.method}
        </span>
        <span className="font-mono text-base text-slate-200 break-all">{operation.path}</span>
        {operation.operationId ? (
          <span className="font-mono text-xs text-slate-500">{operation.operationId}</span>
        ) : null}
      </div>

      {/* Editable fields */}
      <Field label="Summary">
        <input
          type="text"
          className="w-full bg-surface-lower border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
          placeholder="Brief description of what this operation does"
          value={operation.summary}
          onChange={(e) => update({ summary: e.target.value })}
          style={{ userSelect: 'text' }}
        />
      </Field>

      <Field label="Description">
        <textarea
          className="w-full bg-surface-lower border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
          placeholder="Extended description (Markdown supported)"
          rows={5}
          value={operation.description}
          onChange={(e) => update({ description: e.target.value })}
          style={{ userSelect: 'text' }}
        />
      </Field>

      <Field label="Tags">
        <input
          type="text"
          className="w-full bg-surface-lower border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
          placeholder="Comma-separated tags, e.g. payments, v2"
          value={operation.tags.join(', ')}
          onChange={(e) =>
            update({
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            })
          }
          style={{ userSelect: 'text' }}
        />
      </Field>

      <Field label="Parameters">
        <div className="flex flex-col gap-2">
          {operation.parameterIds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {operation.parameterIds.map((parameterId) => {
                const parameter = availableParameters.find((item) => item.id === parameterId)
                if (!parameter) {
                  return (
                    <span key={parameterId} className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                      Missing: {parameterId}
                    </span>
                  )
                }

                return (
                  <span key={parameter.id} className="rounded-md border border-surface-border bg-surface-lower px-2 py-0.5 text-xs text-slate-200">
                    {parameter.in} / {parameter.name}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No parameters attached to this request.</p>
          )}

          {availableParameters.length === 0 ? (
            <p className="text-xs text-slate-500">Add parameters in Environment settings first.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-surface-border bg-surface-lower p-2">
              <div className="flex flex-col gap-1.5">
                {availableParameters.map((parameter) => {
                  const checked = operation.parameterIds.includes(parameter.id)
                  return (
                    <label
                      key={parameter.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-surface-base cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleParameter(parameter.id)}
                        className="mt-0.5"
                      />
                      <span className="text-xs text-slate-200">
                        <span className="font-mono">{parameter.in}</span> / <span className="font-mono">{parameter.name}</span>
                        {parameter.required ? <span className="ml-1 text-amber-300">required</span> : null}
                        {parameter.description ? (
                          <span className="block text-slate-500 mt-0.5">{parameter.description}</span>
                        ) : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Field>

      <Field label="Request Schema">
        {requestSchemas.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-lower px-3 py-2">
            <p className="text-xs text-slate-500">No request-tagged schemas available.</p>
          </div>
        ) : null}
        {operation.requestBodyMediaType.trim() === '' ? (
          <div className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-lower px-3 py-2">
            <p className="text-xs text-slate-500">No request body schema defined.</p>
            <button
              className="text-xs text-primary hover:text-primary/80 transition-colors"
              onClick={addRequestSchema}
              disabled={requestSchemas.length === 0}
            >
              + Add schema
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-center">
              <input
                type="text"
                className="w-full bg-surface-lower border border-surface-border rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary/60"
                placeholder="application/json"
                value={operation.requestBodyMediaType}
                onChange={(event) => update({ requestBodyMediaType: event.target.value })}
              />
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={operation.requestBodyRequired}
                  onChange={(event) => update({ requestBodyRequired: event.target.checked })}
                />
                Required
              </label>
              <button
                className="text-xs text-secondary hover:text-secondary/80 transition-colors"
                onClick={removeRequestSchema}
              >
                Remove schema
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Schema</span>
              <select
                className="w-full bg-surface-lower border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-primary/60"
                value={operation.requestBodySchemaName}
                onChange={(event) => update({ requestBodySchemaName: event.target.value })}
              >
                <option value="">Select a schema</option>
                {requestSchemas.map((schema) => (
                  <option key={schema.id} value={schema.name}>
                    {schema.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </Field>

      <Field label="Response Schema">
        {responseSchemas.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-lower px-3 py-2">
            <p className="text-xs text-slate-500">No response-tagged schemas available.</p>
          </div>
        ) : null}
        {operation.responseSchemas.length === 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-lower px-3 py-2">
            <p className="text-xs text-slate-500">No response schema defined.</p>
            <button
              className="text-xs text-primary hover:text-primary/80 transition-colors"
              onClick={addResponseSchema}
              disabled={responseSchemas.length === 0}
            >
              + Add schema
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {operation.responseSchemas.map((assignment) => (
              <div key={assignment.id} className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2 items-center">
                <select
                  className="w-full bg-surface-lower border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-primary/60"
                  value={assignment.responseCode}
                  onChange={(event) => updateResponseSchema(assignment.id, { responseCode: event.target.value })}
                >
                  {['200', '201', '202', '204', '300', '301', '302', '400', '401', '403', '404', '409', '422', '500'].map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <select
                  className="w-full bg-surface-lower border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-primary/60"
                  value={assignment.schemaName}
                  onChange={(event) => updateResponseSchema(assignment.id, { schemaName: event.target.value })}
                >
                  <option value="">Select a schema</option>
                  {responseSchemas.map((schema) => (
                    <option key={schema.id} value={schema.name}>
                      {schema.name}
                    </option>
                  ))}
                </select>
                <button
                  className="text-xs text-secondary hover:text-secondary/80 transition-colors"
                  onClick={() => removeResponseSchema(assignment.id)}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="self-start text-xs text-primary hover:text-primary/80 transition-colors"
              onClick={addResponseSchema}
              disabled={responseSchemas.length === 0}
            >
              + Add response mapping
            </button>
          </div>
        )}
      </Field>
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
