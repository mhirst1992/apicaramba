import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadWorkspaceSnapshot } from './index.js'

describe('loadWorkspaceSnapshot', () => {
	it('converts swagger 2.0 json to OpenAPI 3.x while loading API summaries', async () => {
		const fixturePath = path.resolve(process.cwd(), '_example', 'openapi2.json')
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

	it('loads APIs from any JSON filename when they contain OpenAPI documents', async () => {
		const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-openapi-any-json-'))
		const apisDir = path.join(tempRoot, 'apis')

		const ordersApi = {
			openapi: '3.0.3',
			info: { title: 'Orders API', version: '1.0.0' },
			paths: {
				'/orders': {
					get: { operationId: 'listOrders', responses: { '200': { description: 'ok' } } }
				}
			}
		}

		const customersApi = {
			openapi: '3.0.3',
			info: { title: 'Customers API', version: '1.0.0' },
			paths: {
				'/customers': {
					get: { operationId: 'listCustomers', responses: { '200': { description: 'ok' } } }
				}
			}
		}

		try {
			await mkdir(apisDir, { recursive: true })
			await writeFile(path.join(apisDir, 'orders-spec.json'), JSON.stringify(ordersApi, null, 2), 'utf8')
			await writeFile(path.join(apisDir, 'customers.definition.json'), JSON.stringify(customersApi, null, 2), 'utf8')

			const snapshot = await loadWorkspaceSnapshot(tempRoot)
			expect(snapshot.apis).toHaveLength(2)

			const names = snapshot.apis.map((api) => api.name).sort()
			expect(names).toEqual(['Customers API', 'Orders API'])
		} finally {
			await rm(tempRoot, { recursive: true, force: true })
		}
	})

	it('ignores non-OpenAPI and malformed JSON files during discovery', async () => {
		const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-openapi-ignore-json-'))
		const apisDir = path.join(tempRoot, 'apis')

		const validApi = {
			openapi: '3.0.3',
			info: { title: 'Valid API', version: '1.0.0' },
			paths: {}
		}

		try {
			await mkdir(apisDir, { recursive: true })
			await writeFile(path.join(apisDir, 'valid-api.json'), JSON.stringify(validApi, null, 2), 'utf8')
			await writeFile(path.join(apisDir, 'config.json'), JSON.stringify({ hello: 'world' }, null, 2), 'utf8')
			await writeFile(path.join(apisDir, 'broken.json'), '{ not valid json', 'utf8')

			const snapshot = await loadWorkspaceSnapshot(tempRoot)
			expect(snapshot.apis).toHaveLength(1)
			expect(snapshot.apis[0]?.name).toBe('Valid API')
		} finally {
			await rm(tempRoot, { recursive: true, force: true })
		}
	})

	it('generates unique API ids for multiple JSON specs in the same directory', async () => {
		const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'apicaramba-openapi-ids-'))
		const apiDir = path.join(tempRoot, 'apis', 'billing')

		const invoicesApi = {
			openapi: '3.0.3',
			info: { title: 'Invoices API', version: '1.0.0' },
			paths: {}
		}

		const paymentsApi = {
			openapi: '3.0.3',
			info: { title: 'Payments API', version: '1.0.0' },
			paths: {}
		}

		try {
			await mkdir(apiDir, { recursive: true })
			await writeFile(path.join(apiDir, 'invoices.json'), JSON.stringify(invoicesApi, null, 2), 'utf8')
			await writeFile(path.join(apiDir, 'payments.json'), JSON.stringify(paymentsApi, null, 2), 'utf8')

			const snapshot = await loadWorkspaceSnapshot(tempRoot)
			expect(snapshot.apis).toHaveLength(2)

			const ids = snapshot.apis.map((api) => api.id)
			expect(new Set(ids).size).toBe(2)
		} finally {
			await rm(tempRoot, { recursive: true, force: true })
		}
	})
})
