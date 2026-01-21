/**
 * Cleanup Manager - Main Aggregator
 *
 * Coordinates cleanup operations by combining:
 * - PlatformPaths: Platform-specific path resolution
 * - CleanupSearch: File search methods
 * - CleanupExecutor: Cleanup execution logic
 *
 * This facade provides a unified API for all cleanup operations.
 */

import { PlatformPaths } from "./platform-paths.js";
import { CleanupSearch } from "./search.js";
import { CleanupExecutor } from "./executor.js";
import type {
  CleanupMode,
  CleanupResult,
  CleanupScanResult,
  PlatformInfo,
} from "./types.js";

// Re-export types for external use
export type {
  CleanupMode,
  CleanupResult,
  CleanupCategory,
  CleanupScanResult,
  EnvPaths,
  PlatformInfo,
} from "./types.js";

// Re-export submodules for direct access if needed
export { PlatformPaths } from "./platform-paths.js";
export { CleanupSearch } from "./search.js";
export { CleanupExecutor } from "./executor.js";

/**
 * CleanupManager - Main facade for cleanup operations
 *
 * Provides a unified API for:
 * - Scanning for cleanup paths
 * - Performing cleanup operations
 * - Getting platform information
 */
export class CleanupManager {
  private platformPaths: PlatformPaths;
  private search: CleanupSearch;
  private executor: CleanupExecutor;

  constructor() {
    this.platformPaths = new PlatformPaths();
    this.search = new CleanupSearch(this.platformPaths);
    this.executor = new CleanupExecutor(this.platformPaths, this.search);
  }

  /**
   * Get all paths that would be deleted for a given mode
   */
  async getCleanupPaths(
    mode: CleanupMode,
    preserveLibrary: boolean = false
  ): Promise<CleanupScanResult> {
    return this.executor.getCleanupPaths(mode, preserveLibrary);
  }

  /**
   * Perform cleanup with safety checks and detailed reporting
   */
  async performCleanup(
    mode: CleanupMode,
    preserveLibrary: boolean = false
  ): Promise<CleanupResult> {
    return this.executor.performCleanup(mode, preserveLibrary);
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    return this.executor.formatBytes(bytes);
  }

  /**
   * Get platform-specific path information
   */
  getPlatformInfo(): PlatformInfo {
    return this.platformPaths.getPlatformInfo();
  }

  /**
   * Get the size of a file or directory
   */
  async getSize(path: string): Promise<number> {
    return this.executor.getDirectorySize(path);
  }

  /**
   * Check if a path exists
   */
  async pathExists(path: string): Promise<boolean> {
    return this.search.pathExists(path);
  }
}
