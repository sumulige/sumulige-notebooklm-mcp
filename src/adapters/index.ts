/**
 * Adapters Module
 *
 * Exports all adapter implementations for the hexagonal architecture.
 */

// Browser Adapters
export {
  PatchrightAdapter,
  createPatchrightAdapter,
  BrowserContextPool,
  createContextPool,
  ResponseObserver,
  createResponseObserver,
} from "./browser/index.js";
export type {
  ContextFactory,
  ContextCloser,
  ResponseObserverOptions,
  StreamingObserverOptions,
  StreamCallback,
  ObserverResult,
  StreamingResult,
} from "./browser/index.js";

// Auth Adapters
export {
  GoogleAuthAdapter,
  createGoogleAuthAdapter,
} from "./auth/index.js";

// Storage Adapters
export {
  FileStorageAdapter,
  createFileStorageAdapter,
} from "./storage/index.js";

// Transport Adapters
export {
  HttpTransportAdapter,
  createHttpAdapter,
  DEFAULT_HTTP_CONFIG,
} from "./transport/index.js";
export type {
  HttpAdapterConfig,
  IToolHandlers,
} from "./transport/index.js";
