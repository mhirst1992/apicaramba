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
        responses: { '200': { description: 'Success' } }
      },
      post: {
        operationId: 'createItem',
        summary: 'Create item',
        description: '',
        tags: [],
        responses: { '201': { description: 'Created' } }
      }
    },
    '/items/{id}': {
      get: {
        operationId: 'getItem',
        summary: '',
        description: '',
        tags: [],
        responses: { '200': { description: 'Success' } }
      }
    }
  }
})

describe('loadApiEditor', () => {
  it('loads operation details from an openapi.json with no existing structure', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-editor-test-'))
    const apiDir = path.join(tempRoot, 'apis', 'test')
    const openapiPath = path.join(apiDir, 'openapi.json')

    try {
      await mkdir(apiDir, { recursive: true })
      await writeFile(openapiPath, MINIMAL_OPENAPI, 'utf8')

      const { structure, operations } = await loadApiEditor(tempRoot, 'apis/test/openapi.json')

      expect(operations).toHaveLength(3)

      const listItems = operations.find((op) => op.operationId === 'listItems')
      expect(listItems).toBeDefined()
      expect(listItems?.method).toBe('GET')
      expect(listItems?.path).toBe('/items')
      expect(listItems?.summary).toBe('List items')
      expect(listItems?.description).toBe('Returns all items')
      expect(listItems?.tags).toEqual(['items'])

      const getItem = operations.find((op) => op.operationId === 'getItem')
      expect(getItem?.summary).toBe('')
      expect(getItem?.tags).toEqual([])

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
})

describe('buildUpdatedDocument', () => {
  it('applies summary and description edits to the document', () => {
    const operations = [
      { key: 'GET:/items', operationId: 'listItems', method: 'GET' as const, path: '/items', summary: 'Updated list', description: 'New description', tags: ['items'] },
      { key: 'POST:/items', operationId: 'createItem', method: 'POST' as const, path: '/items', summary: 'Create item', description: '', tags: [] },
      { key: 'GET:/items/{id}', operationId: 'getItem', method: 'GET' as const, path: '/items/{id}', summary: 'Fetch one item', description: '', tags: [] }
    ]

    const result = buildUpdatedDocument(MINIMAL_OPENAPI, operations)
    const parsed = JSON.parse(result) as { paths: Record<string, Record<string, { summary?: string; description?: string }>> }

    expect(parsed.paths['/items']?.get?.summary).toBe('Updated list')
    expect(parsed.paths['/items']?.get?.description).toBe('New description')
    // Empty description should be removed
    expect(parsed.paths['/items']?.post?.description).toBeUndefined()
  })

  it('preserves other operation fields not in the edit payload', () => {
    const operations = [
      { key: 'GET:/items', operationId: 'listItems', method: 'GET' as const, path: '/items', summary: 'Updated', description: '', tags: [] },
      { key: 'POST:/items', operationId: 'createItem', method: 'POST' as const, path: '/items', summary: 'Create item', description: '', tags: [] },
      { key: 'GET:/items/{id}', operationId: 'getItem', method: 'GET' as const, path: '/items/{id}', summary: '', description: '', tags: [] }
    ]

    const result = buildUpdatedDocument(MINIMAL_OPENAPI, operations)
    const parsed = JSON.parse(result) as { paths: Record<string, Record<string, { operationId?: string; responses?: unknown }>> }

    expect(parsed.paths['/items']?.get?.operationId).toBe('listItems')
    expect(parsed.paths['/items']?.get?.responses).toBeDefined()
  })
})

describe('saveStructure', () => {
  it('creates .api-tool/structure.json when it does not exist', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-structure-test-'))

    try {
      const structure = {
        id: 'apis__test',
        name: 'Test API',
        path: 'apis/test',
        rootFolder: { id: 'apis__test__root', name: 'root', children: [], operations: [] },
        ungrouped: [
          { id: 'get--items', operationId: 'listItems', method: 'GET' as const, path: '/items' }
        ]
      }

      await saveStructure(tempRoot, structure)

      const writtenRaw = await readFile(path.join(tempRoot, '.api-tool', 'structure.json'), 'utf8')
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

    try {
      const toolDir = path.join(tempRoot, '.api-tool')
      await mkdir(toolDir, { recursive: true })
      await writeFile(
        path.join(toolDir, 'structure.json'),
        JSON.stringify({ version: '1', apis: [{ id: 'apis__other', name: 'Other API', path: 'apis/other', rootFolder: { id: 'f', name: 'root', children: [], operations: [] }, ungrouped: [] }] }),
        'utf8'
      )

      const newStructure = {
        id: 'apis__payments',
        name: 'Payments API',
        path: 'apis/payments',
        rootFolder: { id: 'apis__payments__root', name: 'root', children: [], operations: [] },
        ungrouped: []
      }
      await saveStructure(tempRoot, newStructure)

      const writtenRaw = await readFile(path.join(toolDir, 'structure.json'), 'utf8')
      const written = JSON.parse(writtenRaw) as { apis: { id: string }[] }

      expect(written.apis).toHaveLength(2)
      const ids = written.apis.map((a) => a.id)
      expect(ids).toContain('apis__other')
      expect(ids).toContain('apis__payments')
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})
