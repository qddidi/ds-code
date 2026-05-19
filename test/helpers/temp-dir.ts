import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface TempDirHandle {
  path: string
  cleanup: () => Promise<void>
}

export async function createTempDir(prefix = 'ds-test-'): Promise<TempDirHandle> {
  const path = await mkdtemp(join(tmpdir(), prefix))
  return {
    path,
    cleanup: () => rm(path, { recursive: true, force: true }),
  }
}

export async function copyFixture(fixturePath: string, prefix = 'ds-fixture-'): Promise<TempDirHandle> {
  const handle = await createTempDir(prefix)
  await cp(fixturePath, handle.path, { recursive: true })
  return handle
}
