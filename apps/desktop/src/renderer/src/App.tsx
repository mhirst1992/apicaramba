import React from 'react'

export default function App(): React.JSX.Element {
  return (
    <div className="flex h-full bg-[#0f1117] text-slate-100">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col bg-[#161b22] border-r border-[#21262d]">
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-[#21262d] shrink-0">
          <ApiIcon />
          <span className="text-sm font-semibold tracking-tight text-slate-100">
            APICaramba
          </span>
        </div>
        <div className="flex-1 flex flex-col items-start px-3 pt-4 gap-1">
          <SidebarPlaceholder />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center text-center gap-5 max-w-[460px] px-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
            <WorkspaceIcon />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Open a workspace
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              A workspace is a Git repository containing your API definitions.
              Clone a repo locally, then open it here.
            </p>
          </div>
          <button
            className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            onClick={() => {
              // TODO Phase 1: trigger folder dialog and open workspace
            }}
          >
            Open Workspace
          </button>
          <p className="text-xs text-slate-600">
            Git must be installed on your system.
          </p>
        </div>
      </main>
    </div>
  )
}

function ApiIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="text-indigo-400 shrink-0"
    >
      <rect x="1" y="1" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 9h8M9 5v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function WorkspaceIcon(): React.JSX.Element {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="text-indigo-400"
    >
      <path
        d="M4 8a4 4 0 014-4h16a4 4 0 014 4v16a4 4 0 01-4 4H8a4 4 0 01-4-4V8z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10 16h12M16 10v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SidebarPlaceholder(): React.JSX.Element {
  return (
    <div className="w-full space-y-1" aria-hidden="true">
      {[80, 60, 70].map((w, i) => (
        <div
          key={i}
          className="h-5 rounded bg-[#21262d] animate-pulse"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  )
}
