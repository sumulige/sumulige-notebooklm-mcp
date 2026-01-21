/**
 * Auth Setup and Cleanup
 *
 * Handles:
 * - Interactive setup for manual login
 * - Clearing all authentication data
 * - Hard reset functionality
 */

import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";
import type { ProgressCallback, IAuthSetup } from "./auth-types.js";
import { StateManager } from "./state-manager.js";
import { InteractiveLogin } from "./interactive-login.js";

export class AuthSetup implements IAuthSetup {
  private stateManager: StateManager;
  private interactiveLogin: InteractiveLogin;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.interactiveLogin = new InteractiveLogin();
  }

  /**
   * Perform interactive setup (for setup_auth tool)
   * Opens a PERSISTENT browser for manual login
   *
   * CRITICAL: Uses the SAME persistent context as runtime!
   * This ensures cookies are automatically saved to the Chrome profile.
   *
   * Benefits over temporary browser:
   * - Session cookies persist correctly (Playwright bug workaround)
   * - Same fingerprint as runtime
   * - No need for addCookies() workarounds
   * - Automatic cookie persistence via Chrome profile
   *
   * @param sendProgress Optional progress callback
   * @param overrideHeadless Optional override for headless mode (true = visible, false = headless)
   *                         If not provided, defaults to true (visible) for setup
   */
  async performSetup(
    sendProgress?: ProgressCallback,
    overrideHeadless?: boolean
  ): Promise<boolean> {
    const { chromium } = await import("patchright");

    // Determine headless mode: override or default to true (visible for setup)
    // overrideHeadless contains show_browser value (true = show, false = hide)
    const shouldShowBrowser = overrideHeadless !== undefined ? overrideHeadless : true;

    try {
      // CRITICAL: Clear ALL old auth data FIRST (for account switching)
      log.info("🔄 Preparing for new account authentication...");
      await sendProgress?.("Clearing old authentication data...", 1, 10);
      await this.clearAllAuthData();

      log.info("🚀 Launching persistent browser for interactive setup...");
      log.info(`  📍 Profile: ${CONFIG.chromeProfileDir}`);
      await sendProgress?.("Launching persistent browser...", 2, 10);

      // CRITICAL FIX: Use launchPersistentContext (same as runtime!)
      // This ensures session cookies persist correctly
      const context = await chromium.launchPersistentContext(CONFIG.chromeProfileDir, {
        headless: !shouldShowBrowser, // Use override or default to visible for setup
        channel: "chrome" as const,
        viewport: CONFIG.viewport,
        locale: "en-US",
        timezoneId: "Europe/Berlin",
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-dev-shm-usage",
          "--no-first-run",
          "--no-default-browser-check",
        ],
      });

      // Get or create a page
      const pages = context.pages();
      const page = pages.length > 0 ? pages[0] : await context.newPage();

      // Perform login with progress updates
      const loginSuccess = await this.interactiveLogin.performLogin(page, sendProgress);

      if (loginSuccess) {
        // Save browser state to state.json (for validation & backup)
        // Chrome ALSO saves everything to the persistent profile automatically!
        await sendProgress?.("Saving authentication state...", 9, 10);
        await this.stateManager.saveBrowserState(context, page);
        log.success("✅ Setup complete - authentication saved to:");
        log.success(`  📄 State file: ${this.stateManager.getStateFilePath()}`);
        log.success(`  📁 Chrome profile: ${CONFIG.chromeProfileDir}`);
        log.info("💡 Session cookies will now persist across restarts!");
      }

      // Close persistent context
      await context.close();

      return loginSuccess;
    } catch (error) {
      log.error(`❌ Setup failed: ${error}`);
      return false;
    }
  }

  /**
   * Clear ALL authentication data for account switching
   *
   * CRITICAL: This deletes EVERYTHING to ensure only ONE account is active:
   * - All state.json files (cookies, localStorage)
   * - sessionStorage files
   * - Chrome profile directory (browser fingerprint, cache, etc.)
   *
   * Use this BEFORE authenticating a new account!
   */
  async clearAllAuthData(): Promise<void> {
    log.warning("🗑️  Clearing ALL authentication data for account switch...");

    let deletedCount = 0;

    // 1. Delete all state files in browser_state_dir
    try {
      const files = await fs.readdir(CONFIG.browserStateDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          await fs.unlink(path.join(CONFIG.browserStateDir, file));
          log.info(`  ✅ Deleted: ${file}`);
          deletedCount++;
        }
      }
    } catch (error) {
      log.warning(`  ⚠️  Could not delete state files: ${error}`);
    }

    // 2. Delete Chrome profile (THE KEY for account switching!)
    // This removes ALL browser data: cookies, cache, fingerprint, etc.
    try {
      const chromeProfileDir = CONFIG.chromeProfileDir;
      if (existsSync(chromeProfileDir)) {
        await fs.rm(chromeProfileDir, { recursive: true, force: true });
        log.success(`  ✅ Deleted Chrome profile: ${chromeProfileDir}`);
        deletedCount++;
      }
    } catch (error) {
      log.warning(`  ⚠️  Could not delete Chrome profile: ${error}`);
    }

    if (deletedCount === 0) {
      log.info("  ℹ️  No old auth data found (already clean)");
    } else {
      log.success(`✅ All auth data cleared (${deletedCount} items) - ready for new account!`);
    }
  }

  /**
   * Clear all saved authentication state
   */
  async clearState(): Promise<boolean> {
    try {
      await this.stateManager.deleteStateFiles();
      log.success("✅ Authentication state cleared");
      return true;
    } catch (error) {
      log.error(`❌ Failed to clear state: ${error}`);
      return false;
    }
  }

  /**
   * HARD RESET: Completely delete ALL authentication state
   */
  async hardResetState(): Promise<boolean> {
    try {
      log.warning("🧹 Performing HARD RESET of all authentication state...");

      let deletedCount = 0;

      // Delete state files
      const { stateDeleted, sessionDeleted } = await this.stateManager.deleteStateFiles();
      if (stateDeleted) {
        log.info(`  🗑️  Deleted: ${this.stateManager.getStateFilePath()}`);
        deletedCount++;
      }
      if (sessionDeleted) {
        log.info(`  🗑️  Deleted: ${this.stateManager.getSessionFilePath()}`);
        deletedCount++;
      }

      // Delete entire browser_state_dir
      try {
        const files = await fs.readdir(CONFIG.browserStateDir);
        for (const file of files) {
          await fs.unlink(path.join(CONFIG.browserStateDir, file));
          deletedCount++;
        }
        log.info(`  🗑️  Deleted: ${CONFIG.browserStateDir}/ (${files.length} files)`);
      } catch {
        // Directory doesn't exist or empty
      }

      if (deletedCount === 0) {
        log.info("  ℹ️  No state to delete (already clean)");
      } else {
        log.success(`✅ Hard reset complete: ${deletedCount} items deleted`);
      }

      return true;
    } catch (error) {
      log.error(`❌ Hard reset failed: ${error}`);
      return false;
    }
  }
}
