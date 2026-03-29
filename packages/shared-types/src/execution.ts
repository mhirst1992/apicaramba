import type { HttpMethod } from './api.js'

export interface RequestHeader {
  key: string
  value: string
}

export interface ExecuteRequestRequest {
  method: HttpMethod
  url: string
  headers: RequestHeader[]
  /** Raw request body. Null for methods that don't carry a body. */
  body: string | null
}

export type ExecuteRequestResult =
  | {
      status: 'success'
      statusCode: number
      statusText: string
      headers: RequestHeader[]
      body: string
      durationMs: number
    }
  | { status: 'network-error'; message: string }
