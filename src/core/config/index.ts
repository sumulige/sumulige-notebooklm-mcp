/**
 * Configuration Module
 *
 * Exports immutable configuration system components.
 */

export { ImmutableConfig, defaultConfig } from "./immutable-config.js";
export { ConfigService } from "./config-service.js";
export type {
  AppConfig,
  BrowserOptions,
  ConfigOverrides,
  IConfigPort,
} from "./config-service.js";
