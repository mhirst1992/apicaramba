import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadWorkspaceSnapshot } from './index.js'

describe('loadWorkspaceSnapshot', () => {
	it('converts swagger 2.0 json to OpenAPI 3.x while loading API summaries', async () => {
		const fixturePath = path.resolve(process.cwd(), '_example', 'openapi.json')
		const fixtureJson = await readFile(fixturePath, 'utf8')

		const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-swagger-fixture-'))
		const apiFolder = path.join(tempRoot, '_example')
		const openapiPath = path.join(apiFolder, 'openapi.json')

		try {
			await mkdir(apiFolder, { recursive: true })
			await writeFile(openapiPath, fixtureJson, 'utf8')

			const snapshot = await loadWorkspaceSnapshot(tempRoot)
			expect(snapshot.apis).toHaveLength(1)

			const api = snapshot.apis[0]
			expect(api?.name).toBe('airportsapi')
			expect(api?.path).toBe('_example')
			expect(api?.operationCount).toBe(1)
			expect(api?.operations[0]).toMatchObject({
				method: 'GET',
				path: '/airportsapi/v1/airports/{icao_code}',
				operationId: 'AirportApi_getAirport'
			})
		} finally {
			await rm(tempRoot, { recursive: true, force: true })
		}
	})
})
