import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const pkg = require(resolve(fileURLToPath(import.meta.url), '../../package.json'))

export const VERSION: string = pkg.version
export const NAME = 'ds-code'
