import React from 'react'
import type {
  OperationDetail,
  Environment,
  EnvironmentParameter,
  ExecuteRequestRequest,
  ExecuteRequestResult,
  RequestHeader
} from '@apicaramba/shared-types'

interface Props {
  operation: OperationDetail
  environment: Environment | null
  onExecute: (request: ExecuteRequestRequest) => Promise<ExecuteRequestResult>
}

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH'])

/** Substitute {{VAR_NAME}} tokens using environment variables. */
function substituteVars(text: string, vars: { name: string; value: string }[]): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, name: string) => {
    const v = vars.find((x) => x.name === name.trim())
    return v ? v.value : _match
  })
}

function buildUrl(baseUrl: string, path: string, vars: { name: string; value: string }[]): string {
  const base = substituteVars(baseUrl.replace(/\/$/, ''), vars)
  const p = substituteVars(path, vars)
  return base + p
}

function applyPathParameters(url: string, values: Record<string, string>): string {
  return url.replace(/\{([^}]+)\}/g, (match, name: string) => {
    const key = name.trim()
    const value = values[key]
    if (!value) return match
    return encodeURIComponent(value)
  })
}

function applyQueryParameters(url: string, values: Record<string, string>): string {
  const [base, query = ''] = url.split('?')
  const searchParams = new URLSearchParams(query)

  for (const [key, value] of Object.entries(values)) {
    searchParams.set(key, value)
  }

  const nextQuery = searchParams.toString()
  return nextQuery ? `${base}?${nextQuery}` : base
}

const STATUS_COLOUR: Record<number, string> = {}
function statusColour(code: number): string {
  if (STATUS_COLOUR[code]) return STATUS_COLOUR[code]
  if (code >= 200 && code < 300) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  if (code >= 300 && code < 400) return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  if (code >= 400 && code < 500) return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  return 'bg-red-500/20 text-red-300 border-red-500/30'
}

function tryPrettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function RequestRunner({ operation, environment, onExecute }: Props): React.JSX.Element {
  const vars = environment?.variables.filter((v) => !v.isSecret) ?? []
  const baseUrl = environment?.baseUrl ?? ''
  const baseResolvedUrl = buildUrl(baseUrl, operation.path, vars)
  const availableParameters = environment?.parameters ?? []
  const operationParameters = React.useMemo(
    () => operation.parameterIds
      .map((parameterId) => availableParameters.find((parameter) => parameter.id === parameterId) ?? null)
      .filter((parameter): parameter is EnvironmentParameter => parameter !== null),
    [availableParameters, operation.parameterIds]
  )

  const [headers, setHeaders] = React.useState<RequestHeader[]>([{ key: '', value: '' }])
  const [parameterValues, setParameterValues] = React.useState<Record<string, string>>({})
  const [body, setBody] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [response, setResponse] = React.useState<ExecuteRequestResult | null>(null)
  const [showResHeaders, setShowResHeaders] = React.useState(false)

  const hasBody = METHODS_WITH_BODY.has(operation.method)

  const categorizedValues = React.useMemo(() => {
    const pathValues: Record<string, string> = {}
    const queryValues: Record<string, string> = {}
    const headerValues: Record<string, string> = {}
    const cookieValues: Record<string, string> = {}
    const missingRequired: EnvironmentParameter[] = []

    for (const parameter of operationParameters) {
      const rawValue = parameterValues[parameter.id] ?? ''
      const value = substituteVars(rawValue, vars).trim()

      if (!value && parameter.required) {
        missingRequired.push(parameter)
        continue
      }

      if (!value) continue

      if (parameter.in === 'path') pathValues[parameter.name] = value
      if (parameter.in === 'query') queryValues[parameter.name] = value
      if (parameter.in === 'header') headerValues[parameter.name] = value
      if (parameter.in === 'cookie') cookieValues[parameter.name] = value
    }

    return { pathValues, queryValues, headerValues, cookieValues, missingRequired }
  }, [operationParameters, parameterValues, vars])

  const resolvedUrl = React.useMemo(() => {
    const withPath = applyPathParameters(baseResolvedUrl, categorizedValues.pathValues)
    return applyQueryParameters(withPath, categorizedValues.queryValues)
  }, [baseResolvedUrl, categorizedValues.pathValues, categorizedValues.queryValues])

  function addHeader(): void {
    setHeaders((h) => [...h, { key: '', value: '' }])
  }

  function removeHeader(index: number): void {
    setHeaders((h) => h.filter((_, i) => i !== index))
  }

  function updateHeader(index: number, field: 'key' | 'value', val: string): void {
    setHeaders((h) => h.map((row, i) => (i === index ? { ...row, [field]: val } : row)))
  }

  function updateParameterValue(parameterId: string, value: string): void {
    setParameterValues((current) => ({ ...current, [parameterId]: value }))
  }

  async function send(): Promise<void> {
    if (categorizedValues.missingRequired.length > 0) {
      return
    }

    setLoading(true)
    setResponse(null)
    const allHeaders = headers.map((h) => ({
      key: substituteVars(h.key, vars),
      value: substituteVars(h.value, vars)
    }))

    for (const [headerName, value] of Object.entries(categorizedValues.headerValues)) {
      allHeaders.push({ key: headerName, value })
    }

    const cookieEntries = Object.entries(categorizedValues.cookieValues)
    if (cookieEntries.length > 0) {
      const cookieValue = cookieEntries.map(([key, value]) => `${key}=${value}`).join('; ')
      const existingCookie = allHeaders.find((header) => header.key.toLowerCase() === 'cookie')
      if (existingCookie) {
        existingCookie.value = `${existingCookie.value}; ${cookieValue}`
      } else {
        allHeaders.push({ key: 'Cookie', value: cookieValue })
      }
    }

    const result = await onExecute({
      method: operation.method,
      url: resolvedUrl,
      headers: allHeaders,
      body: hasBody && body.trim() ? body : null
    })
    setResponse(result)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* URL bar */}
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 font-mono font-bold text-sm ${
            {
              GET: 'text-primary',
              POST: 'text-accent',
              PUT: 'text-blue-400',
              PATCH: 'text-purple-400',
              DELETE: 'text-secondary',
              HEAD: 'text-slate-400',
              OPTIONS: 'text-slate-400',
              TRACE: 'text-slate-400'
            }[operation.method] ?? 'text-slate-300'
          }`}
        >
          {operation.method}
        </span>
        <div className="flex-1 rounded-lg border border-surface-border bg-surface-lower px-3 py-1.5 font-mono text-xs text-slate-300 truncate">
          {resolvedUrl || <span className="text-slate-500">No base URL configured in environment</span>}
        </div>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-40 transition-colors"
          disabled={loading || !resolvedUrl || categorizedValues.missingRequired.length > 0}
          onClick={() => { void send() }}
        >
          {loading ? (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 2.5l10 5.5-10 5.5V2.5z" />
            </svg>
          )}
          {loading ? 'Sending…' : 'Send'}
        </button>
      </div>

      {operationParameters.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Parameters</span>
            <span className="text-xs text-slate-500">Defined in Environment</span>
          </div>
          <div className="rounded-lg border border-surface-border bg-surface-lower p-2.5 flex flex-col gap-1.5">
            {operationParameters.map((parameter) => (
              <label key={parameter.id} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-slate-500 font-mono">{parameter.in}</span>
                <span className="w-40 shrink-0 text-slate-200 font-mono truncate">{parameter.name}</span>
                <input
                  className="flex-1 min-w-0 rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/50"
                  placeholder={parameter.required ? 'Required' : 'Optional'}
                  value={parameterValues[parameter.id] ?? ''}
                  onChange={(event) => updateParameterValue(parameter.id, event.target.value)}
                />
              </label>
            ))}
          </div>
          {categorizedValues.missingRequired.length > 0 ? (
            <p className="mt-2 text-xs text-amber-300">
              Required parameters missing: {categorizedValues.missingRequired.map((parameter) => `${parameter.in}/${parameter.name}`).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Headers editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Headers</span>
          <button
            className="text-xs text-primary hover:text-primary/80 transition-colors"
            onClick={addHeader}
          >
            + Add
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {headers.map((row, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                className="flex-1 min-w-0 rounded border border-surface-border bg-surface-lower px-2 py-1 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary/50"
                placeholder="Key"
                value={row.key}
                onChange={(e) => updateHeader(idx, 'key', e.target.value)}
              />
              <input
                className="flex-1 min-w-0 rounded border border-surface-border bg-surface-lower px-2 py-1 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary/50"
                placeholder="Value"
                value={row.value}
                onChange={(e) => updateHeader(idx, 'value', e.target.value)}
              />
              <button
                className="shrink-0 text-slate-600 hover:text-secondary transition-colors px-1"
                onClick={() => removeHeader(idx)}
                disabled={headers.length === 1}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Body editor (only for POST/PUT/PATCH) */}
      {hasBody ? (
        <div>
          <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Body</span>
          <textarea
            className="w-full rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary/50 resize-none"
            placeholder='{"key": "value"}'
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      ) : null}

      {/* Response panel */}
      {response ? (
        <div className="rounded-xl border border-surface-border bg-surface-lower overflow-hidden">
          {response.status === 'network-error' ? (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-red-400">Network Error</p>
              <p className="mt-1 text-xs text-slate-400 font-mono">{response.message}</p>
            </div>
          ) : (
            <>
              {/* Status bar */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-border">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-mono font-medium ${statusColour(response.statusCode)}`}
                >
                  {response.statusCode} {response.statusText}
                </span>
                <span className="text-xs text-slate-500">{response.durationMs} ms</span>
                <button
                  className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => setShowResHeaders((v) => !v)}
                >
                  {showResHeaders ? 'Hide headers' : 'Show headers'}
                </button>
              </div>

              {/* Response headers */}
              {showResHeaders ? (
                <div className="px-4 py-2 border-b border-surface-border max-h-40 overflow-y-auto">
                  {response.headers.map((h, i) => (
                    <div key={i} className="flex gap-2 text-xs font-mono">
                      <span className="text-slate-400 shrink-0">{h.key}:</span>
                      <span className="text-slate-300 break-all">{h.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Response body */}
              <pre className="px-4 py-3 text-xs font-mono text-slate-200 whitespace-pre-wrap break-all max-h-96 overflow-y-auto leading-relaxed">
                {tryPrettyJson(response.body) || <span className="text-slate-500">(empty body)</span>}
              </pre>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
