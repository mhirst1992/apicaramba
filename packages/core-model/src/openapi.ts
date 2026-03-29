import swagger2openapi from 'swagger2openapi'
import YAML from 'yaml'

export interface OpenApiInfo {
  title?: unknown
  version?: unknown
}

export interface OpenApiOperation {
  operationId?: unknown
  summary?: unknown
  description?: unknown
  tags?: unknown
}

export interface OpenApiDocument {
  openapi?: unknown
  swagger?: unknown
  definitions?: unknown
  securityDefinitions?: unknown
  schemes?: unknown
  consumes?: unknown
  produces?: unknown
  info?: OpenApiInfo
  paths?: Record<string, Record<string, OpenApiOperation> | undefined>
}

interface SwaggerConversionResult {
  openapi: unknown
}

interface Swagger2OpenApiConverter {
  convertObj: (
    source: unknown,
    options: {
      patch?: boolean
      warnOnly?: boolean
      resolve?: boolean
    }
  ) => Promise<SwaggerConversionResult>
}

const swaggerConverter = swagger2openapi as unknown as Swagger2OpenApiConverter

export function parseOpenApiSource(raw: string): OpenApiDocument {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    parsed = YAML.parse(raw) as unknown
  }

  if (!isObject(parsed)) {
    throw new Error('OpenAPI source must be a JSON or YAML object.')
  }

  return parsed as OpenApiDocument
}

export async function parseAndNormalizeOpenApiSource(raw: string): Promise<OpenApiDocument | null> {
  const parsed = parseOpenApiSource(raw)
  return normalizeToOpenApi3(parsed)
}

export async function normalizeToOpenApi3(
  document: OpenApiDocument
): Promise<OpenApiDocument | null> {
  const openapiVersion = typeof document.openapi === 'string' ? document.openapi : ''
  if (openapiVersion.startsWith('3.')) {
    return document
  }

  const swaggerVersion = typeof document.swagger === 'string' ? document.swagger : ''
  if (swaggerVersion.length === 0) {
    return null
  }

  const sourceForConversion = coerceSwaggerVersionForConversion(document)

  try {
    const converted = await swaggerConverter.convertObj(sourceForConversion, {
      patch: true,
      warnOnly: true,
      resolve: false
    })

    if (!isObject(converted.openapi)) {
      return null
    }

    return converted.openapi as OpenApiDocument
  } catch {
    return null
  }
}

function coerceSwaggerVersionForConversion(document: OpenApiDocument): OpenApiDocument {
  const swaggerVersion = typeof document.swagger === 'string' ? document.swagger : ''
  if (!swaggerVersion.startsWith('3.')) {
    return document
  }

  const looksLikeSwagger2 =
    document.definitions !== undefined ||
    document.securityDefinitions !== undefined ||
    document.schemes !== undefined ||
    document.consumes !== undefined ||
    document.produces !== undefined

  if (!looksLikeSwagger2) {
    return document
  }

  return {
    ...document,
    swagger: '2.0'
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}