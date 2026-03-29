import React from 'react'
import type { ApiStructure, FolderNode } from '@apicaramba/shared-types'

const ROOT_DROP_TARGET = '__root__'

interface Props {
  structure: ApiStructure
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
  schemasFolderId: string
  schemaCount: number
  draggingOperationId: string | null
  onDropOperation: (operationId: string, folderId: string | null) => void
  draggingFolderId: string | null
  onFolderDragStart: (folderId: string) => void
  onFolderDragEnd: () => void
  onDropFolder: (folderId: string, targetParentId: string | null) => void
  onRenameFolder: (folderId: string, currentName: string) => void
  onDeleteFolder: (folderId: string) => void
}

function countFolderOperations(folder: FolderNode): number {
  return folder.operations.length + folder.children.reduce((sum, child) => sum + countFolderOperations(child), 0)
}

function containsFolder(folder: FolderNode, id: string): boolean {
  if (folder.id === id) return true
  return folder.children.some((c) => containsFolder(c, id))
}

function FolderRow({
  folder,
  depth,
  selectedFolderId,
  onSelectFolder,
  draggingOperationId,
  onDropOperation,
  draggingFolderId,
  onFolderDragStart,
  onFolderDragEnd,
  onDropFolder,
  hoveredDropTarget,
  setHoveredDropTarget,
  onRenameFolder,
  onDeleteFolder
}: {
  folder: FolderNode
  depth: number
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
  draggingOperationId: string | null
  onDropOperation: (operationId: string, folderId: string | null) => void
  draggingFolderId: string | null
  onFolderDragStart: (folderId: string) => void
  onFolderDragEnd: () => void
  onDropFolder: (folderId: string, targetParentId: string | null) => void
  hoveredDropTarget: string | null
  setHoveredDropTarget: (target: string | null) => void
  onRenameFolder: (folderId: string, currentName: string) => void
  onDeleteFolder: (folderId: string) => void
}): React.JSX.Element {
  const [open, setOpen] = React.useState(true)
  const indent = depth * 12
  const count = countFolderOperations(folder)

  const isInvalidFolderTarget = draggingFolderId !== null && containsFolder(folder, draggingFolderId)
  const isHoveredForDrop = hoveredDropTarget === folder.id
  const acceptingDrop = (draggingOperationId || (draggingFolderId && !isInvalidFolderTarget)) && isHoveredForDrop

  function handleDragEnter(event: React.DragEvent): void {
    if (!draggingOperationId && (!draggingFolderId || isInvalidFolderTarget)) return
    event.preventDefault()
    setHoveredDropTarget(folder.id)
  }

  function handleDragOver(event: React.DragEvent): void {
    if (!draggingOperationId && (!draggingFolderId || isInvalidFolderTarget)) return
    event.preventDefault()
    if (hoveredDropTarget !== folder.id) setHoveredDropTarget(folder.id)
  }

  function handleDragLeave(event: React.DragEvent): void {
    if (!draggingOperationId && !draggingFolderId) return
    const related = event.relatedTarget
    if (related instanceof Node && event.currentTarget.contains(related)) return
    if (hoveredDropTarget === folder.id) setHoveredDropTarget(null)
  }

  function handleDrop(event: React.DragEvent): void {
    event.preventDefault()
    setHoveredDropTarget(null)
    if (draggingOperationId) {
      onDropOperation(draggingOperationId, folder.id)
    } else if (draggingFolderId && !isInvalidFolderTarget) {
      onDropFolder(draggingFolderId, folder.id)
    }
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded px-2 py-1 text-xs border transition-colors ${
          acceptingDrop
            ? 'border-accent bg-accent/10 text-slate-100'
            : selectedFolderId === folder.id
              ? 'bg-primary/15 border-primary/35 text-slate-100'
              : 'border-transparent text-slate-300 hover:bg-surface-raised'
        } group`}
        style={{ marginLeft: `${indent}px` }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          className="text-slate-500 hover:text-slate-300 cursor-grab shrink-0"
          title="Drag to move folder"
          draggable
          onDragStart={(e) => { e.stopPropagation(); onFolderDragStart(folder.id) }}
          onDragEnd={(e) => { e.stopPropagation(); onFolderDragEnd() }}
        >
          ⋮⋮
        </button>
        <button
          className="text-slate-500 hover:text-slate-300 shrink-0"
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Collapse folder' : 'Expand folder'}
        >
          {open ? '▾' : '▸'}
        </button>
        <button className="flex-1 text-left truncate" onClick={() => onSelectFolder(folder.id)}>
          {folder.name} <span className="text-slate-500">({count})</span>
        </button>
        <button
          className="hidden group-hover:flex items-center text-slate-500 hover:text-slate-200 shrink-0 px-0.5"
          title="Rename folder"
          onClick={(e) => { e.stopPropagation(); onRenameFolder(folder.id, folder.name) }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          className="hidden group-hover:flex items-center text-slate-500 hover:text-red-400 shrink-0 px-0.5"
          title="Delete folder"
          onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id) }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
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
              draggingFolderId={draggingFolderId}
              onFolderDragStart={onFolderDragStart}
              onFolderDragEnd={onFolderDragEnd}
              onDropFolder={onDropFolder}
              hoveredDropTarget={hoveredDropTarget}
              setHoveredDropTarget={setHoveredDropTarget}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
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
  schemasFolderId,
  schemaCount,
  draggingOperationId,
  onDropOperation,
  draggingFolderId,
  onFolderDragStart,
  onFolderDragEnd,
  onDropFolder,
  onRenameFolder,
  onDeleteFolder
}: Props): React.JSX.Element {
  const [hoveredDropTarget, setHoveredDropTarget] = React.useState<string | null>(null)

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
          draggingFolderId={draggingFolderId}
          onFolderDragStart={onFolderDragStart}
          onFolderDragEnd={onFolderDragEnd}
          onDropFolder={onDropFolder}
          hoveredDropTarget={hoveredDropTarget}
          setHoveredDropTarget={setHoveredDropTarget}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
        />
      ))}

      <div
        className={`mt-1 rounded px-2 py-1 text-xs border transition-colors ${
          draggingOperationId && hoveredDropTarget === 'unsorted'
            ? 'border-accent bg-accent/10 text-slate-100'
            : selectedFolderId === null
              ? 'bg-primary/15 border-primary/35 text-slate-100'
              : 'border-transparent text-slate-300 hover:bg-surface-raised'
        }`}
        onDragEnter={(event) => {
          if (!draggingOperationId) return
          event.preventDefault()
          setHoveredDropTarget('unsorted')
        }}
        onDragOver={(event) => {
          if (!draggingOperationId) return
          event.preventDefault()
          if (hoveredDropTarget !== 'unsorted') setHoveredDropTarget('unsorted')
        }}
        onDragLeave={(event) => {
          if (!draggingOperationId) return
          const related = event.relatedTarget
          if (related instanceof Node && event.currentTarget.contains(related)) return
          if (hoveredDropTarget === 'unsorted') setHoveredDropTarget(null)
        }}
        onDrop={(event) => {
          if (!draggingOperationId) return
          event.preventDefault()
          setHoveredDropTarget(null)
          onDropOperation(draggingOperationId, null)
        }}
      >
        <button className="w-full text-left" onClick={() => onSelectFolder(null)}>
          Unsorted <span className="text-slate-500">({structure.ungrouped.length})</span>
        </button>
      </div>

      <div
        className={`rounded px-2 py-1 text-xs border transition-colors ${
          selectedFolderId === schemasFolderId
            ? 'bg-primary/15 border-primary/35 text-slate-100'
            : 'border-transparent text-slate-300 hover:bg-surface-raised'
        }`}
      >
        <button className="w-full text-left" onClick={() => onSelectFolder(schemasFolderId)}>
          Schemas <span className="text-slate-500">({schemaCount})</span>
        </button>
      </div>

      {draggingFolderId ? (
        <div
          className={`rounded px-2 py-1 text-xs border transition-colors ${
            hoveredDropTarget === ROOT_DROP_TARGET
              ? 'border-accent bg-accent/10 text-slate-100'
              : 'border-dashed border-surface-border text-slate-500'
          }`}
          onDragEnter={(event) => {
            event.preventDefault()
            setHoveredDropTarget(ROOT_DROP_TARGET)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (hoveredDropTarget !== ROOT_DROP_TARGET) setHoveredDropTarget(ROOT_DROP_TARGET)
          }}
          onDragLeave={(event) => {
            const related = event.relatedTarget
            if (related instanceof Node && event.currentTarget.contains(related)) return
            if (hoveredDropTarget === ROOT_DROP_TARGET) setHoveredDropTarget(null)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setHoveredDropTarget(null)
            onDropFolder(draggingFolderId, null)
          }}
        >
          Move to top level
        </div>
      ) : null}

      {structure.rootFolder.children.length === 0 && structure.ungrouped.length === 0 ? (
        <p className="px-2 text-xs text-slate-500">No operations found.</p>
      ) : null}
    </div>
  )
}
