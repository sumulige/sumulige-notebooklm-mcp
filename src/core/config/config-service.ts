/**
 * Configuration Service
 *
 * Provides a dependency-injectable interface for configuration access.
 * Implements IConfigPort for hexagonal architecture.
 */

import { injectable } from "tsyringe";
import { ImmutableConfig, type AppConfig, type BrowserOptions, type ConfigOverrides } from "./immutable-config.js";

/**
 * Configuration Port Interface (for dependency injection)
 *
 * This is the interface that domain/application layers depend on.
 * Adapters implement this interface.
 */
export interface IConfigPort {
  /**
   * Get the current configuration snapshot
   */
  getConfig(): AppConfig;

  /**
   * Create a new config with overrides (does not mutate current)
   */
  createWithOverrides(overrides: ConfigOverrides): AppConfig;

  /**
   * Create a new config with browser options applied
   */
  createWithBrowserOptions(options?: BrowserOptions, legacyShowBrowser?: boolean): AppConfig;
}

/**
 * Configuration Service Implementation
 *
 * Injectable service that provides configuration access.
 * Uses ImmutableConfig internally.
 */
@injectable()
export class ConfigService implements IConfigPort {
  private readonly immutableConfig: ImmutableConfig;

  constructor() {
    this.immutableConfig = ImmutableConfig.create();
  }

  /**
   * Get the current frozen configuration
   */
  getConfig(): AppConfig {
    return this.immutableConfig.config;
  }

  /**
   * Create a new configuration with overrides
   * Does not modify the service's internal config
   */
  createWithOverrides(overrides: ConfigOverrides): AppConfig {
    return this.immutableConfig.withOverrides(overrides).config;
  }

  /**
   * Create a new configuration with browser options
   * Does not modify the service's internal config
   */
  createWithBrowserOptions(options?: BrowserOptions, legacyShowBrowser?: boolean): AppConfig {
    return this.immutableConfig.withBrowserOptions(options, legacyShowBrowser).config;
  }

  // Convenience accessors (read-only)
  get notebookUrl(): string { return this.immutableConfig.notebookUrl; }
  get headless(): boolean { return this.immutableConfig.headless; }
  get browserTimeout(): number { return this.immutableConfig.browserTimeout; }
  get viewport(): Readonly<{ width: number; height: number }> { return this.immutableConfig.viewport; }
  get maxSessions(): number { return this.immutableConfig.maxSessions; }
  get sessionTimeout(): number { return this.immutableConfig.sessionTimeout; }
  get autoLoginEnabled(): boolean { return this.immutableConfig.autoLoginEnabled; }
  get stealthEnabled(): boolean { return this.immutableConfig.stealthEnabled; }
  get configDir(): string { return this.immutableConfig.configDir; }
  get dataDir(): string { return this.immutableConfig.dataDir; }
  get browserStateDir(): string { return this.immutableConfig.browserStateDir; }
  get chromeProfileDir(): string { return this.immutableConfig.chromeProfileDir; }
  get chromeInstancesDir(): string { return this.immutableConfig.chromeInstancesDir; }
  get profileStrategy(): "auto" | "single" | "isolated" { return this.immutableConfig.profileStrategy; }
}

// Re-export types
export type { AppConfig, BrowserOptions, ConfigOverrides } from "./immutable-config.js";
