import React from 'react'
import type { OperationDetail } from '@apicaramba/shared-types'

interface Props {
  operation: OperationDetail
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

export function OperationEditor({ operation, onChange }: Props): React.JSX.Element {
  function update(fields: Partial<OperationDetail>): void {
    onChange({ ...operation, ...fields })
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
