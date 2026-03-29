import React from 'react'
import type {
  OperationDetail,
  Environment,
  EnvironmentParameter,
  RequestCustomParameter,
  ExecuteRequestRequest,
  ExecuteRequestResult,
  SchemaDetail,
  SchemaPropertyDetail
} from '@apicaramba/shared-types'

interface Props {
  operation: OperationDetail
  environment: Environment | null
  schemas: SchemaDetail[]
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

function formatJsonForDisplay(raw: string): { text: string; isJson: boolean } {
  if (raw.trim() === '') {
    return { text: '', isJson: true }
  }

  try {
    return {
      text: JSON.stringify(JSON.parse(raw), null, 2),
      isJson: true
    }
  } catch {
    return { text: raw, isJson: false }
  }
}

function positionToLineColumn(text: string, position: number): { line: number; column: number } {
  const safePosition = Math.max(0, Math.min(position, text.length))
  const before = text.slice(0, safePosition)
  const lines = before.split('\n')
  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length ?? 0) + 1
  }
}

function validateJson(raw: string): { valid: true } | { valid: false; message: string; line?: number; column?: number } {
  if (raw.trim() === '') {
    return { valid: true }
  }

  try {
    JSON.parse(raw)
    return { valid: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON.'
    const match = message.match(/position\s+(\d+)/i)
    if (!match) {
      return { valid: false, message }
    }

    const position = Number(match[1])
    const location = positionToLineColumn(raw, Number.isFinite(position) ? position : 0)
    return {
      valid: false,
      message,
      line: location.line,
      column: location.column
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function syntaxHighlightJson(raw: string, placeholderPreview = '{"key": "value"}'): string {
  if (raw.length === 0) {
    return `<span style="color:#64748B;-webkit-user-select:text;user-select:text;">${escapeHtml(placeholderPreview)}</span>`
  }

  const tokenPattern = /"(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"\s*:|"(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g
  let highlighted = ''
  let lastIndex = 0

  for (const match of raw.matchAll(tokenPattern)) {
    const token = match[0]
    const start = match.index ?? 0
    highlighted += escapeHtml(raw.slice(lastIndex, start))

    let color = '#E2E8F0'
    if (token.endsWith(':')) {
      color = '#93C5FD'
    } else if (token.startsWith('"')) {
      color = '#86EFAC'
    } else if (token === 'true' || token === 'false') {
      color = '#FACC15'
    } else if (token === 'null') {
      color = '#FCA5A5'
    } else {
      color = '#F9A8D4'
    }

    highlighted += `<span style="color:${color};-webkit-user-select:text;user-select:text;">${escapeHtml(token)}</span>`
    lastIndex = start + token.length
  }

  highlighted += escapeHtml(raw.slice(lastIndex))
  return highlighted
}

interface JsonCodePanelProps {
  sectionLabel: string
  value: string
  onChange?: (nextValue: string) => void
  statusLabel?: string
  statusClassName?: string
  subStatusMessage?: string | null
  placeholder?: string
  placeholderPreview?: string
  readOnly?: boolean
}

function JsonCodePanel({
  sectionLabel,
  value,
  onChange,
  statusLabel,
  statusClassName = 'text-slate-400',
  subStatusMessage,
  placeholder = '{"key": "value"}',
  placeholderPreview = '{"key": "value"}',
  readOnly = false
}: JsonCodePanelProps): React.JSX.Element {
  const [scrollTop, setScrollTop] = React.useState(0)
  const [scrollLeft, setScrollLeft] = React.useState(0)

  const lineCount = React.useMemo(() => Math.max(1, value.split('\n').length), [value])
  const highlightedValue = React.useMemo(
    () => syntaxHighlightJson(value, placeholderPreview),
    [value, placeholderPreview]
  )

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">{sectionLabel}</span>
        {statusLabel ? (
          <span className={`text-xs font-medium ${statusClassName}`}>{statusLabel}</span>
        ) : null}
      </div>
      <div className="rounded-xl border border-surface-border bg-surface-lower">
        <div className="flex items-center justify-between border-b border-surface-border bg-surface-base/60 px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">application/json</span>
          {subStatusMessage ? <span className="text-xs text-slate-400">{subStatusMessage}</span> : null}
        </div>
        <div className="flex h-[18rem] min-h-[18rem] resize-y items-stretch overflow-hidden">
          <div className="w-14 shrink-0 overflow-hidden border-r border-surface-border bg-surface-base/40 px-2 py-3 text-right font-mono text-xs leading-6 text-slate-500 select-none">
            <div style={{ transform: `translateY(-${scrollTop}px)` }}>
              {Array.from({ length: lineCount }, (_, index) => (
                <div key={index + 1} className="h-6">{index + 1}</div>
              ))}
            </div>
          </div>
          <div className="relative flex-1 min-w-0 overflow-hidden">
            {readOnly ? (
              <div
                className="relative z-10 h-full w-full overflow-auto"
                onScroll={(event) => {
                  setScrollTop(event.currentTarget.scrollTop)
                  setScrollLeft(event.currentTarget.scrollLeft)
                }}
              >
                <pre
                  className="m-0 px-3 py-3 font-mono text-sm leading-6 whitespace-pre select-text"
                  dangerouslySetInnerHTML={{ __html: `${highlightedValue}\n` }}
                />
              </div>
            ) : (
              <>
                <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
                  <pre
                    className="m-0 px-3 py-3 font-mono text-sm leading-6 whitespace-pre"
                    style={{ transform: `translate(${-scrollLeft}px, -${scrollTop}px)` }}
                    dangerouslySetInnerHTML={{ __html: `${highlightedValue}\n` }}
                  />
                </div>
                <textarea
                  className="relative z-10 block h-full w-full resize-none overflow-auto bg-transparent px-3 py-3 font-mono text-sm leading-6 text-transparent caret-slate-100 focus:outline-none"
                  placeholder={placeholder}
                  spellCheck={false}
                  wrap="off"
                  value={value}
                  onChange={(event) => onChange?.(event.target.value)}
                  onScroll={(event) => {
                    setScrollTop(event.currentTarget.scrollTop)
                    setScrollLeft(event.currentTarget.scrollLeft)
                  }}
                  style={{
                    WebkitTextFillColor: 'transparent'
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function defaultValueForPrimitive(type: SchemaPropertyDetail['type'] | SchemaPropertyDetail['arrayItemType']): unknown {
  if (type === 'number' || type === 'integer') return 0
  if (type === 'boolean') return false
  return ''
}

function buildExampleFromSchemaName(
  schemaName: string,
  schemasByName: Map<string, SchemaDetail>,
  visiting: Set<string>
): unknown {
  const schema = schemasByName.get(schemaName)
  if (!schema) {
    return {}
  }

  if (visiting.has(schemaName)) {
    return {}
  }

  visiting.add(schemaName)

  const result: Record<string, unknown> = {}
  for (const property of schema.properties) {
    result[property.name] = buildExampleForProperty(property, schemasByName, visiting)
  }

  visiting.delete(schemaName)
  return result
}

function buildExampleForProperty(
  property: SchemaPropertyDetail,
  schemasByName: Map<string, SchemaDetail>,
  visiting: Set<string>
): unknown {
  if (property.type === 'array') {
    if (property.arrayItemSchemaName) {
      return [buildExampleFromSchemaName(property.arrayItemSchemaName, schemasByName, visiting)]
    }

    return [defaultValueForPrimitive(property.arrayItemType ?? 'string')]
  }

  if (property.type === 'object') {
    if (property.objectSchemaName) {
      return buildExampleFromSchemaName(property.objectSchemaName, schemasByName, visiting)
    }

    return {}
  }

  return defaultValueForPrimitive(property.type)
}

function buildInitialBody(operation: OperationDetail, schemas: SchemaDetail[]): string {
  if (!METHODS_WITH_BODY.has(operation.method)) {
    return ''
  }

  const schemaName = operation.requestBodySchemaName.trim()
  if (!schemaName) {
    return ''
  }

  const schemasByName = new Map(schemas.map((schema) => [schema.name, schema]))
  const example = buildExampleFromSchemaName(schemaName, schemasByName, new Set<string>())
  return JSON.stringify(example, null, 2)
}

export function RequestRunner({ operation, environment, schemas, onExecute }: Props): React.JSX.Element {
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

  const customParameters: RequestCustomParameter[] = operation.customParameters ?? []
  const [parameterValues, setParameterValues] = React.useState<Record<string, string>>({})
  const [body, setBody] = React.useState(() => buildInitialBody(operation, schemas))
  const [loading, setLoading] = React.useState(false)
  const [response, setResponse] = React.useState<ExecuteRequestResult | null>(null)
  const [showResHeaders, setShowResHeaders] = React.useState(false)

  const hasBody = METHODS_WITH_BODY.has(operation.method)
  const bodyValidation = React.useMemo(() => validateJson(body), [body])
  const responseBody = React.useMemo(() => {
    if (!response || response.status === 'network-error') {
      return { text: '', isJson: true }
    }

    return formatJsonForDisplay(response.body)
  }, [response])

  const categorizedValues = React.useMemo(() => {
    const pathValues: Record<string, string> = {}
    const queryValues: Record<string, string> = {}
    const headerValues: Record<string, string> = {}
    const cookieValues: Record<string, string> = {}
    const missingRequired: (EnvironmentParameter | RequestCustomParameter)[] = []

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

    for (const parameter of customParameters) {
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
  }, [operationParameters, customParameters, parameterValues, vars])

  const resolvedUrl = React.useMemo(() => {
    const withPath = applyPathParameters(baseResolvedUrl, categorizedValues.pathValues)
    return applyQueryParameters(withPath, categorizedValues.queryValues)
  }, [baseResolvedUrl, categorizedValues.pathValues, categorizedValues.queryValues])

  function updateParameterValue(parameterId: string, value: string): void {
    setParameterValues((current) => ({ ...current, [parameterId]: value }))
  }

  async function send(): Promise<void> {
    if (categorizedValues.missingRequired.length > 0) {
      return
    }

    setLoading(true)
    setResponse(null)
    const allHeaders: { key: string; value: string }[] = []

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

      {customParameters.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-accent uppercase tracking-wider">Request Parameters</span>
            <span className="text-xs text-accent/60">Defined on this request</span>
          </div>
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-2.5 flex flex-col gap-1.5">
            {customParameters.map((parameter) => (
              <label key={parameter.id} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-accent/70 font-mono">{parameter.in}</span>
                <span className="w-40 shrink-0 text-slate-200 font-mono truncate">{parameter.name}</span>
                <input
                  className="flex-1 min-w-0 rounded border border-accent/30 bg-surface-base px-2 py-1 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent/50"
                  placeholder={parameter.required ? 'Required' : 'Optional'}
                  value={parameterValues[parameter.id] ?? ''}
                  onChange={(event) => updateParameterValue(parameter.id, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {/* Body editor (only for POST/PUT/PATCH) */}
      {hasBody ? (
        <JsonCodePanel
          sectionLabel="Body"
          value={body}
          onChange={setBody}
          statusLabel={bodyValidation.valid
            ? 'Valid JSON'
            : `Invalid JSON${bodyValidation.line && bodyValidation.column ? ` at ${bodyValidation.line}:${bodyValidation.column}` : ''}`}
          statusClassName={bodyValidation.valid ? 'text-emerald-300' : 'text-amber-300'}
          subStatusMessage={bodyValidation.valid ? null : bodyValidation.message}
          placeholder='{"key": "value"}'
          placeholderPreview='{"key": "value"}'
        />
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
              <div className="px-4 py-3">
                <JsonCodePanel
                  sectionLabel="Response JSON"
                  value={responseBody.text}
                  readOnly
                  statusLabel={responseBody.isJson ? 'Valid JSON' : 'Raw text'}
                  statusClassName={responseBody.isJson ? 'text-emerald-300' : 'text-slate-400'}
                  subStatusMessage={responseBody.isJson ? null : 'Response is not valid JSON; showing raw body.'}
                  placeholder='(empty body)'
                  placeholderPreview='(empty body)'
                />
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
