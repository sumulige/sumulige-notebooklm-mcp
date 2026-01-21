/**
 * Immutable Configuration System
 *
 * Solves the problem of mutable global CONFIG being modified at runtime.
 * All config changes return new frozen objects instead of mutating.
 *
 * Key Features:
 * - Deep frozen objects (truly immutable)
 * - withOverrides() returns new config instances
 * - Type-safe partial overrides
 * - No race conditions from concurrent modifications
 */

import envPaths from "env-paths";
import path from "path";

// Cross-platform paths (matching existing behavior)
const paths = envPaths("notebooklm-mcp", { suffix: "" });

/**
 * Core configuration interface (mirrors existing Config)
 */
export interface AppConfig {
  // NotebookLM
  readonly notebookUrl: string;

  // Browser Settings
  readonly headless: boolean;
  readonly browserTimeout: number;
  readonly viewport: Readonly<{ width: number; height: number }>;

  // Session Management
  readonly maxSessions: number;
  readonly sessionTimeout: number;

  // Authentication
  readonly autoLoginEnabled: boolean;
  readonly loginEmail: string;
  readonly loginPassword: string;
  readonly autoLoginTimeoutMs: number;

  // Stealth Settings
  readonly stealthEnabled: boolean;
  readonly stealthRandomDelays: boolean;
  readonly stealthHumanTyping: boolean;
  readonly stealthMouseMovements: boolean;
  readonly typingWpmMin: number;
  readonly typingWpmMax: number;
  readonly minDelayMs: number;
  readonly maxDelayMs: number;

  // Paths
  readonly configDir: string;
  readonly dataDir: string;
  readonly browserStateDir: string;
  readonly chromeProfileDir: string;
  readonly chromeInstancesDir: string;

  // Library Configuration
  readonly notebookDescription: string;
  readonly notebookTopics: readonly string[];
  readonly notebookContentTypes: readonly string[];
  readonly notebookUseCases: readonly string[];

  // Multi-instance profile strategy
  readonly profileStrategy: "auto" | "single" | "isolated";
  readonly cloneProfileOnIsolated: boolean;
  readonly cleanupInstancesOnStartup: boolean;
  readonly cleanupInstancesOnShutdown: boolean;
  readonly instanceProfileTtlHours: number;
  readonly instanceProfileMaxCount: number;
}

/**
 * Partial config for overrides (all fields optional)
 */
export type ConfigOverrides = {
  readonly [K in keyof AppConfig]?: AppConfig[K];
};

/**
 * Browser options that can be passed via tool parameters
 */
export interface BrowserOptions {
  readonly show?: boolean;
  readonly headless?: boolean;
  readonly timeout_ms?: number;
  readonly stealth?: Readonly<{
    enabled?: boolean;
    random_delays?: boolean;
    human_typing?: boolean;
    mouse_movements?: boolean;
    typing_wpm_min?: number;
    typing_wpm_max?: number;
    delay_min_ms?: number;
    delay_max_ms?: number;
  }>;
  readonly viewport?: Readonly<{
    width?: number;
    height?: number;
  }>;
}

/**
 * Default configuration values
 */
const DEFAULTS: AppConfig = Object.freeze({
  notebookUrl: "",
  headless: true,
  browserTimeout: 30000,
  viewport: Object.freeze({ width: 1024, height: 768 }),
  maxSessions: 10,
  sessionTimeout: 900,
  autoLoginEnabled: false,
  loginEmail: "",
  loginPassword: "",
  autoLoginTimeoutMs: 120000,
  stealthEnabled: true,
  stealthRandomDelays: true,
  stealthHumanTyping: true,
  stealthMouseMovements: true,
  typingWpmMin: 160,
  typingWpmMax: 240,
  minDelayMs: 100,
  maxDelayMs: 400,
  configDir: paths.config,
  dataDir: paths.data,
  browserStateDir: path.join(paths.data, "browser_state"),
  chromeProfileDir: path.join(paths.data, "chrome_profile"),
  chromeInstancesDir: path.join(paths.data, "chrome_profile_instances"),
  notebookDescription: "General knowledge base",
  notebookTopics: Object.freeze(["General topics"]),
  notebookContentTypes: Object.freeze(["documentation", "examples"]),
  notebookUseCases: Object.freeze(["General research"]),
  profileStrategy: "auto",
  cloneProfileOnIsolated: false,
  cleanupInstancesOnStartup: true,
  cleanupInstancesOnShutdown: true,
  instanceProfileTtlHours: 72,
  instanceProfileMaxCount: 20,
});

