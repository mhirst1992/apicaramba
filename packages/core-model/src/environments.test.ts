import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadEnvironmentsConfig, saveEnvironmentsConfig } from './environments.js'

describe('environments config', () => {
  it('returns a default single environment when file is missing', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-env-default-'))
    const openapiRelativePath = 'apis/demo/openapi.json'

    try {
      const config = await loadEnvironmentsConfig(tempRoot, openapiRelativePath)
      expect(config.environments).toHaveLength(1)
      expect(config.activeEnvironmentId).toBe(config.environments[0]?.id)
      expect(config.environments[0]?.name).toBe('Default')
      expect(config.environments[0]?.parameters).toEqual([])
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('saves and reloads normalized single environment config', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-env-save-'))
    const openapiRelativePath = 'apis/demo/openapi.json'

    try {
      const saved = await saveEnvironmentsConfig(tempRoot, openapiRelativePath, {
        version: '1.0.0',
        activeEnvironmentId: 'dev',
        environments: [
          {
            id: 'dev',
            name: 'Dev',
            baseUrl: 'https://api.example.dev',
            variables: [],
            parameters: [{ id: 'query:limit', name: 'limit', in: 'query', required: false }]
          },
          { id: 'ignored', name: 'Ignored', baseUrl: '', variables: [], parameters: [] }
        ]
      })

      expect(saved.environments).toHaveLength(1)
      expect(saved.environments[0]?.id).toBe('dev')
      expect(saved.environments[0]?.parameters).toHaveLength(1)
      expect(saved.activeEnvironmentId).toBe('dev')

      const reloaded = await loadEnvironmentsConfig(tempRoot, openapiRelativePath)
      expect(reloaded).toEqual(saved)

      const filePath = path.join(tempRoot, 'apis', 'demo', '.api-tool', 'environments.json')
      const raw = await readFile(filePath, 'utf8')
      expect(raw.endsWith('\n')).toBe(true)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})
