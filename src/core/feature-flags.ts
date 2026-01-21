/**
 * Feature Flags
 *
 * Controls gradual rollout of new architecture components.
 * Allows safe rollback to legacy implementations if issues arise.
 *
 * Usage:
 *   import { FLAGS } from "./core/feature-flags.js";
 *   if (FLAGS.USE_EVENT_BUS) { ... }
 *
 * Environment Variables:
 *   FF_USE_EVENT_BUS=true          - Enable EventBus for domain events
 *   FF_USE_AUTH_STATE_MACHINE=true - Enable AuthStateMachine
 *   FF_USE_SESSION_ACTOR=true      - Enable SessionActor model
 *   FF_USE_IMMUTABLE_CONFIG=true   - Enable ImmutableConfig
 *   FF_USE_CONTEXT_POOL=true       - Enable BrowserContextPool
 *   FF_USE_RESPONSE_OBSERVER=true  - Enable MutationObserver for responses
 */

/**
 * Parse boolean from environment variable
 */
function envBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Feature flags configuration
 *
 * Default values are conservative - new features are OFF by default.
 * Set environment variables to enable features individually.
 */
export const FLAGS = Object.freeze({
  /**
   * Use EventBus for domain events
   * - Enables publish/subscribe pattern for loose coupling
   * - Provides event history for debugging
   */
  USE_EVENT_BUS: envBool("FF_USE_EVENT_BUS", false),

  /**
   * Use AuthStateMachine for authentication state management
   * - Single source of truth for auth state
   * - Prevents invalid state transitions
   * - Thread-safe with async-lock
   */
  USE_AUTH_STATE_MACHINE: envBool("FF_USE_AUTH_STATE_MACHINE", false),

  /**
   * Use SessionActor for session management
   * - Actor model ensures sequential message processing
   * - Prevents race conditions
   * - Better state encapsulation
   */
  USE_SESSION_ACTOR: envBool("FF_USE_SESSION_ACTOR", false),

  /**
   * Use ImmutableConfig instead of mutable CONFIG
   * - Prevents runtime config modification
   * - withOverrides() returns new instances
   */
  USE_IMMUTABLE_CONFIG: envBool("FF_USE_IMMUTABLE_CONFIG", false),

  /**
   * Use BrowserContextPool with reference counting
   * - Better resource management
   * - Safe headless mode switching
   * - Async-lock protection
   */
  USE_CONTEXT_POOL: envBool("FF_USE_CONTEXT_POOL", false),

  /**
   * Use ResponseObserver (MutationObserver) instead of polling
   * - Event-driven DOM change detection
   * - More efficient than 1Hz polling
   * - Stability debouncing
   */
  USE_RESPONSE_OBSERVER: envBool("FF_USE_RESPONSE_OBSERVER", false),

  /**
   * Enable all new architecture features at once
   * - Convenience flag for testing full new architecture
   * - Overrides individual flags when true
   */
  USE_NEW_ARCHITECTURE: envBool("FF_USE_NEW_ARCHITECTURE", false),
});

/**
 * Check if a feature is enabled
 * Respects USE_NEW_ARCHITECTURE override
 */
export function isEnabled(
  flag: keyof Omit<typeof FLAGS, "USE_NEW_ARCHITECTURE">
): boolean {
  if (FLAGS.USE_NEW_ARCHITECTURE) {
    return true;
  }
  return FLAGS[flag];
}

/**
 * Get all enabled features for logging
 */
export function getEnabledFeatures(): string[] {
  const enabled: string[] = [];

  if (FLAGS.USE_NEW_ARCHITECTURE) {
    return ["ALL (USE_NEW_ARCHITECTURE=true)"];
  }

  for (const [key, value] of Object.entries(FLAGS)) {
    if (key !== "USE_NEW_ARCHITECTURE" && value) {
      enabled.push(key);
    }
  }

  return enabled.length > 0 ? enabled : ["NONE (using legacy)"];
}

/**
 * Log feature flags status on startup
 */
export function logFeatureFlags(): void {
  const enabled = getEnabledFeatures();
  console.log(`[FeatureFlags] Enabled: ${enabled.join(", ")}`);
}
