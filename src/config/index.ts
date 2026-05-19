export { DEFAULT_CONFIG } from './defaults.js'
export {
  ConfigError,
  loadConfig,
  mergeConfig,
  readConfigFile,
  validateConfig,
  type LoadConfigOptions,
} from './loader.js'
export type { DsCodeConfig, PartialDsCodeConfig } from './schema.js'