/**
 * Parse helpers for environment variables
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const lower = value.toLowerCase();
  if (lower === "true" || lower === "1") return true;
  if (lower === "false" || lower === "0") return false;
  return defaultValue;
}

function parseInteger(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseArray(value: string | undefined, defaultValue: readonly string[]): readonly string[] {
  if (!value) return defaultValue;
  return Object.freeze(
    value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );
}

/**
 * Deep freeze an object recursively
 */
function deepFreeze<T extends object>(obj: T): Readonly<T> {
  const propNames = Object.getOwnPropertyNames(obj) as (keyof T)[];
  for (const name of propNames) {
    const value = obj[name];
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  }
  return Object.freeze(obj);
}

/**
 * Apply environment variable overrides
 */
function applyEnvOverrides(config: AppConfig): AppConfig {
  const env = process.env;
  return deepFreeze({
    ...config,
    notebookUrl: env.NOTEBOOK_URL || config.notebookUrl,
    headless: parseBoolean(env.HEADLESS, config.headless),
    browserTimeout: parseInteger(env.BROWSER_TIMEOUT, config.browserTimeout),
    maxSessions: parseInteger(env.MAX_SESSIONS, config.maxSessions),
    sessionTimeout: parseInteger(env.SESSION_TIMEOUT, config.sessionTimeout),
    autoLoginEnabled: parseBoolean(env.AUTO_LOGIN_ENABLED, config.autoLoginEnabled),
    loginEmail: env.LOGIN_EMAIL || config.loginEmail,
    loginPassword: env.LOGIN_PASSWORD || config.loginPassword,
    autoLoginTimeoutMs: parseInteger(env.AUTO_LOGIN_TIMEOUT_MS, config.autoLoginTimeoutMs),
    stealthEnabled: parseBoolean(env.STEALTH_ENABLED, config.stealthEnabled),
    stealthRandomDelays: parseBoolean(env.STEALTH_RANDOM_DELAYS, config.stealthRandomDelays),
    stealthHumanTyping: parseBoolean(env.STEALTH_HUMAN_TYPING, config.stealthHumanTyping),
    stealthMouseMovements: parseBoolean(env.STEALTH_MOUSE_MOVEMENTS, config.stealthMouseMovements),
    typingWpmMin: parseInteger(env.TYPING_WPM_MIN, config.typingWpmMin),
    typingWpmMax: parseInteger(env.TYPING_WPM_MAX, config.typingWpmMax),
    minDelayMs: parseInteger(env.MIN_DELAY_MS, config.minDelayMs),
    maxDelayMs: parseInteger(env.MAX_DELAY_MS, config.maxDelayMs),
    notebookDescription: env.NOTEBOOK_DESCRIPTION || config.notebookDescription,
    notebookTopics: parseArray(env.NOTEBOOK_TOPICS, config.notebookTopics),
    notebookContentTypes: parseArray(env.NOTEBOOK_CONTENT_TYPES, config.notebookContentTypes),
    notebookUseCases: parseArray(env.NOTEBOOK_USE_CASES, config.notebookUseCases),
    profileStrategy: (env.NOTEBOOK_PROFILE_STRATEGY as AppConfig["profileStrategy"]) || config.profileStrategy,
    cloneProfileOnIsolated: parseBoolean(env.NOTEBOOK_CLONE_PROFILE, config.cloneProfileOnIsolated),
    cleanupInstancesOnStartup: parseBoolean(env.NOTEBOOK_CLEANUP_ON_STARTUP, config.cleanupInstancesOnStartup),
    cleanupInstancesOnShutdown: parseBoolean(env.NOTEBOOK_CLEANUP_ON_SHUTDOWN, config.cleanupInstancesOnShutdown),
    instanceProfileTtlHours: parseInteger(env.NOTEBOOK_INSTANCE_TTL_HOURS, config.instanceProfileTtlHours),
    instanceProfileMaxCount: parseInteger(env.NOTEBOOK_INSTANCE_MAX_COUNT, config.instanceProfileMaxCount),
    viewport: Object.freeze({ ...config.viewport }),
  });
}

/**
 * Immutable Configuration Class
 *
 * Encapsulates configuration with immutability guarantees.
 * All modifications return new instances.
 */
export class ImmutableConfig {
  private readonly _config: AppConfig;

  private constructor(config: AppConfig) {
    this._config = config;
  }

