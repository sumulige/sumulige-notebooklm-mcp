/**
 * Cleanup Manager for NotebookLM MCP Server
 *
 * This file re-exports the modular cleanup implementation.
 * The actual implementation is split into:
 * - cleanup/types.ts: Type definitions
 * - cleanup/platform-paths.ts: Platform-specific path resolution
 * - cleanup/search.ts: Search methods for finding cleanup targets
 * - cleanup/executor.ts: Cleanup execution logic
 * - cleanup/index.ts: Main aggregator (CleanupManager)
 */

export {
  // Main class
  CleanupManager,
  // Types
  type CleanupMode,
  type CleanupResult,
  type CleanupCategory,
  type CleanupScanResult,
  type EnvPaths,
  type PlatformInfo,
  // Submodules (for advanced usage)
  PlatformPaths,
  CleanupSearch,
  CleanupExecutor,
} from "./cleanup/index.js";
