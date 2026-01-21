/**
 * Cleanup Executor
 *
 * Handles the actual cleanup execution:
 * - Scanning for cleanup paths
 * - Performing cleanup
 * - Size calculation
 * - Result reporting
 */

import fs from "fs/promises";
import path from "path";
import { log } from "../logger.js";
import type {
  CleanupMode,
  CleanupResult,
  CleanupCategory,
  CleanupScanResult,
} from "./types.js";
import { PlatformPaths } from "./platform-paths.js";
import { CleanupSearch } from "./search.js";

export class CleanupExecutor {
  private platformPaths: PlatformPaths;
  private search: CleanupSearch;

  constructor(platformPaths: PlatformPaths, search: CleanupSearch) {
    this.platformPaths = platformPaths;
    this.search = search;
  }

  /**
   * Get the size of a single file
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Get the total size of a directory (recursive)
   */
  async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        return stats.size;
      }

      let totalSize = 0;
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const fileStats = await fs.stat(filePath);

        if (fileStats.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else {
          totalSize += fileStats.size;
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Get all paths that would be deleted for a given mode (with categorization)
   */
  async getCleanupPaths(
    mode: CleanupMode,
    preserveLibrary: boolean = false
  ): Promise<CleanupScanResult> {
    const categories: CleanupCategory[] = [];
    const allPaths: Set<string> = new Set();
    let totalSizeBytes = 0;

    // Category 1: Legacy Paths (notebooklm-mcp-nodejs & manual legacy paths)
    if (mode === "legacy" || mode === "all" || mode === "deep") {
      const legacyPaths: string[] = [];
      let legacyBytes = 0;

      // Check envPaths-based legacy directories
      const legacyDirs = [
        this.platformPaths.legacyPaths.data,
        this.platformPaths.legacyPaths.config,
        this.platformPaths.legacyPaths.cache,
        this.platformPaths.legacyPaths.log,
        this.platformPaths.legacyPaths.temp,
      ];

      for (const dir of legacyDirs) {
        if (await this.search.pathExists(dir)) {
          const size = await this.getDirectorySize(dir);
          legacyPaths.push(dir);
          legacyBytes += size;
          allPaths.add(dir);
        }
      }

      // CRITICAL: Also check manual legacy paths to catch old config.json files
      // and any paths that envPaths might miss
      const manualLegacyPaths = this.platformPaths.getManualLegacyPaths();
      for (const dir of manualLegacyPaths) {
        if ((await this.search.pathExists(dir)) && !allPaths.has(dir)) {
          const size = await this.getDirectorySize(dir);
          legacyPaths.push(dir);
          legacyBytes += size;
          allPaths.add(dir);
        }
      }

      if (legacyPaths.length > 0) {
        categories.push({
          name: "Legacy Installation (notebooklm-mcp-nodejs)",
          description: "Old installation data with -nodejs suffix and legacy config files",
          paths: legacyPaths,
          totalBytes: legacyBytes,
          optional: false,
        });
        totalSizeBytes += legacyBytes;
      }
    }

    // Category 2: Current Installation
    if (mode === "all" || mode === "deep") {
      const currentPaths: string[] = [];
      let currentBytes = 0;

      // If preserveLibrary is true, don't delete the data directory itself
      // Instead, only delete subdirectories
      const currentDirs = preserveLibrary
        ? [
            // Don't include data directory to preserve library.json
            this.platformPaths.currentPaths.config,
            this.platformPaths.currentPaths.cache,
            this.platformPaths.currentPaths.log,
            this.platformPaths.currentPaths.temp,
            // Only delete subdirectories, not the parent
            path.join(this.platformPaths.currentPaths.data, "browser_state"),
            path.join(this.platformPaths.currentPaths.data, "chrome_profile"),
            path.join(this.platformPaths.currentPaths.data, "chrome_profile_instances"),
          ]
        : [
            // Delete everything including data directory
            this.platformPaths.currentPaths.data,
            this.platformPaths.currentPaths.config,
            this.platformPaths.currentPaths.cache,
            this.platformPaths.currentPaths.log,
            this.platformPaths.currentPaths.temp,
            // Specific subdirectories (only if parent doesn't exist)
            path.join(this.platformPaths.currentPaths.data, "browser_state"),
            path.join(this.platformPaths.currentPaths.data, "chrome_profile"),
            path.join(this.platformPaths.currentPaths.data, "chrome_profile_instances"),
          ];

      for (const dir of currentDirs) {
        if ((await this.search.pathExists(dir)) && !allPaths.has(dir)) {
          const size = await this.getDirectorySize(dir);
          currentPaths.push(dir);
          currentBytes += size;
          allPaths.add(dir);
        }
      }

      if (currentPaths.length > 0) {
        const description = preserveLibrary
          ? "Active installation data and browser profiles (library.json will be preserved)"
          : "Active installation data and browser profiles";

        categories.push({
          name: "Current Installation (notebooklm-mcp)",
          description,
          paths: currentPaths,
          totalBytes: currentBytes,
          optional: false,
        });
        totalSizeBytes += currentBytes;
      }
    }

    // Category 3: NPM Cache
    if (mode === "all" || mode === "deep") {
      const npmPaths = await this.search.findNpmCache();
      if (npmPaths.length > 0) {
        let npmBytes = 0;
        for (const p of npmPaths) {
          if (!allPaths.has(p)) {
            npmBytes += await this.getDirectorySize(p);
            allPaths.add(p);
          }
        }

        if (npmBytes > 0) {
          categories.push({
            name: "NPM/NPX Cache",
            description: "NPX cached installations of notebooklm-mcp",
            paths: npmPaths,
            totalBytes: npmBytes,
            optional: false,
          });
          totalSizeBytes += npmBytes;
        }
      }
    }

    // Category 4: Claude CLI Logs
    if (mode === "all" || mode === "deep") {
      const claudeCliPaths = await this.search.findClaudeCliLogs();
      if (claudeCliPaths.length > 0) {
        let claudeCliBytes = 0;
        for (const p of claudeCliPaths) {
          if (!allPaths.has(p)) {
            claudeCliBytes += await this.getDirectorySize(p);
            allPaths.add(p);
          }
        }

        if (claudeCliBytes > 0) {
          categories.push({
            name: "Claude CLI MCP Logs",
            description: "MCP server logs from Claude CLI",
            paths: claudeCliPaths,
            totalBytes: claudeCliBytes,
            optional: false,
          });
          totalSizeBytes += claudeCliBytes;
        }
      }
    }

    // Category 5: Temporary Backups
    if (mode === "all" || mode === "deep") {
      const backupPaths = await this.search.findTemporaryBackups();
      if (backupPaths.length > 0) {
        let backupBytes = 0;
        for (const p of backupPaths) {
          if (!allPaths.has(p)) {
            backupBytes += await this.getDirectorySize(p);
            allPaths.add(p);
          }
        }

        if (backupBytes > 0) {
          categories.push({
            name: "Temporary Backups",
            description: "Temporary backup directories in system temp",
            paths: backupPaths,
            totalBytes: backupBytes,
            optional: false,
          });
          totalSizeBytes += backupBytes;
        }
      }
    }

    // Category 6: Claude Projects (deep mode only)
    if (mode === "deep") {
      const projectPaths = await this.search.findClaudeProjects();
      if (projectPaths.length > 0) {
        let projectBytes = 0;
        for (const p of projectPaths) {
          if (!allPaths.has(p)) {
            projectBytes += await this.getDirectorySize(p);
            allPaths.add(p);
          }
        }

        if (projectBytes > 0) {
          categories.push({
            name: "Claude Projects Cache",
            description: "Project-specific cache in Claude config",
            paths: projectPaths,
            totalBytes: projectBytes,
            optional: true,
          });
          totalSizeBytes += projectBytes;
        }
      }
    }

    // Category 7: Editor Logs (deep mode only)
    if (mode === "deep") {
      const editorPaths = await this.search.findEditorLogs();
      if (editorPaths.length > 0) {
        let editorBytes = 0;
        for (const p of editorPaths) {
          if (!allPaths.has(p)) {
            editorBytes += await this.getFileSize(p);
            allPaths.add(p);
          }
        }

        if (editorBytes > 0) {
          categories.push({
            name: "Editor Logs (Cursor/VSCode)",
            description: "MCP logs from code editors",
            paths: editorPaths,
            totalBytes: editorBytes,
            optional: true,
          });
          totalSizeBytes += editorBytes;
        }
      }
    }

    // Category 8: Trash Files (deep mode only)
    if (mode === "deep") {
      const trashPaths = await this.search.findTrashFiles();
      if (trashPaths.length > 0) {
        let trashBytes = 0;
        for (const p of trashPaths) {
          if (!allPaths.has(p)) {
            trashBytes += await this.getFileSize(p);
            allPaths.add(p);
          }
        }

        if (trashBytes > 0) {
          categories.push({
            name: "Trash Files",
            description: "Deleted notebooklm files in system trash",
            paths: trashPaths,
            totalBytes: trashBytes,
            optional: true,
          });
          totalSizeBytes += trashBytes;
        }
      }
    }

    return {
      categories,
      totalPaths: Array.from(allPaths),
      totalSizeBytes,
    };
  }

  /**
   * Perform cleanup with safety checks and detailed reporting
   */
  async performCleanup(
    mode: CleanupMode,
    preserveLibrary: boolean = false
  ): Promise<CleanupResult> {
    log.info(`🧹 Starting cleanup in "${mode}" mode...`);
    if (preserveLibrary) {
      log.info(`📚 Library preservation enabled - library.json will be kept!`);
    }

    const { categories, totalSizeBytes } = await this.getCleanupPaths(mode, preserveLibrary);
    const deletedPaths: string[] = [];
    const failedPaths: string[] = [];
    const categorySummary: Record<string, { count: number; bytes: number }> = {};

    // Delete by category
    for (const category of categories) {
      log.info(
        `\n📦 ${category.name} (${category.paths.length} items, ${this.formatBytes(category.totalBytes)})`
      );

      if (category.optional) {
        log.warning(`  ⚠️  Optional category - ${category.description}`);
      }

      let categoryDeleted = 0;
      let categoryBytes = 0;

      for (const itemPath of category.paths) {
        try {
          if (await this.search.pathExists(itemPath)) {
            const size = await this.getDirectorySize(itemPath);
            log.info(`  🗑️  Deleting: ${itemPath}`);
            await fs.rm(itemPath, { recursive: true, force: true });
            deletedPaths.push(itemPath);
            categoryDeleted++;
            categoryBytes += size;
            log.success(`  ✅ Deleted: ${itemPath} (${this.formatBytes(size)})`);
          }
        } catch (error) {
          log.error(`  ❌ Failed to delete: ${itemPath} - ${error}`);
          failedPaths.push(itemPath);
        }
      }

      categorySummary[category.name] = {
        count: categoryDeleted,
        bytes: categoryBytes,
      };
    }

    const success = failedPaths.length === 0;

    if (success) {
      log.success(
        `\n✅ Cleanup complete! Deleted ${deletedPaths.length} items (${this.formatBytes(totalSizeBytes)})`
      );
    } else {
      log.warning(`\n⚠️  Cleanup completed with ${failedPaths.length} errors`);
      log.success(`  Deleted: ${deletedPaths.length} items`);
      log.error(`  Failed: ${failedPaths.length} items`);
    }

    return {
      success,
      mode,
      deletedPaths,
      failedPaths,
      totalSizeBytes,
      categorySummary,
    };
  }
}
