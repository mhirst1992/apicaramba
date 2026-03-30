import React from 'react'
import type { ApiSummary } from '@apicaramba/shared-types'

export function ApiDropdownCard({
  api,
  isSelected,
  isMenuOpen,
  onToggleMenu,
  onSelect,
  onEnvironment,
  onNewFolder,
  onNewRequest,
  onDeleteApi
}: {
  api: ApiSummary
  isSelected: boolean
  isMenuOpen: boolean
  onToggleMenu: () => void
  onSelect: () => void
  onEnvironment: () => void
  onNewFolder: () => void
  onNewRequest: () => void
  onDeleteApi: () => void
}): React.JSX.Element {
  return (
    <div className={`rounded-lg border ${isSelected ? 'border-primary/35 bg-primary/10' : 'border-surface-border bg-surface-base'}`}>
      <div className="flex items-center gap-1 px-2.5 py-2">
        <button className="flex-1 text-left min-w-0" onClick={onSelect}>
          <div className="text-sm font-medium truncate">{api.name}</div>
          <div className="text-xs text-slate-500 truncate">{api.operationCount} operations</div>
        </button>
        <button
          className="text-slate-400 hover:text-slate-100 rounded px-1 shrink-0"
          onClick={onNewFolder}
          title="New Folder"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            <line x1="12" y1="11" x2="12" y2="17"/>
            <line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
        </button>
        <button
          className="text-slate-400 hover:text-slate-100 rounded px-1 shrink-0"
          onClick={onNewRequest}
          title="New Request"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </button>
        <button
          className="text-slate-400 hover:text-slate-100 rounded px-1 shrink-0"
          onClick={onToggleMenu}
          title="API actions"
        >
          ...
        </button>
      </div>

      {isMenuOpen ? (
        <div className="px-2.5 pb-2 flex flex-col gap-1">
          <button className="text-left text-xs px-2 py-1 rounded hover:bg-surface-raised" onClick={onEnvironment}>Environment</button>
          <button className="text-left text-xs px-2 py-1 rounded hover:bg-surface-raised" onClick={onNewFolder}>New Folder</button>
          <button className="text-left text-xs px-2 py-1 rounded hover:bg-surface-raised" onClick={onNewRequest}>New Request</button>
          <button className="text-left text-xs px-2 py-1 rounded text-red-300 hover:bg-secondary/10" onClick={onDeleteApi}>Delete API</button>
        </div>
      ) : null}
    </div>
  )
}
