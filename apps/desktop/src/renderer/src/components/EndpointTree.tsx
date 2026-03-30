import React from 'react'
import type { ApiStructure, FolderNode, OperationRef, SchemaDetail } from '@apicaramba/shared-types'

const ROOT_DROP_TARGET = '__root__'

function usageTagLabel(value: SchemaDetail['usageTag']): string {
  if (value === 'Rqst') return 'Request'
  if (value === 'Resp') return 'Response'
  return 'Both'
}

interface Props {
  structure: ApiStructure
  selectedFolderId: string | null
  selectedOperationKey: string | null
  onSelectFolder: (folderId: string | null) => void
  onSelectOperation: (operationKey: string, folderId: string | null) => void
  onDeleteOperation: (operation: OperationRef, folderId: string | null) => void
  schemasFolderId: string
  schemas: SchemaDetail[]
  selectedSchemaId: string | null
  onSelectSchema: (schemaId: string) => void
  onCreateSchema: () => void
  onDeleteSchema: (schemaId: string) => void
  schemaCount: number
  draggingOperationId: string | null
  onOperationDragStart: (operationId: string) => void
  onOperationDragEnd: () => void
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

function operationKey(op: OperationRef): string {
  return `${op.method}:${op.path}`
}

function methodColour(method: string): string {
  const colours: Record<string, string> = {
    GET: 'text-[#6C7D47]',
    POST: 'text-[#FACC15]',
    PUT: 'text-blue-400',
    PATCH: 'text-purple-400',
    DELETE: 'text-[#BC4B51]',
    HEAD: 'text-slate-400',
    OPTIONS: 'text-slate-400',
    TRACE: 'text-slate-400'
  }

  return colours[method] ?? 'text-slate-400'
}

function OperationRow({
  operation,
  depth,
  folderId,
  selectedOperationKey,
  onSelectOperation,
  onSelectFolder,
  onDeleteOperation,
  onDragStart,
  onDragEnd
}: {
  operation: OperationRef
  depth: number
  folderId: string | null
  selectedOperationKey: string | null
  onSelectOperation: (operationKey: string, folderId: string | null) => void
  onSelectFolder: (folderId: string | null) => void
  onDeleteOperation: (operation: OperationRef, folderId: string | null) => void
  onDragStart: (operationId: string) => void
  onDragEnd: () => void
}): React.JSX.Element {
  const key = operationKey(operation)
  const indent = depth * 14

  return (
    <div
      className={`group flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors ${
        selectedOperationKey === key
          ? 'bg-primary/15 border-primary/35 text-slate-100'
          : 'border-transparent text-slate-300 hover:bg-surface-raised'
      }`}
      style={{ marginLeft: `${indent}px` }}
    >
      <button
        className="text-slate-500 hover:text-slate-300 cursor-grab shrink-0"
        title="Drag to move"
        draggable
        onDragStart={() => onDragStart(operation.id)}
        onDragEnd={onDragEnd}
      >
        ⋮⋮
      </button>
      <button
        className="flex-1 text-left min-w-0"
        title={`${operation.method} ${operation.path}`}
        onClick={() => {
          onSelectFolder(folderId)
          onSelectOperation(key, folderId)
        }}
      >
        <span className={`font-mono text-xs font-semibold mr-2 ${methodColour(operation.method)}`}>
          {operation.method}
        </span>
        <span className="inline-block max-w-full align-middle truncate text-sm text-slate-200">{operation.path}</span>
      </button>
      <button
        className="hidden group-hover:flex items-center text-slate-500 hover:text-red-400 shrink-0 px-0.5"
        title="Delete request"
        onClick={(event) => {
          event.stopPropagation()
          onDeleteOperation(operation, folderId)
        }}
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
  )
}

function FolderRow({
  folder,
  depth,
  selectedFolderId,
  selectedOperationKey,
  onSelectFolder,
  onSelectOperation,
  onDeleteOperation,
  draggingOperationId,
  onDropOperation,
  onOperationDragStart,
  onOperationDragEnd,
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
  selectedOperationKey: string | null
  onSelectFolder: (folderId: string | null) => void
  onSelectOperation: (operationKey: string, folderId: string | null) => void
  onDeleteOperation: (operation: OperationRef, folderId: string | null) => void
  draggingOperationId: string | null
  onDropOperation: (operationId: string, folderId: string | null) => void
  onOperationDragStart: (operationId: string) => void
  onOperationDragEnd: () => void
  draggingFolderId: string | null
  onFolderDragStart: (folderId: string) => void
  onFolderDragEnd: () => void
  onDropFolder: (folderId: string, targetParentId: string | null) => void
  hoveredDropTarget: string | null
  setHoveredDropTarget: (target: string | null) => void
  onRenameFolder: (folderId: string, currentName: string) => void
  onDeleteFolder: (folderId: string) => void
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
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
        className={`flex items-center gap-1 rounded-md px-2.5 py-2 text-sm border transition-colors ${
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
        <button
          className="flex-1 text-left min-w-0"
          title={folder.name}
          onClick={() => onSelectFolder(folder.id)}
        >
          <span className="inline-block max-w-[78%] truncate align-middle">{folder.name}</span>
          <span className="ml-1 text-slate-500">({count})</span>
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

      {open ? (
        <div className="mt-1.5 flex flex-col gap-1">
          {folder.operations.map((operation) => (
            <OperationRow
              key={operation.id}
              operation={operation}
              depth={depth + 1}
              folderId={folder.id}
              selectedOperationKey={selectedOperationKey}
              onSelectOperation={onSelectOperation}
              onSelectFolder={onSelectFolder}
              onDeleteOperation={onDeleteOperation}
              onDragStart={onOperationDragStart}
              onDragEnd={onOperationDragEnd}
            />
          ))}
          {folder.children.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              selectedOperationKey={selectedOperationKey}
              onSelectFolder={onSelectFolder}
              onSelectOperation={onSelectOperation}
              onDeleteOperation={onDeleteOperation}
              draggingOperationId={draggingOperationId}
              onDropOperation={onDropOperation}
              onOperationDragStart={onOperationDragStart}
              onOperationDragEnd={onOperationDragEnd}
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
        </div>
      ) : null}
    </div>
  )
}

export function EndpointTree({
  structure,
  selectedFolderId,
  selectedOperationKey,
  onSelectFolder,
  onSelectOperation,
  onDeleteOperation,
  schemasFolderId,
  schemas,
  selectedSchemaId,
  onSelectSchema,
  onCreateSchema,
  onDeleteSchema,
  schemaCount,
  draggingOperationId,
  onDropOperation,
  onOperationDragStart,
  onOperationDragEnd,
  draggingFolderId,
  onFolderDragStart,
  onFolderDragEnd,
  onDropFolder,
  onRenameFolder,
  onDeleteFolder
}: Props): React.JSX.Element {
  const [hoveredDropTarget, setHoveredDropTarget] = React.useState<string | null>(null)
  const [schemasOpen, setSchemasOpen] = React.useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      {structure.rootFolder.children.map((child) => (
        <FolderRow
          key={child.id}
          folder={child}
          depth={0}
          selectedFolderId={selectedFolderId}
          selectedOperationKey={selectedOperationKey}
          onSelectFolder={onSelectFolder}
          onSelectOperation={onSelectOperation}
          onDeleteOperation={onDeleteOperation}
          draggingOperationId={draggingOperationId}
          onDropOperation={onDropOperation}
          onOperationDragStart={onOperationDragStart}
          onOperationDragEnd={onOperationDragEnd}
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
        className={`mt-1 rounded-md px-2.5 py-2 text-sm border transition-colors ${
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
        <button className="w-full text-left truncate" title="Unsorted" onClick={() => onSelectFolder(null)}>
          Unsorted <span className="text-slate-500">({structure.ungrouped.length})</span>
        </button>
      </div>

      {selectedFolderId === null ? (
        <div className="flex flex-col gap-1">
          {structure.ungrouped.map((operation) => (
            <OperationRow
              key={operation.id}
              operation={operation}
              depth={1}
              folderId={null}
              selectedOperationKey={selectedOperationKey}
              onSelectOperation={onSelectOperation}
              onSelectFolder={onSelectFolder}
              onDeleteOperation={onDeleteOperation}
              onDragStart={onOperationDragStart}
              onDragEnd={onOperationDragEnd}
            />
          ))}
        </div>
      ) : null}

      <div
        className={`rounded-md px-2.5 py-2 text-sm border transition-colors ${
          selectedFolderId === schemasFolderId
            ? 'bg-primary/15 border-primary/35 text-slate-100'
            : 'border-transparent text-slate-300 hover:bg-surface-raised'
        }`}
      >
        <div className="flex items-center gap-1">
          <button
            className="text-slate-500 hover:text-slate-300 shrink-0"
            onClick={() => setSchemasOpen((value) => !value)}
            title={schemasOpen ? 'Collapse folder' : 'Expand folder'}
          >
            {schemasOpen ? '▾' : '▸'}
          </button>
          <button className="flex-1 text-left truncate" title="Schemas" onClick={() => onSelectFolder(schemasFolderId)}>
            Schemas <span className="text-slate-500">({schemaCount})</span>
          </button>
          <button
            className="inline-flex items-center justify-center rounded border border-surface-border px-1.5 py-1 text-slate-400 hover:text-slate-100 hover:bg-surface-raised transition-colors"
            title="New Schema"
            aria-label="New Schema"
            onClick={onCreateSchema}
          >
            +
          </button>
        </div>
      </div>

      {schemasOpen ? (
        <div className="flex flex-col gap-1">
          {schemas.map((schema) => (
            <div
              key={schema.id}
              className={`group ml-[14px] flex items-center gap-1 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
                selectedFolderId === schemasFolderId && selectedSchemaId === schema.id
                  ? 'bg-primary/15 border-primary/35 text-slate-100'
                  : 'border-transparent text-slate-300 hover:bg-surface-raised'
              }`}
            >
              <button
                className="flex-1 min-w-0 text-left"
                title={schema.name}
                onClick={() => {
                  onSelectFolder(schemasFolderId)
                  onSelectSchema(schema.id)
                }}
              >
                <span className="inline-block max-w-[80%] truncate font-mono align-middle">{schema.name}</span>
                <span className="ml-2 rounded border border-surface-border bg-surface-lower px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                  {usageTagLabel(schema.usageTag)}
                </span>
              </button>
              <button
                className="hidden group-hover:flex items-center text-slate-500 hover:text-red-400 shrink-0 px-0.5"
                title="Delete schema"
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteSchema(schema.id)
                }}
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
          ))}
          {schemas.length === 0 ? (
            <p className="ml-[14px] px-2.5 py-1 text-xs text-slate-500">No schemas yet.</p>
          ) : null}
        </div>
      ) : null}

      {draggingFolderId ? (
        <div
          className={`rounded-md px-2.5 py-2 text-sm border transition-colors ${
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
        <p className="px-2 text-sm text-slate-500">No operations found.</p>
      ) : null}
    </div>
  )
}
