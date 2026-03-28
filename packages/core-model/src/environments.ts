import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Environment, EnvironmentsConfig } from '@apicaramba/shared-types'

const TOOL_DIR = '.api-tool'
const ENVIRONMENTS_FILE = 'environments.json'

function defaultEnvironment(): Environment {
  return {
    id: 'default',
    name: 'Default',
    baseUrl: '',
    variables: []
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
    variables: first.variables ?? []
  }

  return {
    version: input.version || '1.0.0',
    activeEnvironmentId: normalizedEnv.id,
    environments: [normalizedEnv]
  }
}

export async function loadEnvironmentsConfig(workspaceRootPath: string): Promise<EnvironmentsConfig> {
  const absoluteRoot = path.resolve(workspaceRootPath)
  const filePath = path.join(absoluteRoot, TOOL_DIR, ENVIRONMENTS_FILE)

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
  config: EnvironmentsConfig
): Promise<EnvironmentsConfig> {
  const absoluteRoot = path.resolve(workspaceRootPath)
  const toolDirPath = path.join(absoluteRoot, TOOL_DIR)
  const filePath = path.join(toolDirPath, ENVIRONMENTS_FILE)
  const normalized = normalizeConfig(config)

  await mkdir(toolDirPath, { recursive: true })
  await writeFile(filePath, JSON.stringify(normalized, null, 2) + '\n', 'utf8')

  return normalized
}
