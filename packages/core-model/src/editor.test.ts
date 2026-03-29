import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadApiEditor, buildUpdatedDocument, saveStructure } from './editor.js'

const MINIMAL_OPENAPI = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/items': {
      get: {
        operationId: 'listItems',
        summary: 'List items',
        description: 'Returns all items',
        tags: ['items'],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListItemsResponse'
                }
              }
            }
          }
        }
      },
      post: {
        operationId: 'createItem',
        summary: 'Create item',
        description: '',
        tags: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateItemRequest'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateItemResponse'
                }
              }
            }
          }
        }
      }
    },
    '/items/{id}': {
      get: {
        operationId: 'getItem',
        summary: '',
        description: '',
        parameters: [{ name: 'id', in: 'path', required: true }],
        tags: [],
        responses: { '200': { description: 'Success' } }
      }
    }
  },
  components: {
    schemas: {
      CreateItemRequest: {
        'x-apicaramba-usage-tag': 'Rqst',
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Item name' }
        },
        required: ['name']
      },
      ListItemsResponse: {
        'x-apicaramba-usage-tag': 'Resp',
        type: 'object',
        properties: {
          items: { type: 'array' }
        }
      },
      CreateItemResponse: {
        'x-apicaramba-usage-tag': 'Resp',
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }
})

const MINIMAL_OPENAPI_YAML = `openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /items:
    get:
      operationId: listItems
      summary: List items
      description: Returns all items
      tags:
        - items
      responses:
        '200':
          description: Success
    post:
      operationId: createItem
      summary: Create item
      responses:
        '201':
          description: Created
  /items/{id}:
    get:
      operationId: getItem
      responses:
        '200':
          description: Success
`

