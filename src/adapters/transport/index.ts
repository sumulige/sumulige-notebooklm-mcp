/**
 * Transport Adapters Module
 *
 * Exports transport adapters for different communication protocols.
 */

export {
  HttpTransportAdapter,
  createHttpAdapter,
  DEFAULT_HTTP_CONFIG,
} from "./http-adapter.js";

export type {
  HttpAdapterConfig,
  IToolHandlers,
} from "./http-adapter.js";
