/**
 * Dependency Injection Module
 *
 * Exports DI container and utilities.
 */

export {
  TOKENS,
  initializeContainer,
  getContainer,
  createTestContainer,
  resetContainer,
  resolve,
  isRegistered,
  container,
} from "./container.js";

export type { DependencyContainer, InjectionToken } from "./container.js";