describe('loadApiEditor', () => {
  it('loads operation details from an openapi.json with no existing structure', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-editor-test-'))
    const apiDir = path.join(tempRoot, 'apis', 'test')
    const openapiPath = path.join(apiDir, 'openapi.json')

    try {
      await mkdir(apiDir, { recursive: true })
      await writeFile(openapiPath, MINIMAL_OPENAPI, 'utf8')

      const { structure, operations, schemas } = await loadApiEditor(tempRoot, 'apis/test/openapi.json')

      expect(operations).toHaveLength(3)

      const listItems = operations.find((op) => op.operationId === 'listItems')
      expect(listItems).toBeDefined()
      expect(listItems?.method).toBe('GET')
      expect(listItems?.path).toBe('/items')
      expect(listItems?.summary).toBe('List items')
      expect(listItems?.description).toBe('Returns all items')
      expect(listItems?.tags).toEqual(['items'])
      expect(listItems?.responseSchemas).toEqual([
        { id: '200:application/json', responseCode: '200', schemaName: 'ListItemsResponse' }
      ])

      const getItem = operations.find((op) => op.operationId === 'getItem')
      expect(getItem?.summary).toBe('')
      expect(getItem?.tags).toEqual([])
      expect(getItem?.parameterIds).toEqual(['path:id'])

      const createItem = operations.find((op) => op.operationId === 'createItem')
      expect(createItem?.requestBodyMediaType).toBe('application/json')
      expect(createItem?.requestBodyRequired).toBe(true)
      expect(createItem?.requestBodySchemaName).toBe('CreateItemRequest')
      expect(createItem?.responseSchemas).toEqual([
        { id: '201:application/json', responseCode: '201', schemaName: 'CreateItemResponse' }
      ])
      expect(schemas.some((schema) => schema.name === 'CreateItemRequest')).toBe(true)
      expect(schemas.find((schema) => schema.name === 'CreateItemRequest')?.usageTag).toBe('Rqst')
      expect(schemas.find((schema) => schema.name === 'CreateItemResponse')?.usageTag).toBe('Resp')

      // Without structure.json all ops go to ungrouped
      expect(structure.ungrouped).toHaveLength(3)
      expect(structure.rootFolder.operations).toHaveLength(0)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('uses operation key format METHOD:path', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-editor-test-'))
    const apiDir = path.join(tempRoot, 'apis', 'test')
    const openapiPath = path.join(apiDir, 'openapi.json')

    try {
      await mkdir(apiDir, { recursive: true })
      await writeFile(openapiPath, MINIMAL_OPENAPI, 'utf8')

      const { operations } = await loadApiEditor(tempRoot, 'apis/test/openapi.json')

      const keys = operations.map((op) => op.key)
      expect(keys).toContain('GET:/items')
      expect(keys).toContain('POST:/items')
      expect(keys).toContain('GET:/items/{id}')
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('loads existing structure saved under legacy directory-based API id', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-editor-legacy-id-'))
    const apiDir = path.join(tempRoot, 'apis', 'test')
    const openapiPath = path.join(apiDir, 'custom-api.json')
    const toolDir = path.join(tempRoot, '.api-tool')

    try {
      await mkdir(apiDir, { recursive: true })
      await mkdir(toolDir, { recursive: true })
      await writeFile(openapiPath, MINIMAL_OPENAPI, 'utf8')

      await writeFile(
        path.join(toolDir, 'structure.json'),
        JSON.stringify(
          {
            version: '1',
            apis: [
              {
                id: 'apis__test',
                name: 'Legacy API',
                path: 'apis/test',
                rootFolder: {
                  id: 'apis__test__root',
                  name: 'root',
                  children: [
                    {
                      id: 'folder-1',
                      name: 'Grouped',
                      children: [],
                      operations: []
                    }
                  ],
                  operations: []
                },
                ungrouped: []
              }
            ]
          },
          null,
          2
        ),
        'utf8'
      )

      const { structure } = await loadApiEditor(tempRoot, 'apis/test/custom-api.json')
      expect(structure.rootFolder.children).toHaveLength(1)
      expect(structure.rootFolder.children[0]?.name).toBe('Grouped')
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('loads operation details from YAML OpenAPI files', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-editor-yaml-test-'))
    const apiDir = path.join(tempRoot, 'apis', 'test')
    const openapiPath = path.join(apiDir, 'openapi.yaml')

    try {
      await mkdir(apiDir, { recursive: true })
      await writeFile(openapiPath, MINIMAL_OPENAPI_YAML, 'utf8')

      const { operations } = await loadApiEditor(tempRoot, 'apis/test/openapi.yaml')

      expect(operations).toHaveLength(3)
      expect(operations[0]?.key).toBeDefined()
      expect(operations.some((op) => op.key === 'GET:/items')).toBe(true)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('loads nested schema property definitions for arrays and object references', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-editor-nested-schema-test-'))
    const apiDir = path.join(tempRoot, 'apis', 'test')
    const openapiPath = path.join(apiDir, 'openapi.json')

    const source = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Nested API', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          Test: {
            type: 'object',
            properties: {
              id: { type: 'string' }
            }
          },
          ListTestsResponse: {
            type: 'object',
            properties: {
              tests: {
                type: 'array',
                items: { $ref: '#/components/schemas/Test' }
              },
              metadata: {
                allOf: [{ $ref: '#/components/schemas/Test' }]
              }
            }
          }
        }
      }
    })

    try {
      await mkdir(apiDir, { recursive: true })
      await writeFile(openapiPath, source, 'utf8')

      const { schemas } = await loadApiEditor(tempRoot, 'apis/test/openapi.json')
      const listSchema = schemas.find((schema) => schema.name === 'ListTestsResponse')
      const testsProp = listSchema?.properties.find((property) => property.name === 'tests')
      const metadataProp = listSchema?.properties.find((property) => property.name === 'metadata')

      expect(testsProp?.type).toBe('array')
      expect(testsProp?.arrayItemSchemaName).toBe('Test')
      expect(metadataProp?.type).toBe('object')
      expect(metadataProp?.objectSchemaName).toBe('Test')
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})

describe('buildUpdatedDocument', () => {
  it('applies summary and description edits to the document', async () => {
    const operations = [
      { key: 'GET:/items', operationId: 'listItems', method: 'GET' as const, path: '/items', summary: 'Updated list', description: 'New description', tags: ['items'], parameterIds: [], requestBodyMediaType: '', requestBodySchemaName: '', requestBodyRequired: false, responseSchemas: [{ id: '200:application/json', responseCode: '200', schemaName: 'ListItemsResponse' }] },
      { key: 'POST:/items', operationId: 'createItem', method: 'POST' as const, path: '/items', summary: 'Create item', description: '', tags: [], parameterIds: [], requestBodyMediaType: 'application/json', requestBodySchemaName: 'CreateItemRequest', requestBodyRequired: true, responseSchemas: [{ id: '201:application/json', responseCode: '201', schemaName: 'CreateItemResponse' }] },
      { key: 'GET:/items/{id}', operationId: 'getItem', method: 'GET' as const, path: '/items/{id}', summary: 'Fetch one item', description: '', tags: [], parameterIds: ['path:id'], requestBodyMediaType: '', requestBodySchemaName: '', requestBodyRequired: false, responseSchemas: [] }
    ]

    const result = await buildUpdatedDocument(MINIMAL_OPENAPI, operations, [], [
      { id: 'schema:createitemrequest', name: 'CreateItemRequest', description: '', properties: [{ id: 'name', name: 'name', type: 'string', required: true, description: '' }] },
      { id: 'schema:listitemsresponse', name: 'ListItemsResponse', description: '', properties: [{ id: 'items', name: 'items', type: 'array', required: false, description: '' }] },
      { id: 'schema:createitemresponse', name: 'CreateItemResponse', description: '', properties: [{ id: 'id', name: 'id', type: 'string', required: false, description: '' }] }
    ])
    const parsed = JSON.parse(result) as {
      paths: Record<string, Record<string, { summary?: string; description?: string; requestBody?: unknown }>>
    }

    expect(parsed.paths['/items']?.get?.summary).toBe('Updated list')
    expect(parsed.paths['/items']?.get?.description).toBe('New description')
    // Empty description should be removed
    expect(parsed.paths['/items']?.post?.description).toBeUndefined()
    expect(parsed.paths['/items']?.post?.requestBody).toBeDefined()
  })

  it('preserves other operation fields not in the edit payload', async () => {
    const operations = [
      { key: 'GET:/items', operationId: 'listItems', method: 'GET' as const, path: '/items', summary: 'Updated', description: '', tags: [], parameterIds: [], requestBodyMediaType: '', requestBodySchemaName: '', requestBodyRequired: false, responseSchemas: [{ id: '200:application/json', responseCode: '200', schemaName: 'ListItemsResponse' }] },
      { key: 'POST:/items', operationId: 'createItem', method: 'POST' as const, path: '/items', summary: 'Create item', description: '', tags: [], parameterIds: [], requestBodyMediaType: 'application/json', requestBodySchemaName: 'CreateItemRequest', requestBodyRequired: false, responseSchemas: [{ id: '201:application/json', responseCode: '201', schemaName: 'CreateItemResponse' }] },
      { key: 'GET:/items/{id}', operationId: 'getItem', method: 'GET' as const, path: '/items/{id}', summary: '', description: '', tags: [], parameterIds: ['path:id'], requestBodyMediaType: '', requestBodySchemaName: '', requestBodyRequired: false, responseSchemas: [] }
    ]

    const result = await buildUpdatedDocument(MINIMAL_OPENAPI, operations, [], [
      { id: 'schema:createitemrequest', name: 'CreateItemRequest', description: '', properties: [{ id: 'name', name: 'name', type: 'string', required: false, description: '' }] },
      { id: 'schema:listitemsresponse', name: 'ListItemsResponse', description: '', properties: [{ id: 'items', name: 'items', type: 'array', required: false, description: '' }] },
      { id: 'schema:createitemresponse', name: 'CreateItemResponse', description: '', properties: [{ id: 'id', name: 'id', type: 'string', required: false, description: '' }] }
    ])
    const parsed = JSON.parse(result) as {
      paths: Record<string, Record<string, { operationId?: string; responses?: unknown; requestBody?: unknown }>>
    }

    expect(parsed.paths['/items']?.get?.operationId).toBe('listItems')
    expect(parsed.paths['/items']?.get?.responses).toBeDefined()
    expect(parsed.paths['/items']?.post?.requestBody).toBeDefined()
  })

  it('parses YAML input and emits JSON output', async () => {
    const operations = [
      { key: 'GET:/items', operationId: 'listItems', method: 'GET' as const, path: '/items', summary: 'Updated list', description: '', tags: ['items'], parameterIds: [], requestBodyMediaType: '', requestBodySchemaName: '', requestBodyRequired: false, responseSchemas: [{ id: '200:application/json', responseCode: '200', schemaName: 'ListItemsResponse' }] },
      { key: 'POST:/items', operationId: 'createItem', method: 'POST' as const, path: '/items', summary: 'Create item', description: '', tags: [], parameterIds: [], requestBodyMediaType: 'application/json', requestBodySchemaName: 'CreateItemRequest', requestBodyRequired: false, responseSchemas: [{ id: '201:application/json', responseCode: '201', schemaName: 'CreateItemResponse' }] },
      { key: 'GET:/items/{id}', operationId: 'getItem', method: 'GET' as const, path: '/items/{id}', summary: '', description: '', tags: [], parameterIds: ['path:id'], requestBodyMediaType: '', requestBodySchemaName: '', requestBodyRequired: false, responseSchemas: [] }
    ]

    const result = await buildUpdatedDocument(MINIMAL_OPENAPI_YAML, operations, [], [
      { id: 'schema:createitemrequest', name: 'CreateItemRequest', description: '', properties: [{ id: 'name', name: 'name', type: 'string', required: false, description: '' }] },
      { id: 'schema:listitemsresponse', name: 'ListItemsResponse', description: '', properties: [{ id: 'items', name: 'items', type: 'array', required: false, description: '' }] },
      { id: 'schema:createitemresponse', name: 'CreateItemResponse', description: '', properties: [{ id: 'id', name: 'id', type: 'string', required: false, description: '' }] }
    ])
    const parsed = JSON.parse(result) as {
      openapi: string
      paths: Record<string, Record<string, { summary?: string; requestBody?: unknown }>>
    }

    expect(parsed.openapi).toBe('3.0.3')
    expect(parsed.paths['/items']?.get?.summary).toBe('Updated list')
    expect(parsed.paths['/items']?.post?.requestBody).toBeDefined()
  })

  it('writes operation parameters from environment catalog', async () => {
    const operations = [
      { key: 'GET:/items', operationId: 'listItems', method: 'GET' as const, path: '/items', summary: 'List items', description: 'Returns all items', tags: ['items'], parameterIds: ['query:limit', 'header:x-trace-id'], requestBodyMediaType: '', requestBodySchemaName: '', requestBodyRequired: false, responseSchemas: [] },
      { key: 'POST:/items', operationId: 'createItem', method: 'POST' as const, path: '/items', summary: 'Create item', description: '', tags: [], parameterIds: [], requestBodyMediaType: '', requestBodySchemaName: '', requestBodyRequired: false, responseSchemas: [] },
      { key: 'GET:/items/{id}', operationId: 'getItem', method: 'GET' as const, path: '/items/{id}', summary: '', description: '', tags: [], parameterIds: ['path:id'], requestBodyMediaType: '', requestBodySchemaName: '', requestBodyRequired: false, responseSchemas: [] }
    ]

    const result = await buildUpdatedDocument(MINIMAL_OPENAPI, operations, [
      { id: 'query:limit', name: 'limit', in: 'query', required: false },
      { id: 'header:x-trace-id', name: 'x-trace-id', in: 'header', required: false },
      { id: 'path:id', name: 'id', in: 'path', required: true }
    ])
    const parsed = JSON.parse(result) as {
      paths: Record<string, Record<string, { parameters?: Array<{ schema?: { type?: string } }> }>>
    }

    const listParams = parsed.paths['/items']?.get?.parameters ?? []
    expect(listParams).toHaveLength(2)
    expect(listParams[0]?.schema?.type).toBe('string')
    const getByIdParams = parsed.paths['/items/{id}']?.get?.parameters ?? []
    expect(getByIdParams).toHaveLength(1)
    expect(getByIdParams[0]?.schema?.type).toBe('string')
  })

  it('writes schema usage tags to OpenAPI components', async () => {
    const result = await buildUpdatedDocument(MINIMAL_OPENAPI, [], [], [
      {
        id: 'schema:request-body',
        name: 'RequestBody',
        description: '',
        usageTag: 'Rqst',
        properties: [{ id: 'prop-1', name: 'name', type: 'string', required: true, description: '' }]
      },
      {
        id: 'schema:response-body',
        name: 'ResponseBody',
        description: '',
        usageTag: 'Resp',
        properties: [{ id: 'prop-2', name: 'id', type: 'string', required: false, description: '' }]
      }
    ])

    const parsed = JSON.parse(result) as {
      components?: {
        schemas?: Record<string, Record<string, unknown>>
      }
    }

    expect(parsed.components?.schemas?.RequestBody?.['x-apicaramba-usage-tag']).toBe('Rqst')
    expect(parsed.components?.schemas?.ResponseBody?.['x-apicaramba-usage-tag']).toBe('Resp')
  })

  it('writes nested array and object schema references', async () => {
    const result = await buildUpdatedDocument(MINIMAL_OPENAPI, [], [], [
      {
        id: 'schema:test',
        name: 'Test',
        description: '',
        usageTag: 'Both',
        properties: [{ id: 'id', name: 'id', type: 'string', required: true, description: '' }]
      },
      {
        id: 'schema:list-tests-response',
        name: 'ListTestsResponse',
        description: '',
        usageTag: 'Resp',
        properties: [
          {
            id: 'tests',
            name: 'tests',
            type: 'array',
            arrayItemSchemaName: 'Test',
            required: true,
            description: ''
          },
          {
            id: 'metadata',
            name: 'metadata',
            type: 'object',
            objectSchemaName: 'Test',
            required: false,
            description: ''
          }
        ]
      }
    ])

    const parsed = JSON.parse(result) as {
      components?: {
        schemas?: Record<string, {
          properties?: Record<string, {
            items?: { $ref?: string }
            allOf?: Array<{ $ref?: string }>
          }>
        }>
      }
    }

    const testsProperty = parsed.components?.schemas?.ListTestsResponse?.properties?.tests
    const metadataProperty = parsed.components?.schemas?.ListTestsResponse?.properties?.metadata

    expect(testsProperty?.items?.$ref).toBe('#/components/schemas/Test')
    expect(metadataProperty?.allOf?.[0]?.$ref).toBe('#/components/schemas/Test')
  })
})

describe('saveStructure', () => {
  it('creates .api-tool/structure.json when it does not exist', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-structure-test-'))
    const openapiRelativePath = 'apis/test/openapi.json'

    try {
      await mkdir(path.join(tempRoot, 'apis', 'test'), { recursive: true })

      const structure = {
        id: 'apis__test',
        name: 'Test API',
        path: 'apis/test',
        rootFolder: { id: 'apis__test__root', name: 'root', children: [], operations: [] },
        ungrouped: [
          { id: 'get--items', operationId: 'listItems', method: 'GET' as const, path: '/items' }
        ]
      }

      await saveStructure(tempRoot, openapiRelativePath, structure)

      const writtenRaw = await readFile(path.join(tempRoot, 'apis', 'test', '.api-tool', 'structure.json'), 'utf8')
      const written = JSON.parse(writtenRaw) as { version: string; apis: { id: string }[] }

      expect(written.version).toBe('1')
      expect(written.apis).toHaveLength(1)
      expect(written.apis[0]?.id).toBe('apis__test')
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('merges with existing structure, preserving other API entries', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-structure-test-'))
    const openapiRelativePath = 'apis/payments/openapi.json'

    try {
      const toolDir = path.join(tempRoot, 'apis', 'payments', '.api-tool')
      await mkdir(toolDir, { recursive: true })

      const newStructure = {
        id: 'apis__payments',
        name: 'Payments API',
        path: 'apis/payments',
        rootFolder: { id: 'apis__payments__root', name: 'root', children: [], operations: [] },
        ungrouped: []
      }
      await saveStructure(tempRoot, openapiRelativePath, newStructure)

      const writtenRaw = await readFile(path.join(toolDir, 'structure.json'), 'utf8')
      const written = JSON.parse(writtenRaw) as { apis: { id: string }[] }

      expect(written.apis).toHaveLength(1)
      const ids = written.apis.map((a) => a.id)
      expect(ids).toContain('apis__payments')
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('replaces legacy structure ids when migrating an API path', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-structure-replace-test-'))

    try {
      const toolDir = path.join(tempRoot, 'apis', 'demo', '.api-tool')
      await mkdir(toolDir, { recursive: true })
      await writeFile(
        path.join(toolDir, 'structure.json'),
        JSON.stringify({ version: '1', apis: [{ id: 'apis__demo__openapi.yaml', name: 'Demo API', path: 'apis/demo', rootFolder: { id: 'apis__demo__openapi.yaml__root', name: 'root', children: [], operations: [] }, ungrouped: [] }] }),
        'utf8'
      )

      const migratedStructure = {
        id: 'apis__demo__openapi.json',
        name: 'Demo API',
        path: 'apis/demo',
        rootFolder: { id: 'apis__demo__openapi.json__root', name: 'root', children: [], operations: [] },
        ungrouped: []
      }

      await saveStructure(tempRoot, 'apis/demo/openapi.json', migratedStructure)

      const writtenRaw = await readFile(path.join(toolDir, 'structure.json'), 'utf8')
      const written = JSON.parse(writtenRaw) as { apis: { id: string }[] }

      expect(written.apis).toHaveLength(1)
      expect(written.apis[0]?.id).toBe('apis__demo__openapi.json')
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})
