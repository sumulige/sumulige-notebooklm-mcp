/**
 * Cleanup Search Methods
 *
 * Handles searching for files to clean up:
 * - NPM/NPX cache
 * - Claude CLI logs
 * - Claude projects
 * - Temporary backups
 * - Editor logs
 * - Trash files
 */

import path from "path";
import fs from "fs/promises";
import { globby } from "globby";
import { log } from "../logger.js";
import { PlatformPaths } from "./platform-paths.js";

export class CleanupSearch {
  private platformPaths: PlatformPaths;

  constructor(platformPaths: PlatformPaths) {
    this.platformPaths = platformPaths;
  }

  /**
   * Check if a path exists
   */
  async pathExists(dirPath: string): Promise<boolean> {
    try {
      await fs.access(dirPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find NPM/NPX cache files
   */
  async findNpmCache(): Promise<string[]> {
    const found: string[] = [];

    try {
      const npmCachePath = this.platformPaths.getNpmCachePath();
      const npxPath = path.join(npmCachePath, "_npx");

      if (!(await this.pathExists(npxPath))) {
        return found;
      }

      // Search for notebooklm-mcp in npx cache
      const pattern = path.join(npxPath, "*/node_modules/notebooklm-mcp");
      const matches = await globby(pattern, { onlyDirectories: true, absolute: true });
      found.push(...matches);
    } catch (error) {
      log.warning(`⚠️  Error searching NPM cache: ${error}`);
    }

    return found;
  }

  /**
   * Find Claude CLI MCP logs
   */
  async findClaudeCliLogs(): Promise<string[]> {
    const found: string[] = [];

    try {
      const claudeCliPath = this.platformPaths.getClaudeCliCachePath();

      if (!(await this.pathExists(claudeCliPath))) {
        return found;
      }

      // Search for notebooklm MCP logs
      const patterns = [
        path.join(claudeCliPath, "*/mcp-logs-notebooklm"),
        path.join(claudeCliPath, "*notebooklm-mcp*"),
      ];

      for (const pattern of patterns) {
        const matches = await globby(pattern, { onlyDirectories: true, absolute: true });
        found.push(...matches);
      }
    } catch (error) {
      log.warning(`⚠️  Error searching Claude CLI cache: ${error}`);
    }

    return found;
  }

  /**
   * Find Claude projects cache
   */
  async findClaudeProjects(): Promise<string[]> {
    const found: string[] = [];

    try {
      const projectsPath = this.platformPaths.getClaudeProjectsPath();

      if (!(await this.pathExists(projectsPath))) {
        return found;
      }

      // Search for notebooklm-mcp projects
      const pattern = path.join(projectsPath, "*notebooklm-mcp*");
      const matches = await globby(pattern, { onlyDirectories: true, absolute: true });
      found.push(...matches);
    } catch (error) {
      log.warning(`⚠️  Error searching Claude projects: ${error}`);
    }

    return found;
  }

  /**
   * Find temporary backups
   */
  async findTemporaryBackups(): Promise<string[]> {
    const found: string[] = [];

    try {
      // Search for notebooklm backup directories in temp
      const pattern = path.join(this.platformPaths.tempDir, "notebooklm-backup-*");
      const matches = await globby(pattern, { onlyDirectories: true, absolute: true });
      found.push(...matches);
    } catch (error) {
      log.warning(`⚠️  Error searching temp backups: ${error}`);
    }

    return found;
  }

  /**
   * Find editor logs (Cursor, VSCode)
   */
  async findEditorLogs(): Promise<string[]> {
    const found: string[] = [];

    try {
      const editorPaths = this.platformPaths.getEditorConfigPaths();

      for (const editorPath of editorPaths) {
        if (!(await this.pathExists(editorPath))) {
          continue;
        }

        // Search for MCP notebooklm logs
        const pattern = path.join(editorPath, "**/exthost/**/*notebooklm*.log");
        const matches = await globby(pattern, { onlyFiles: true, absolute: true });
        found.push(...matches);
      }
    } catch (error) {
      log.warning(`⚠️  Error searching editor logs: ${error}`);
    }

    return found;
  }

  /**
   * Find trash files
   */
  async findTrashFiles(): Promise<string[]> {
    const found: string[] = [];

    try {
      const trashPath = this.platformPaths.getTrashPath();
      if (!trashPath || !(await this.pathExists(trashPath))) {
        return found;
      }

      // Search for notebooklm files in trash
      const patterns = [path.join(trashPath, "**/*notebooklm*")];

      for (const pattern of patterns) {
        const matches = await globby(pattern, { absolute: true });
        found.push(...matches);
      }
    } catch (error) {
      log.warning(`⚠️  Error searching trash: ${error}`);
    }

    return found;
  }
}
