/**
 * Browser Adapters Module
 *
 * Exports browser adapter implementations.
 */

export { PatchrightAdapter, createPatchrightAdapter } from "./patchright-adapter.js";
export { BrowserContextPool, createContextPool } from "./context-pool.js";
export { ResponseObserver, createResponseObserver } from "./response-observer.js";
export type { ContextFactory, ContextCloser } from "./context-pool.js";
export type {
  ResponseObserverOptions,
  StreamingObserverOptions,
  StreamCallback,
  ObserverResult,
  StreamingResult,
} from "./response-observer.js";
