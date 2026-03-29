import type { ApiStructure, FolderNode, HttpMethod, OperationRef } from '@apicaramba/shared-types'

export function findFolderById(folder: FolderNode, folderId: string): FolderNode | null {
  if (folder.id === folderId) {
    return folder
  }

  for (const child of folder.children) {
    const match = findFolderById(child, folderId)
    if (match) {
      return match
    }
  }

  return null
}

export function collectAndRemoveFolder(parent: FolderNode, folderId: string): FolderNode | null {
  const idx = parent.children.findIndex((c) => c.id === folderId)
  if (idx >= 0) {
    const [removed] = parent.children.splice(idx, 1)
    return removed ?? null
  }
  for (const child of parent.children) {
    const removed = collectAndRemoveFolder(child, folderId)
    if (removed) return removed
  }
  return null
}

export function collectAllFolderOps(folder: FolderNode): OperationRef[] {
  return [...folder.operations, ...folder.children.flatMap(collectAllFolderOps)]
}

export function isFolderAncestorOrSelf(folder: FolderNode, candidateId: string): boolean {
  if (folder.id === candidateId) return true
  return folder.children.some((c) => isFolderAncestorOrSelf(c, candidateId))
}

export function collectAndRemoveOperation(folder: FolderNode, operationId: string): OperationRef | null {
  const opIndex = folder.operations.findIndex((op) => op.id === operationId)
  if (opIndex >= 0) {
    const [removed] = folder.operations.splice(opIndex, 1)
    return removed ?? null
  }

  for (const child of folder.children) {
    const removed = collectAndRemoveOperation(child, operationId)
    if (removed) {
      return removed
    }
  }

  return null
}

export function parseOperationKey(operationKey: string): { method: HttpMethod; path: string } | null {
  const separatorIndex = operationKey.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }

  return {
    method: operationKey.slice(0, separatorIndex) as HttpMethod,
    path: operationKey.slice(separatorIndex + 1)
  }
}

function syncOperationRefInFolder(
  folder: FolderNode,
  fromMethod: HttpMethod,
  fromPath: string,
  toMethod: HttpMethod,
  toPath: string
): boolean {
  const operation = folder.operations.find((ref) => ref.method === fromMethod && ref.path === fromPath)
  if (operation) {
    operation.method = toMethod
    operation.path = toPath
    return true
  }

  for (const child of folder.children) {
    if (syncOperationRefInFolder(child, fromMethod, fromPath, toMethod, toPath)) {
      return true
    }
  }

  return false
}

export function syncOperationRefInStructure(
  draft: ApiStructure,
  sourceKey: string,
  toMethod: HttpMethod,
  toPath: string
): void {
  const source = parseOperationKey(sourceKey)
  if (!source) {
    return
  }

  const inUngrouped = draft.ungrouped.find((ref) => ref.method === source.method && ref.path === source.path)
  if (inUngrouped) {
    inUngrouped.method = toMethod
    inUngrouped.path = toPath
    return
  }

  syncOperationRefInFolder(draft.rootFolder, source.method, source.path, toMethod, toPath)
}
