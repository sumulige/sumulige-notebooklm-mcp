/**
 * Ports Module
 *
 * Exports all port interfaces for the hexagonal architecture.
 * These interfaces define the contracts between layers.
 */

// Browser Port
export type {
  IBrowserPort,
  IBrowserContext,
  IPage,
  BrowserContextOptions,
  NavigationOptions,
  SelectorOptions,
  ScreenshotOptions,
  BrowserCookie,
} from "./browser-port.js";

// Auth Port
export type {
  IAuthPort,
  AuthProgressCallback,
  AuthResult,
  SavedStateInfo,
  CookieValidationResult,
} from "./auth-port.js";

// Storage Port
export type {
  IStoragePort,
  StorageOptions,
  FileInfo,
} from "./storage-port.js";

// Config Port
export type {
  IConfigPort,
  AppConfig,
  BrowserOptions,
  ConfigOverrides,
} from "./config-port.js";
