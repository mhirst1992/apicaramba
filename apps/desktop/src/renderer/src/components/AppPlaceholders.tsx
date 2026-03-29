import React from 'react'

export function EditorSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-7 w-48 rounded bg-surface-border animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-16 rounded bg-surface-border animate-pulse" />
        <div className="h-10 rounded bg-surface-border animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-20 rounded bg-surface-border animate-pulse" />
        <div className="h-28 rounded bg-surface-border animate-pulse" />
      </div>
    </div>
  )
}

export function SidebarPlaceholder(): React.JSX.Element {
  return (
    <div className="w-full space-y-1" aria-hidden="true">
      {[80, 60, 70].map((w, i) => (
        <div key={i} className="h-5 rounded bg-surface-border animate-pulse" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}
