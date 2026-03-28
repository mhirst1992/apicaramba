import React from 'react'
import type { ApiStructure, OperationRef } from '@apicaramba/shared-types'

interface Props {
  structure: ApiStructure
  selectedKey: string | null
  onSelectOperation: (key: string) => void
}

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

function methodColour(method: string): string {
  return METHOD_COLOURS[method] ?? 'text-slate-400'
}

interface OperationRowProps {
  op: OperationRef
  isSelected: boolean
  onSelect: () => void
}

function OperationRow({ op, isSelected, onSelect }: OperationRowProps): React.JSX.Element {
  const key = `${op.method}:${op.path}`
  return (
    <button
      key={key}
      className={`w-full text-left px-2 py-1.5 rounded transition-colors group ${
        isSelected
          ? 'bg-primary/15 border border-primary/30'
          : 'border border-transparent hover:bg-surface-raised'
      }`}
      onClick={onSelect}
      title={op.operationId ?? undefined}
    >
      <span className={`font-mono text-xs font-semibold mr-2 ${methodColour(op.method)}`}>
        {op.method}
      </span>
      <span className="text-xs text-slate-300 truncate">{op.path}</span>
    </button>
  )
}

export function EndpointTree({ structure, selectedKey, onSelectOperation }: Props): React.JSX.Element {
  const allOps: OperationRef[] = [
    ...collectFolderOps(structure.rootFolder),
    ...structure.ungrouped
  ]

  const ungroupedOps = structure.ungrouped
  const hasGroups = structure.rootFolder.children.length > 0 || structure.rootFolder.operations.length > 0

  return (
    <div className="flex flex-col gap-1">
      {hasGroups ? (
        <FolderSection
          folder={structure.rootFolder}
          depth={0}
          selectedKey={selectedKey}
          onSelectOperation={onSelectOperation}
        />
      ) : null}

      {ungroupedOps.length > 0 ? (
        <div className="mt-1">
          {hasGroups ? (
            <p className="px-2 mb-1 text-xs font-medium text-slate-500 uppercase tracking-wider">
              Ungrouped
            </p>
          ) : null}
          {ungroupedOps.map((op) => {
            const key = `${op.method}:${op.path}`
            return (
              <OperationRow
                key={key}
                op={op}
                isSelected={selectedKey === key}
                onSelect={() => onSelectOperation(key)}
              />
            )
          })}
        </div>
      ) : null}

      {allOps.length === 0 ? (
        <p className="px-2 text-xs text-slate-500">No operations found.</p>
      ) : null}
    </div>
  )
}

interface FolderSectionProps {
  folder: import('@apicaramba/shared-types').FolderNode
  depth: number
  selectedKey: string | null
  onSelectOperation: (key: string) => void
}

function FolderSection({ folder, depth, selectedKey, onSelectOperation }: FolderSectionProps): React.JSX.Element {
  const [open, setOpen] = React.useState(true)
  const indent = depth * 12

  return (
    <div>
      {depth > 0 ? (
        <button
          className="flex items-center gap-1 w-full text-left px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="text-slate-500">{open ? '▾' : '▸'}</span>
          <span className="font-medium">{folder.name}</span>
        </button>
      ) : null}

      {open ? (
        <>
          {folder.operations.map((op) => {
            const key = `${op.method}:${op.path}`
            return (
              <div key={key} style={{ paddingLeft: `${indent}px` }}>
                <OperationRow
                  op={op}
                  isSelected={selectedKey === key}
                  onSelect={() => onSelectOperation(key)}
                />
              </div>
            )
          })}
          {folder.children.map((child) => (
            <FolderSection
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedKey={selectedKey}
              onSelectOperation={onSelectOperation}
            />
          ))}
        </>
      ) : null}
    </div>
  )
}

function collectFolderOps(folder: import('@apicaramba/shared-types').FolderNode): OperationRef[] {
  return [
    ...folder.operations,
    ...folder.children.flatMap(collectFolderOps)
  ]
}
