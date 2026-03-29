import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Environment, EnvironmentsConfig, EnvironmentParameter } from '@apicaramba/shared-types'

const TOOL_DIR = '.api-tool'
const ENVIRONMENTS_FILE = 'environments.json'

function defaultEnvironment(): Environment {
  return {
    id: 'default',
    name: 'Default',
    baseUrl: '',
    variables: [],
    parameters: []
  }
}

function defaultConfig(): EnvironmentsConfig {
  const environment = defaultEnvironment()

  return {
    version: '1.0.0',
    activeEnvironmentId: environment.id,
    environments: [environment]
  }
}

function normalizeConfig(input: EnvironmentsConfig): EnvironmentsConfig {
  const fallback = defaultConfig()
  const first = input.environments[0] ?? fallback.environments[0]

  if (!first) {
    return fallback
  }

  const normalizedEnv: Environment = {
    id: first.id || 'default',
    name: first.name || 'Default',
    baseUrl: first.baseUrl || '',
    variables: first.variables ?? [],
    parameters: normalizeParameters(first.parameters)
  }

  return {
    version: input.version || '1.0.0',
    activeEnvironmentId: normalizedEnv.id,
    environments: [normalizedEnv]
  }
}

function normalizeParameters(parameters: Environment['parameters'] | undefined): EnvironmentParameter[] {
  if (!Array.isArray(parameters)) {
    return []
  }

  const normalized: EnvironmentParameter[] = []

  for (const parameter of parameters) {
    const location = parameter?.in
    if (location !== 'query' && location !== 'header' && location !== 'path' && location !== 'cookie') {
      continue
    }

    const id = typeof parameter.id === 'string' ? parameter.id.trim() : ''
    const name = typeof parameter.name === 'string' ? parameter.name.trim() : ''
    if (!id || !name) {
      continue
    }

    normalized.push({
      id,
      name,
      in: location,
      ...(typeof parameter.description === 'string' ? { description: parameter.description } : {}),
      required: parameter.required === true
    })
  }

  return normalized
}

export async function loadEnvironmentsConfig(
  workspaceRootPath: string,
  openapiRelativePath: string
): Promise<EnvironmentsConfig> {
  const absoluteRoot = path.resolve(workspaceRootPath)
  const apiDir = path.dirname(path.resolve(absoluteRoot, openapiRelativePath))
  const filePath = path.join(apiDir, TOOL_DIR, ENVIRONMENTS_FILE)

  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as EnvironmentsConfig
    return normalizeConfig(parsed)
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return defaultConfig()
    }

    throw error
  }
}

export async function saveEnvironmentsConfig(
  workspaceRootPath: string,
  openapiRelativePath: string,
  config: EnvironmentsConfig
): Promise<EnvironmentsConfig> {
  const absoluteRoot = path.resolve(workspaceRootPath)
  const apiDir = path.dirname(path.resolve(absoluteRoot, openapiRelativePath))
  const toolDirPath = path.join(apiDir, TOOL_DIR)
  const filePath = path.join(toolDirPath, ENVIRONMENTS_FILE)
  const normalized = normalizeConfig(config)

  await mkdir(toolDirPath, { recursive: true })
  await writeFile(filePath, JSON.stringify(normalized, null, 2) + '\n', 'utf8')

  return normalized
}
