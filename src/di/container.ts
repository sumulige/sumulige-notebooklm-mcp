/**
 * Dependency Injection Container
 *
 * Configures tsyringe container for the application.
 * This is the composition root where all dependencies are wired together.
 *
 * Key Features:
 * - Centralized dependency registration
 * - Support for interface-based injection via tokens
 * - Singleton and transient scopes
 * - Easy testing with mock overrides
 */

// IMPORTANT: Import reflect-metadata first for decorator support
import "reflect-metadata";

import { container, DependencyContainer, InjectionToken } from "tsyringe";

// Core services
import { ConfigService } from "../core/config/config-service.js";
import { EventBus } from "../core/events/event-bus.js";
import { AuthStateMachine } from "../core/auth/auth-state-machine.js";

// Port interfaces (tokens for interface-based injection)
import type { IConfigPort } from "../core/ports/config-port.js";
import type { IBrowserPort } from "../core/ports/browser-port.js";
import type { IAuthPort } from "../core/ports/auth-port.js";
import type { IStoragePort } from "../core/ports/storage-port.js";

/**
 * Injection tokens for interfaces
 *
 * These tokens are used to register and resolve interface implementations.
 * This enables swapping implementations without changing dependent code.
 */
export const TOKENS = {
  // Ports (interfaces)
  ConfigPort: Symbol.for("IConfigPort") as InjectionToken<IConfigPort>,
  BrowserPort: Symbol.for("IBrowserPort") as InjectionToken<IBrowserPort>,
  AuthPort: Symbol.for("IAuthPort") as InjectionToken<IAuthPort>,
  StoragePort: Symbol.for("IStoragePort") as InjectionToken<IStoragePort>,

  // Services (concrete)
  ConfigService: Symbol.for("ConfigService") as InjectionToken<ConfigService>,
  EventBus: Symbol.for("EventBus") as InjectionToken<EventBus>,
  AuthStateMachine: Symbol.for("AuthStateMachine") as InjectionToken<AuthStateMachine>,
} as const;

/**
 * Register core services
 *
 * These are the foundation services that other components depend on.
 */
function registerCoreServices(c: DependencyContainer): void {
  // ConfigService (singleton)
  c.registerSingleton(TOKENS.ConfigService, ConfigService);
  c.register(TOKENS.ConfigPort, { useToken: TOKENS.ConfigService });

  // EventBus (singleton)
  c.registerSingleton(TOKENS.EventBus, EventBus);

  // AuthStateMachine (singleton)
  c.registerSingleton(TOKENS.AuthStateMachine, AuthStateMachine);
}

/**
 * Initialize the DI container
 *
 * Call this once at application startup before resolving any dependencies.
 */
export function initializeContainer(): DependencyContainer {
  registerCoreServices(container);
  return container;
}

/**
 * Get the DI container
 *
 * Returns the configured container for resolving dependencies.
 */
export function getContainer(): DependencyContainer {
  return container;
}

/**
 * Create a child container for testing
 *
 * Creates an isolated container that inherits from the main container
 * but can have its own overrides for mocking.
 */
export function createTestContainer(): DependencyContainer {
  return container.createChildContainer();
}

/**
 * Reset the container (for testing)
 */
export function resetContainer(): void {
  container.reset();
}

/**
 * Resolve a dependency from the container
 *
 * Convenience function for resolving dependencies.
 */
export function resolve<T>(token: InjectionToken<T>): T {
  return container.resolve(token);
}

/**
 * Check if a token is registered
 */
export function isRegistered<T>(token: InjectionToken<T>): boolean {
  return container.isRegistered(token);
}

// Re-export container types
export { container, DependencyContainer, InjectionToken };
