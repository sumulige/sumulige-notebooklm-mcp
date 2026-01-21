/**
 * Platform-specific Path Resolution
 *
 * Handles path resolution for different platforms:
 * - Linux: ~/.config, ~/.local/share, ~/.cache
 * - macOS: ~/Library/Application Support, ~/Library/Caches
 * - Windows: %APPDATA%, %LOCALAPPDATA%
 */

import path from "path";
import os from "os";
import envPaths from "env-paths";
import type { EnvPaths, PlatformInfo } from "./types.js";

export class PlatformPaths {
  readonly legacyPaths: EnvPaths;
  readonly currentPaths: EnvPaths;
  readonly homeDir: string;
  readonly tempDir: string;

  constructor() {
    // envPaths() does NOT create directories - it just returns path strings
    // IMPORTANT: envPaths() has a default suffix 'nodejs', so we must explicitly disable it!

    // Legacy paths with -nodejs suffix (using default suffix behavior)
    this.legacyPaths = envPaths("notebooklm-mcp"); // This becomes notebooklm-mcp-nodejs by default
    // Current paths without suffix (disable the default suffix with empty string)
    this.currentPaths = envPaths("notebooklm-mcp", { suffix: "" });
    // Platform-agnostic paths
    this.homeDir = os.homedir();
    this.tempDir = os.tmpdir();
  }

  /**
   * Get NPM cache directory (platform-specific)
   */
  getNpmCachePath(): string {
    return path.join(this.homeDir, ".npm");
  }

  /**
   * Get Claude CLI cache directory (platform-specific)
   */
  getClaudeCliCachePath(): string {
    const platform = process.platform;

    if (platform === "win32") {
      const localAppData =
        process.env.LOCALAPPDATA || path.join(this.homeDir, "AppData", "Local");
      return path.join(localAppData, "claude-cli-nodejs");
    } else if (platform === "darwin") {
      return path.join(this.homeDir, "Library", "Caches", "claude-cli-nodejs");
    } else {
      // Linux and others
      return path.join(this.homeDir, ".cache", "claude-cli-nodejs");
    }
  }

  /**
   * Get Claude projects directory (platform-specific)
   */
  getClaudeProjectsPath(): string {
    const platform = process.platform;

    if (platform === "win32") {
      const appData = process.env.APPDATA || path.join(this.homeDir, "AppData", "Roaming");
      return path.join(appData, ".claude", "projects");
    } else if (platform === "darwin") {
      return path.join(this.homeDir, "Library", "Application Support", "claude", "projects");
    } else {
      // Linux and others
      return path.join(this.homeDir, ".claude", "projects");
    }
  }

  /**
   * Get editor config paths (Cursor, VSCode)
   */
  getEditorConfigPaths(): string[] {
    const platform = process.platform;
    const paths: string[] = [];

    if (platform === "win32") {
      const appData = process.env.APPDATA || path.join(this.homeDir, "AppData", "Roaming");
      paths.push(path.join(appData, "Cursor", "logs"), path.join(appData, "Code", "logs"));
    } else if (platform === "darwin") {
      paths.push(
        path.join(this.homeDir, "Library", "Application Support", "Cursor", "logs"),
        path.join(this.homeDir, "Library", "Application Support", "Code", "logs")
      );
    } else {
      // Linux
      paths.push(
        path.join(this.homeDir, ".config", "Cursor", "logs"),
        path.join(this.homeDir, ".config", "Code", "logs")
      );
    }

    return paths;
  }

  /**
   * Get trash directory (platform-specific)
   */
  getTrashPath(): string | null {
    const platform = process.platform;

    if (platform === "darwin") {
      return path.join(this.homeDir, ".Trash");
    } else if (platform === "linux") {
      return path.join(this.homeDir, ".local", "share", "Trash");
    } else {
      // Windows Recycle Bin is complex, skip for now
      return null;
    }
  }

  /**
   * Get manual legacy config paths that might not be caught by envPaths
   * This ensures we catch ALL legacy installations including old config.json files
   */
  getManualLegacyPaths(): string[] {
    const paths: string[] = [];
    const platform = process.platform;

    if (platform === "linux") {
      // Linux-specific paths
      paths.push(
        path.join(this.homeDir, ".config", "notebooklm-mcp"),
        path.join(this.homeDir, ".config", "notebooklm-mcp-nodejs"),
        path.join(this.homeDir, ".local", "share", "notebooklm-mcp"),
        path.join(this.homeDir, ".local", "share", "notebooklm-mcp-nodejs"),
        path.join(this.homeDir, ".cache", "notebooklm-mcp"),
        path.join(this.homeDir, ".cache", "notebooklm-mcp-nodejs"),
        path.join(this.homeDir, ".local", "state", "notebooklm-mcp"),
        path.join(this.homeDir, ".local", "state", "notebooklm-mcp-nodejs")
      );
    } else if (platform === "darwin") {
      // macOS-specific paths
      paths.push(
        path.join(this.homeDir, "Library", "Application Support", "notebooklm-mcp"),
        path.join(this.homeDir, "Library", "Application Support", "notebooklm-mcp-nodejs"),
        path.join(this.homeDir, "Library", "Preferences", "notebooklm-mcp"),
        path.join(this.homeDir, "Library", "Preferences", "notebooklm-mcp-nodejs"),
        path.join(this.homeDir, "Library", "Caches", "notebooklm-mcp"),
        path.join(this.homeDir, "Library", "Caches", "notebooklm-mcp-nodejs"),
        path.join(this.homeDir, "Library", "Logs", "notebooklm-mcp"),
        path.join(this.homeDir, "Library", "Logs", "notebooklm-mcp-nodejs")
      );
    } else if (platform === "win32") {
      // Windows-specific paths
      const localAppData =
        process.env.LOCALAPPDATA || path.join(this.homeDir, "AppData", "Local");
      const appData = process.env.APPDATA || path.join(this.homeDir, "AppData", "Roaming");
      paths.push(
        path.join(localAppData, "notebooklm-mcp"),
        path.join(localAppData, "notebooklm-mcp-nodejs"),
        path.join(appData, "notebooklm-mcp"),
        path.join(appData, "notebooklm-mcp-nodejs")
      );
    }

    return paths;
  }

  /**
   * Get platform-specific path info
   */
  getPlatformInfo(): PlatformInfo {
    const platform = process.platform;
    let platformName = "Unknown";

    switch (platform) {
      case "win32":
        platformName = "Windows";
        break;
      case "darwin":
        platformName = "macOS";
        break;
      case "linux":
        platformName = "Linux";
        break;
    }

    return {
      platform: platformName,
      legacyBasePath: this.legacyPaths.data,
      currentBasePath: this.currentPaths.data,
      npmCachePath: this.getNpmCachePath(),
      claudeCliCachePath: this.getClaudeCliCachePath(),
      claudeProjectsPath: this.getClaudeProjectsPath(),
    };
  }
}
