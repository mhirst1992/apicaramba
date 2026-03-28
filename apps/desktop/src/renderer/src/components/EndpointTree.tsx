import React from 'react'
import type { ApiStructure, FolderNode } from '@apicaramba/shared-types'

interface Props {
  structure: ApiStructure
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
  draggingOperationId: string | null
  onDropOperation: (operationId: string, folderId: string | null) => void
}

function countFolderOperations(folder: FolderNode): number {
  return folder.operations.length + folder.children.reduce((sum, child) => sum + countFolderOperations(child), 0)
}

function FolderRow({
  folder,
  depth,
  selectedFolderId,
  onSelectFolder,
  draggingOperationId,
  onDropOperation
}: {
  folder: FolderNode
  depth: number
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
  draggingOperationId: string | null
  onDropOperation: (operationId: string, folderId: string | null) => void
}): React.JSX.Element {
  const [open, setOpen] = React.useState(true)
  const indent = depth * 12
  const count = countFolderOperations(folder)

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded px-2 py-1 text-xs border transition-colors ${
          selectedFolderId === folder.id
            ? 'bg-primary/15 border-primary/35 text-slate-100'
            : 'border-transparent text-slate-300 hover:bg-surface-raised'
        }`}
        style={{ marginLeft: `${indent}px` }}
        onDragOver={(event) => {
          if (!draggingOperationId) return
          event.preventDefault()
        }}
        onDrop={(event) => {
          if (!draggingOperationId) return
          event.preventDefault()
          onDropOperation(draggingOperationId, folder.id)
        }}
      >
        <button
          className="text-slate-500 hover:text-slate-300"
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Collapse folder' : 'Expand folder'}
        >
          {open ? '▾' : '▸'}
        </button>
        <button className="flex-1 text-left" onClick={() => onSelectFolder(folder.id)}>
          {folder.name} <span className="text-slate-500">({count})</span>
        </button>
      </div>

      {open
        ? folder.children.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              draggingOperationId={draggingOperationId}
              onDropOperation={onDropOperation}
            />
          ))
        : null}
    </div>
  )
}

export function EndpointTree({
  structure,
  selectedFolderId,
  onSelectFolder,
  draggingOperationId,
  onDropOperation
}: Props): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      {structure.rootFolder.children.map((child) => (
        <FolderRow
          key={child.id}
          folder={child}
          depth={0}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
          draggingOperationId={draggingOperationId}
          onDropOperation={onDropOperation}
        />
      ))}

      <div
        className={`mt-1 rounded px-2 py-1 text-xs border transition-colors ${
          selectedFolderId === null
            ? 'bg-primary/15 border-primary/35 text-slate-100'
            : 'border-transparent text-slate-300 hover:bg-surface-raised'
        }`}
        onDragOver={(event) => {
          if (!draggingOperationId) return
          event.preventDefault()
        }}
        onDrop={(event) => {
          if (!draggingOperationId) return
          event.preventDefault()
          onDropOperation(draggingOperationId, null)
        }}
      >
        <button className="w-full text-left" onClick={() => onSelectFolder(null)}>
          Unsorted <span className="text-slate-500">({structure.ungrouped.length})</span>
        </button>
      </div>

      {structure.rootFolder.children.length === 0 && structure.ungrouped.length === 0 ? (
        <p className="px-2 text-xs text-slate-500">No operations found.</p>
      ) : null}
    </div>
  )
}
