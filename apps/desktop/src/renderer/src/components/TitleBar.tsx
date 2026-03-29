import React from 'react'

export function TitleBar({ workspaceName }: { workspaceName?: string }): React.JSX.Element {
  const [maximized, setMaximized] = React.useState(false)

  React.useEffect(() => {
    let mounted = true
    void window.appBridge.windowControls.isMaximized().then((m) => { if (mounted) setMaximized(m) })
    window.appBridge.windowControls.onMaximizeChange((m) => { if (mounted) setMaximized(m) })
    return () => { mounted = false }
  }, [])

  return (
    <div
      className="flex h-9 items-stretch shrink-0 bg-surface-lower border-b border-surface-border"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex items-center px-4 w-56 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <BrandLogo />
      </div>
      <div className="flex-1 flex items-center justify-center pointer-events-none">
        {workspaceName ? (
          <span className="text-xs text-slate-500 truncate max-w-[260px]">{workspaceName}</span>
        ) : null}
      </div>
      <div
        className="flex items-stretch"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <TitleBarButton onClick={() => window.appBridge.windowControls.minimize()} title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1" aria-hidden="true"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.5" /></svg>
        </TitleBarButton>
        <TitleBarButton
          onClick={() => { window.appBridge.windowControls.toggleMaximize() }}
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="2" y="0" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <rect x="0" y="2" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.5" className="fill-surface-lower" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="0.75" y="0.75" width="8.5" height="8.5" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          )}
        </TitleBarButton>
        <TitleBarButton onClick={() => window.appBridge.windowControls.close()} title="Close" isClose>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </TitleBarButton>
      </div>
    </div>
  )
}

function TitleBarButton({
  onClick, title, isClose = false, children
}: {
  onClick: () => void
  title: string
  isClose?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex items-center justify-center w-11 h-full text-slate-400 transition-colors ${isClose ? 'hover:bg-secondary hover:text-white' : 'hover:bg-surface-raised hover:text-slate-200'}`}
    >
      {children}
    </button>
  )
}

function BrandLogo(): React.JSX.Element {
  return (
    <span className="flex items-baseline font-mono text-sm font-bold leading-none" aria-label="APICaramba">
      <span className="text-accent mr-1.5">{'>'}</span>
      <span className="text-accent">{'{'}</span>
      <span className="text-primary">api</span>
      <span className="text-accent">{':'}</span>
      <span className="text-secondary">caramba</span>
      <span className="text-accent">{'}'}</span>
    </span>
  )
}
