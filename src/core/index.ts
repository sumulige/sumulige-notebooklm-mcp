/**
 * Core Module
 *
 * Exports all core infrastructure components:
 * - Configuration system
 * - Authentication state machine
 * - Port interfaces
 * - Event bus
 * - Domain entities
 * - Session actors
 */

// Configuration
export {
  ImmutableConfig,
  defaultConfig,
  ConfigService,
} from "./config/index.js";
export type {
  AppConfig,
  BrowserOptions,
  ConfigOverrides,
  IConfigPort,
} from "./config/index.js";

// Authentication
export {
  AuthStateMachine,
  createAuthStateMachine,
} from "./auth/index.js";
export type {
  AuthState,
  AuthEvent,
  AuthEventPayloads,
  AuthStateMachineEvents,
} from "./auth/index.js";

// Ports
export type {
  IBrowserPort,
  IBrowserContext,
  IPage,
  BrowserContextOptions,
  NavigationOptions,
  SelectorOptions,
  ScreenshotOptions,
  BrowserCookie,
  IAuthPort,
  AuthProgressCallback,
  AuthResult,
  SavedStateInfo,
  CookieValidationResult,
  IStoragePort,
  StorageOptions,
  FileInfo,
} from "./ports/index.js";

// Events
export {
  EventBus,
  createEventBus,
} from "./events/index.js";
export type {
  EventCategory,
  DomainEvents,
  EventType,
  EventPayload,
  EventHandler,
  EventMetadata,
  EventHistoryEntry,
} from "./events/index.js";

// Domain
export {
  SessionEntity,
  generateSessionId,
} from "./domain/index.js";
export type {
  SessionMessage,
  SessionStatus,
  SessionConfig,
  SessionSnapshot,
} from "./domain/index.js";

// Session
export {
  SessionActor,
  createSessionActor,
} from "./session/index.js";
export type {
  ActorMessageType,
  ActorMessages,
  QuestionHandler,
  SessionActorEvents,
} from "./session/index.js";

// Feature Flags
export {
  FLAGS,
  isEnabled,
  getEnabledFeatures,
  logFeatureFlags,
} from "./feature-flags.js";
