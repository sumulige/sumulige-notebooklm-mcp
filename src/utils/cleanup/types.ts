/**
 * Type definitions for Cleanup module
 */

/**
 * Cleanup mode
 * - legacy: Only clean up legacy installation (notebooklm-mcp-nodejs)
 * - all: Clean up current and legacy installations
 * - deep: Deep clean including caches, logs, and trash
 */
export type CleanupMode = "legacy" | "all" | "deep";

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  success: boolean;
  mode: CleanupMode;
  deletedPaths: string[];
  failedPaths: string[];
  totalSizeBytes: number;
  categorySummary: Record<string, { count: number; bytes: number }>;
}

/**
 * A category of files to clean up
 */
export interface CleanupCategory {
  name: string;
  description: string;
  paths: string[];
  totalBytes: number;
  optional: boolean;
}

/**
 * Result of scanning for cleanup paths
 */
export interface CleanupScanResult {
  categories: CleanupCategory[];
  totalPaths: string[];
  totalSizeBytes: number;
}

/**
 * Platform-specific paths from env-paths
 */
export interface EnvPaths {
  data: string;
  config: string;
  cache: string;
  log: string;
  temp: string;
}

/**
 * Platform information
 */
export interface PlatformInfo {
  platform: string;
  legacyBasePath: string;
  currentBasePath: string;
  npmCachePath: string;
  claudeCliCachePath: string;
  claudeProjectsPath: string;
}
