import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateOpenApiDocument } from './index.js'

describe('validateOpenApiDocument', () => {
  it('returns valid for structurally valid OpenAPI 3.x documents', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-validation-valid-'))
    const apiDir = path.join(tempRoot, 'apis', 'demo')
    const openapiPath = path.join(apiDir, 'openapi.json')

    const validDoc = {
      openapi: '3.0.3',
      info: {
        title: 'Demo API',
        version: '1.0.0'
      },
      paths: {
        '/ping': {
          get: {
            responses: {
              '200': {
                description: 'ok'
              }
            }
          }
        }
      }
    }

    try {
      await mkdir(apiDir, { recursive: true })
      await writeFile(openapiPath, JSON.stringify(validDoc, null, 2), 'utf8')

      const result = await validateOpenApiDocument({
        workspaceRootPath: tempRoot,
        openapiRelativePath: 'apis/demo/openapi.json'
      })

      expect(result.status).toBe('valid')
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('returns invalid for structurally invalid OpenAPI 3.x documents', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-validation-invalid-'))
    const apiDir = path.join(tempRoot, 'apis', 'demo')
    const openapiPath = path.join(apiDir, 'openapi.json')

    const invalidDoc = {
      openapi: '3.0.3',
      info: {
        title: 'Broken API',
        version: '1.0.0'
      },
      paths: {
        '/ping': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    try {
      await mkdir(apiDir, { recursive: true })
      await writeFile(openapiPath, JSON.stringify(invalidDoc, null, 2), 'utf8')

      const result = await validateOpenApiDocument({
        workspaceRootPath: tempRoot,
        openapiRelativePath: 'apis/demo/openapi.json'
      })

      expect(result.status).toBe('invalid')
      if (result.status === 'invalid') {
        expect(result.issueCount).toBeGreaterThan(0)
      }
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})
