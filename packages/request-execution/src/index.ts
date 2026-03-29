import type { ExecuteRequestRequest, ExecuteRequestResult, RequestHeader } from '@apicaramba/shared-types'

/**
 * Execute an HTTP request and return a structured result.
 * Runs in the Electron main process where there are no CORS restrictions.
 */
export async function executeRequest(
  request: ExecuteRequestRequest
): Promise<ExecuteRequestResult> {
  const headersInit: Record<string, string> = {}
  for (const h of request.headers) {
    if (h.key.trim()) {
      headersInit[h.key.trim()] = h.value
    }
  }

  const start = Date.now()

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: headersInit,
      body: request.body ?? undefined
    })

    const body = await response.text()
    const durationMs = Date.now() - start

    const headers: RequestHeader[] = []
    response.headers.forEach((value, key) => {
      headers.push({ key, value })
    })

    return {
      status: 'success',
      statusCode: response.status,
      statusText: response.statusText,
      headers,
      body,
      durationMs
    }
  } catch (error) {
    return {
      status: 'network-error',
      message: error instanceof Error ? error.message : 'Network error'
    }
  }
}