  /**
   * Create configuration from defaults + environment variables
   */
  static create(): ImmutableConfig {
    return new ImmutableConfig(applyEnvOverrides(DEFAULTS));
  }

  /**
   * Create configuration with custom overrides (for testing)
   */
  static createWithOverrides(overrides: ConfigOverrides): ImmutableConfig {
    const base = applyEnvOverrides(DEFAULTS);
    return new ImmutableConfig(deepFreeze({ ...base, ...overrides }));
  }

  /**
   * Get the underlying frozen config object
   */
  get config(): AppConfig {
    return this._config;
  }

  /**
   * Create a new ImmutableConfig with overrides applied
   * Original instance remains unchanged
   */
  withOverrides(overrides: ConfigOverrides): ImmutableConfig {
    const newConfig = deepFreeze({
      ...this._config,
      ...overrides,
      // Deep merge viewport if provided
      viewport:
        overrides.viewport !== undefined
          ? Object.freeze({ ...this._config.viewport, ...overrides.viewport })
          : this._config.viewport,
    });
    return new ImmutableConfig(newConfig);
  }

  /**
   * Apply browser options and return new config
   * Converts BrowserOptions to ConfigOverrides
   */
  withBrowserOptions(options?: BrowserOptions, legacyShowBrowser?: boolean): ImmutableConfig {
    if (!options && legacyShowBrowser === undefined) {
      return this;
    }

    const overrides: ConfigOverrides = {};

    // Handle legacy show_browser parameter
    if (legacyShowBrowser !== undefined) {
      (overrides as Record<string, unknown>).headless = !legacyShowBrowser;
    }

    // Apply browser_options (takes precedence)
    if (options) {
      if (options.show !== undefined) {
        (overrides as Record<string, unknown>).headless = !options.show;
      }
      if (options.headless !== undefined) {
        (overrides as Record<string, unknown>).headless = options.headless;
      }
      if (options.timeout_ms !== undefined) {
        (overrides as Record<string, unknown>).browserTimeout = options.timeout_ms;
      }
      if (options.stealth) {
        const s = options.stealth;
        if (s.enabled !== undefined) (overrides as Record<string, unknown>).stealthEnabled = s.enabled;
        if (s.random_delays !== undefined) (overrides as Record<string, unknown>).stealthRandomDelays = s.random_delays;
        if (s.human_typing !== undefined) (overrides as Record<string, unknown>).stealthHumanTyping = s.human_typing;
        if (s.mouse_movements !== undefined) (overrides as Record<string, unknown>).stealthMouseMovements = s.mouse_movements;
        if (s.typing_wpm_min !== undefined) (overrides as Record<string, unknown>).typingWpmMin = s.typing_wpm_min;
        if (s.typing_wpm_max !== undefined) (overrides as Record<string, unknown>).typingWpmMax = s.typing_wpm_max;
        if (s.delay_min_ms !== undefined) (overrides as Record<string, unknown>).minDelayMs = s.delay_min_ms;
        if (s.delay_max_ms !== undefined) (overrides as Record<string, unknown>).maxDelayMs = s.delay_max_ms;
      }
      if (options.viewport) {
        (overrides as Record<string, unknown>).viewport = Object.freeze({
          width: options.viewport.width ?? this._config.viewport.width,
          height: options.viewport.height ?? this._config.viewport.height,
        });
      }
    }

    return this.withOverrides(overrides);
  }

  // Convenience getters for common properties
  get notebookUrl(): string { return this._config.notebookUrl; }
  get headless(): boolean { return this._config.headless; }
  get browserTimeout(): number { return this._config.browserTimeout; }
  get viewport(): Readonly<{ width: number; height: number }> { return this._config.viewport; }
  get maxSessions(): number { return this._config.maxSessions; }
  get sessionTimeout(): number { return this._config.sessionTimeout; }
  get autoLoginEnabled(): boolean { return this._config.autoLoginEnabled; }
  get stealthEnabled(): boolean { return this._config.stealthEnabled; }
  get configDir(): string { return this._config.configDir; }
  get dataDir(): string { return this._config.dataDir; }
  get browserStateDir(): string { return this._config.browserStateDir; }
  get chromeProfileDir(): string { return this._config.chromeProfileDir; }
  get chromeInstancesDir(): string { return this._config.chromeInstancesDir; }
  get profileStrategy(): "auto" | "single" | "isolated" { return this._config.profileStrategy; }
}

/**
 * Default immutable config instance
 * Use this for read-only access to config
 */
export const defaultConfig = ImmutableConfig.create();
